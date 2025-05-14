import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import axios from "axios"
import { readFile } from "fs/promises"
import { OpenAPISpecLoader } from "../src/openapi-loader"
import { OpenAPIV3 } from "openapi-types"
import { Tool } from "@modelcontextprotocol/sdk/types.js"

// Mock dependencies
vi.mock("axios")
vi.mock("fs/promises")

describe("OpenAPISpecLoader", () => {
  let openAPILoader: OpenAPISpecLoader
  const mockOpenAPISpec: OpenAPIV3.Document = {
    openapi: "3.0.0",
    info: {
      title: "Test API",
      version: "1.0.0",
    },
    paths: {
      "/users": {
        get: {
          operationId: "getUsers",
          summary: "Get all users",
          description: "Returns a list of users",
          parameters: [
            {
              name: "limit",
              in: "query",
              description: "Maximum number of users to return",
              required: false,
              schema: {
                type: "integer",
              },
            },
          ],
          responses: {},
        },
        post: {
          operationId: "createUser",
          summary: "Create a user",
          description: "Creates a new user",
          responses: {},
        },
      },
      "/users/{id}": {
        get: {
          operationId: "getUserById",
          summary: "Get user by ID",
          description: "Returns a user by ID",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "User ID",
              required: true,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {},
        },
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    openAPILoader = new OpenAPISpecLoader()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("loadOpenAPISpec", () => {
    it("should load spec from URL", async () => {
      const url = "https://example.com/api-spec.json"
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockOpenAPISpec })

      const result = await openAPILoader.loadOpenAPISpec(url)

      expect(axios.get).toHaveBeenCalledWith(url)
      expect(result).toEqual(mockOpenAPISpec)
    })

    it("should load spec from local file", async () => {
      const filePath = "./api-spec.json"
      const fileContent = JSON.stringify(mockOpenAPISpec)
      vi.mocked(readFile).mockResolvedValueOnce(fileContent)

      const result = await openAPILoader.loadOpenAPISpec(filePath)

      expect(readFile).toHaveBeenCalledWith(filePath, "utf-8")
      expect(result).toEqual(mockOpenAPISpec)
    })

    it("should throw error if file reading fails", async () => {
      const filePath = "./api-spec.json"
      const error = new Error("File not found")
      vi.mocked(readFile).mockRejectedValueOnce(error)

      await expect(openAPILoader.loadOpenAPISpec(filePath)).rejects.toThrow("File not found")
    })
  })

  describe("parseOpenAPISpec", () => {
    it("should convert OpenAPI paths to MCP tools", () => {
      const tools = openAPILoader.parseOpenAPISpec(mockOpenAPISpec)

      expect(tools.size).toBe(3)
      expect(tools.has("GET-users")).toBe(true)
      expect(tools.has("POST-users")).toBe(true)
      expect(tools.has("GET-users-id")).toBe(true)
    })

    it("should set correct tool properties", () => {
      const tools = openAPILoader.parseOpenAPISpec(mockOpenAPISpec)
      const getUsersTool = tools.get("GET-users") as Tool

      expect(getUsersTool).toBeDefined()
      expect(getUsersTool.name).toBe("getUsers")
      expect(getUsersTool.description).toBe("Returns a list of users")
      expect(getUsersTool.inputSchema).toEqual({
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Maximum number of users to return",
          },
        },
      })
    })

    it("should handle required parameters", () => {
      const tools = openAPILoader.parseOpenAPISpec(mockOpenAPISpec)
      const getUserByIdTool = tools.get("GET-users-id") as Tool

      expect(getUserByIdTool).toBeDefined()
      expect(getUserByIdTool.inputSchema).toEqual({
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "User ID",
          },
        },
        required: ["id"],
      })
    })

    it("should use operationId as tool name when available", () => {
      const tools = openAPILoader.parseOpenAPISpec(mockOpenAPISpec)
      const getUsersTool = tools.get("GET-users") as Tool

      expect(getUsersTool.name).toBe("getUsers")
    })

    it("should handle paths with special characters", () => {
      const specWithSpecialChars: OpenAPIV3.Document = {
        ...mockOpenAPISpec,
        paths: {
          "/api/v1/user-profiles": {
            get: {
              operationId: "getUserProfiles",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithSpecialChars)
      expect(tools.has("GET-api-v1-user-profiles")).toBe(true)
    })

    it("should handle empty paths object", () => {
      const emptySpec: OpenAPIV3.Document = {
        ...mockOpenAPISpec,
        paths: {},
      }

      const tools = openAPILoader.parseOpenAPISpec(emptySpec)
      expect(tools.size).toBe(0)
    })

    it("should skip parameters property in pathItem", () => {
      const specWithPathParams: OpenAPIV3.Document = {
        ...mockOpenAPISpec,
        paths: {
          "/users": {
            parameters: [
              {
                name: "common",
                in: "query",
                schema: {
                  type: "string",
                },
              },
            ],
            get: {
              operationId: "getUsers",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithPathParams)
      expect(tools.size).toBe(1)
      expect(tools.has("GET-users")).toBe(true)
    })
  })
})
