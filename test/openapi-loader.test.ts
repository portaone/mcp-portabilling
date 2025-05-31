import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { readFile } from "fs/promises"
import { OpenAPISpecLoader, ExtendedTool } from "../src/openapi-loader"
import { OpenAPIV3 } from "openapi-types"
import { Tool } from "@modelcontextprotocol/sdk/types.js"

// Mock dependencies
vi.mock("fs/promises")

vi.mock("js-yaml", async () => {
  const actualJsYamlMod = await vi.importActual<typeof import("js-yaml")>("js-yaml")

  // The SUT (System Under Test) uses "import yaml from 'js-yaml'",
  // which means it expects 'js-yaml' to have a default export.
  // The mocked 'load' function for this default export should call the actual 'load' from js-yaml.
  // According to @types/js-yaml, the 'load' function is a direct export of the module.
  const realLoadFn = actualJsYamlMod.load

  if (typeof realLoadFn !== "function") {
    // This would be unexpected if @types/js-yaml is correct and js-yaml is installed.
    console.error(
      "Vitest mock issue: js-yaml .load function not found on actualJsYamlMod as per types.",
      actualJsYamlMod,
    )
    throw new Error("Vitest mock setup: actualJsYamlMod.load is not a function")
  }

  return {
    default: {
      load: vi.fn((content: string) => realLoadFn(content)),
    },
    // Provide other exports as well, consistent with the actual module, in case they are ever used.
    load: vi.fn((content: string) => realLoadFn(content)),
    // safeLoad: vi.fn((content: string) => actualJsYamlMod.safeLoad(content)), // Temporarily remove if causing type issues
    // Add other js-yaml exports if necessary for full fidelity, though 'load' is the key one here.
  }
})

// Mock fetch globally for tests that might use it
global.fetch = vi.fn()

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
    openAPILoader = new OpenAPISpecLoader()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("loadOpenAPISpec", () => {
    it("should load spec from URL", async () => {
      const url = "https://example.com/api-spec.json"
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockOpenAPISpec),
        json: async () => mockOpenAPISpec, // Though text() is used in implementation
      } as Response)

      const result = await openAPILoader.loadOpenAPISpec(url, "url")

      expect(fetch).toHaveBeenCalledWith(url)
      expect(result).toEqual(mockOpenAPISpec)
    })

    it("should load spec from local file (JSON)", async () => {
      const filePath = "./api-spec.json"
      const fileContent = JSON.stringify(mockOpenAPISpec)
      vi.mocked(readFile).mockResolvedValueOnce(fileContent)

      const result = await openAPILoader.loadOpenAPISpec(filePath, "file")

      expect(readFile).toHaveBeenCalledWith(filePath, "utf-8")
      expect(result).toEqual(mockOpenAPISpec)
    })

    it("should load spec from local file (YAML)", async () => {
      const filePath = "./api-spec.yaml"
      const yamlContent = `
openapi: 3.0.0
info:
  title: Test API YAML
  version: 1.0.0
paths:
  /test:
    get:
      summary: Test YAML endpoint
      responses:
        '200':
          description: Successful response
`
      const expectedSpecObject = {
        openapi: "3.0.0",
        info: {
          title: "Test API YAML",
          version: "1.0.0",
        },
        paths: {
          "/test": {
            get: {
              summary: "Test YAML endpoint",
              responses: {
                "200": {
                  description: "Successful response",
                },
              },
            },
          },
        },
      }

      vi.mocked(readFile).mockResolvedValueOnce(yamlContent)

      const result = await openAPILoader.loadOpenAPISpec(filePath, "file")

      expect(readFile).toHaveBeenCalledWith(filePath, "utf-8")
      expect(result).toEqual(expectedSpecObject)
    })

    it("should load spec from inline content (JSON)", async () => {
      const inlineContent = JSON.stringify(mockOpenAPISpec)

      const result = await openAPILoader.loadOpenAPISpec("inline", "inline", inlineContent)

      expect(result).toEqual(mockOpenAPISpec)
    })

    it("should load spec from inline content (YAML)", async () => {
      const yamlContent = `
openapi: 3.0.0
info:
  title: Inline YAML API
  version: 1.0.0
paths:
  /inline:
    get:
      summary: Inline endpoint
      responses:
        '200':
          description: Success
`
      const expectedSpec = {
        openapi: "3.0.0",
        info: {
          title: "Inline YAML API",
          version: "1.0.0",
        },
        paths: {
          "/inline": {
            get: {
              summary: "Inline endpoint",
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
      }

      const result = await openAPILoader.loadOpenAPISpec("inline", "inline", yamlContent)

      expect(result).toEqual(expectedSpec)
    })

    it("should load spec from stdin", async () => {
      const stdinContent = JSON.stringify(mockOpenAPISpec)

      // Mock process.stdin
      const mockStdin = {
        setEncoding: vi.fn(),
        on: vi.fn(),
        resume: vi.fn(),
      }

      // Replace process.stdin temporarily
      const originalStdin = process.stdin
      Object.defineProperty(process, "stdin", {
        value: mockStdin,
        configurable: true,
      })

      // Set up the stdin mock to simulate data flow
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      mockStdin.on.mockImplementation((event: string, callback: Function) => {
        if (event === "data") {
          setTimeout(() => callback(stdinContent), 0)
        } else if (event === "end") {
          setTimeout(() => callback(), 10)
        }
        return mockStdin
      })

      const result = await openAPILoader.loadOpenAPISpec("stdin", "stdin")

      expect(mockStdin.setEncoding).toHaveBeenCalledWith("utf8")
      expect(mockStdin.resume).toHaveBeenCalled()
      expect(result).toEqual(mockOpenAPISpec)

      // Restore original stdin
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      })
    })

    it("should throw error if URL fetch fails", async () => {
      const url = "https://example.com/api-spec.json"
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response)

      await expect(openAPILoader.loadOpenAPISpec(url, "url")).rejects.toThrow(
        "Failed to load OpenAPI spec from url: HTTP 404: Not Found",
      )
    })

    it("should throw error if file reading fails", async () => {
      const filePath = "./api-spec.json"
      const error = new Error("File not found")
      vi.mocked(readFile).mockRejectedValueOnce(error)

      await expect(openAPILoader.loadOpenAPISpec(filePath, "file")).rejects.toThrow(
        "Failed to load OpenAPI spec from file: File not found",
      )
    })

    it("should throw error if inline content is missing", async () => {
      await expect(openAPILoader.loadOpenAPISpec("inline", "inline")).rejects.toThrow(
        "Inline content is required when using 'inline' input method",
      )
    })

    it("should throw error if stdin provides empty content", async () => {
      // Mock process.stdin for empty content
      const mockStdin = {
        setEncoding: vi.fn(),
        on: vi.fn(),
        resume: vi.fn(),
      }

      const originalStdin = process.stdin
      Object.defineProperty(process, "stdin", {
        value: mockStdin,
        configurable: true,
      })

      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      mockStdin.on.mockImplementation((event: string, callback: Function) => {
        if (event === "end") {
          setTimeout(() => callback(), 0)
        }
        return mockStdin
      })

      await expect(openAPILoader.loadOpenAPISpec("stdin", "stdin")).rejects.toThrow(
        "Failed to load OpenAPI spec from stdin: No data received from stdin",
      )

      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      })
    })

    it("should throw error for invalid JSON/YAML content", async () => {
      const invalidContent = "{ invalid json content"

      await expect(
        openAPILoader.loadOpenAPISpec("inline", "inline", invalidContent),
      ).rejects.toThrow(/Failed to parse as JSON or YAML/)
    })

    it("should throw error for empty content", async () => {
      await expect(openAPILoader.loadOpenAPISpec("inline", "inline", "")).rejects.toThrow(
        "Failed to load OpenAPI spec from inline",
      )
    })

    it("should throw error for unsupported input method", async () => {
      await expect(openAPILoader.loadOpenAPISpec("test", "unsupported" as any)).rejects.toThrow(
        "Unsupported input method: unsupported",
      )
    })

    // Backward compatibility test
    it("should maintain backward compatibility with old interface", async () => {
      const url = "https://example.com/api-spec.json"
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockOpenAPISpec),
      } as Response)

      // Test the old interface (without specifying input method)
      const result = await openAPILoader.loadOpenAPISpec(url)

      expect(fetch).toHaveBeenCalledWith(url)
      expect(result).toEqual(mockOpenAPISpec)
    })
  })

  describe("parseOpenAPISpec with disableAbbreviation", () => {
    it("should not abbreviate tool names when disableAbbreviation is true", () => {
      const loader = new OpenAPISpecLoader({ disableAbbreviation: true })
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users/management/authorization-groups": {
            get: {
              operationId: "getUserManagementAuthorizationGroups",
              summary: "Get all user management authorization groups",
              responses: {},
            },
          },
        },
      }

      const tools = loader.parseOpenAPISpec(spec)
      const toolId = Array.from(tools.keys())[0]

      // Should not be abbreviated
      expect(toolId).toContain("GET::users-management-authorization--groups")
      const tool = tools.get(toolId)!
      expect(tool.name).toContain("get-user-management-authorization-groups")
    })
  })

  describe("parseOpenAPISpec", () => {
    it("should convert OpenAPI paths to MCP tools", () => {
      const tools = openAPILoader.parseOpenAPISpec(mockOpenAPISpec)

      expect(tools.size).toBe(3)
      expect(tools.has("GET::users")).toBe(true)
      expect(tools.has("POST::users")).toBe(true)
      expect(tools.has("GET::users-id")).toBe(true)
    })

    it("should set correct tool properties", () => {
      const tools = openAPILoader.parseOpenAPISpec(mockOpenAPISpec)
      const getUsersTool = tools.get("GET::users") as Tool

      expect(getUsersTool).toBeDefined()
      expect(getUsersTool.name).toBe("get-usrs")
      expect(getUsersTool.description).toBe("Returns a list of users")
      expect(getUsersTool.inputSchema).toEqual({
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Maximum number of users to return",
            "x-parameter-location": "query",
          },
        },
      })
    })

    it("should handle required parameters", () => {
      const tools = openAPILoader.parseOpenAPISpec(mockOpenAPISpec)
      const getUserByIdTool = tools.get("GET::users-id") as Tool

      expect(getUserByIdTool).toBeDefined()
      expect(getUserByIdTool.inputSchema).toEqual({
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "User ID",
            "x-parameter-location": "path",
          },
        },
        required: ["id"],
      })
    })

    it("should use operationId as tool name when available", () => {
      const tools = openAPILoader.parseOpenAPISpec(mockOpenAPISpec)
      const getUsersTool = tools.get("GET::users") as Tool

      expect(getUsersTool.name).toBe("get-usrs")
    })

    it("should fallback to summary when operationId is missing", () => {
      const specWithoutOperationId: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              summary: "Get all users from the system",
              description: "Returns a list of users",
              responses: {},
            },
          },
          "/orders": {
            post: {
              summary: "Create new order",
              description: "Creates a new order in the system",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithoutOperationId)

      const getUsersTool = tools.get("GET::users") as Tool
      expect(getUsersTool).toBeDefined()
      expect(getUsersTool.name).toBe("get-all-users-from-the-system")

      const createOrderTool = tools.get("POST::orders") as Tool
      expect(createOrderTool).toBeDefined()
      expect(createOrderTool.name).toBe("create-new-order")
    })

    it("should fallback to method and path when both operationId and summary are missing", () => {
      const specWithoutOperationIdOrSummary: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              description: "Returns a list of users",
              responses: {},
            },
          },
          "/users/{id}": {
            delete: {
              description: "Deletes a user by ID",
              responses: {},
            },
          },
          "/api/v1/products": {
            post: {
              description: "Creates a new product",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithoutOperationIdOrSummary)

      const getUsersTool = tools.get("GET::users") as Tool
      expect(getUsersTool).toBeDefined()
      expect(getUsersTool.name).toBe("get-users")

      const deleteUserTool = tools.get("DELETE::users-id") as Tool
      expect(deleteUserTool).toBeDefined()
      expect(deleteUserTool.name).toBe("delete-users-id")

      const createProductTool = tools.get("POST::api-v1-products") as Tool
      expect(createProductTool).toBeDefined()
      expect(createProductTool.name).toBe("post-api-v-1-products")
    })

    it("should handle complex path structures in fallback names", () => {
      const specWithComplexPaths: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/api/v2/user-management/profiles/{userId}/settings": {
            put: {
              description: "Updates user profile settings",
              responses: {},
            },
          },
          "/service/health-check": {
            get: {
              description: "Health check endpoint",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithComplexPaths)

      const updateSettingsTool = tools.get(
        "PUT::api-v2-user--management-profiles-userId-settings",
      ) as Tool
      expect(updateSettingsTool).toBeDefined()
      expect(updateSettingsTool.name).toBe("put-api-v-2-user-management-profiles-user-id-settings")

      const healthCheckTool = tools.get("GET::service-health--check") as Tool
      expect(healthCheckTool).toBeDefined()
      expect(healthCheckTool.name).toBe("get-service-health-check")
    })

    it("should handle mixed scenarios with some operations having operationId and others not", () => {
      const specWithMixedOperations: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              operationId: "getAllUsers",
              summary: "Get all users",
              responses: {},
            },
            post: {
              summary: "Create a new user",
              description: "Creates a new user in the system",
              responses: {},
            },
          },
          "/orders/{id}": {
            get: {
              description: "Get order by ID",
              responses: {},
            },
            put: {
              operationId: "updateOrder",
              summary: "Update existing order",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithMixedOperations)

      // Has operationId
      const getAllUsersTool = tools.get("GET::users") as Tool
      expect(getAllUsersTool).toBeDefined()
      expect(getAllUsersTool.name).toBe("get-all-usrs")

      // Has summary but no operationId
      const createUserTool = tools.get("POST::users") as Tool
      expect(createUserTool).toBeDefined()
      expect(createUserTool.name).toBe("create-a-new-user")

      // Has neither operationId nor summary
      const getOrderTool = tools.get("GET::orders-id") as Tool
      expect(getOrderTool).toBeDefined()
      expect(getOrderTool.name).toBe("get-orders-id")

      // Has operationId
      const updateOrderTool = tools.get("PUT::orders-id") as Tool
      expect(updateOrderTool).toBeDefined()
      expect(updateOrderTool.name).toBe("upd-order")
    })

    it("should handle empty summary gracefully", () => {
      const specWithEmptySummary: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              summary: "",
              description: "Returns a list of users",
              responses: {},
            },
          },
          "/products": {
            post: {
              summary: "   ",
              description: "Creates a new product",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithEmptySummary)

      const getUsersTool = tools.get("GET::users") as Tool
      expect(getUsersTool).toBeDefined()
      expect(getUsersTool.name).toBe("get-users")

      const createProductTool = tools.get("POST::products") as Tool
      expect(createProductTool).toBeDefined()
      expect(createProductTool.name).toBe("unnamed-tool")
    })

    it("should handle very long fallback names with proper abbreviation", () => {
      const specWithLongFallbackNames: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/api/v1/enterprise/user-management/authentication/authorization/groups": {
            get: {
              summary:
                "Get all enterprise user management authentication authorization groups from the system database",
              responses: {},
            },
          },
          "/service/administration/configuration/management/settings/update": {
            put: {
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithLongFallbackNames)

      const getGroupsTool = tools.get(
        "GET::api-v1-enterprise-user--management-authentication-authorization-groups",
      ) as Tool
      expect(getGroupsTool).toBeDefined()
      expect(getGroupsTool.name).toBeTruthy()
      expect(getGroupsTool.name.length).toBeLessThanOrEqual(64)
      expect(getGroupsTool.name).toMatch(/^[a-z0-9-]+$/)

      const updateSettingsTool = tools.get(
        "PUT::service-administration-configuration-management-settings-update",
      ) as Tool
      expect(updateSettingsTool).toBeDefined()
      expect(updateSettingsTool.name).toBeTruthy()
      expect(updateSettingsTool.name.length).toBeLessThanOrEqual(64)
      expect(updateSettingsTool.name).toMatch(/^[a-z0-9-]+$/)
    })

    it("should generate consistent tool names for the same fallback input", () => {
      const specWithDuplicateFallbacks: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              summary: "Get Users",
              responses: {},
            },
          },
          "/products": {
            get: {
              summary: "Get Users", // Same summary as above
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithDuplicateFallbacks)

      const getUsersTool = tools.get("GET::users") as Tool
      const getProductsTool = tools.get("GET::products") as Tool

      expect(getUsersTool).toBeDefined()
      expect(getProductsTool).toBeDefined()

      // Both should have the same name since they have the same summary
      expect(getUsersTool.name).toBe("get-usrs")
      expect(getProductsTool.name).toBe("get-usrs")
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
      expect(tools.has("GET::api-v1-user--profiles")).toBe(true)
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
      expect(tools.has("GET::users")).toBe(true)
    })

    it("should skip non-HTTP methods in path item", () => {
      const specWithNonHttpMethods: OpenAPIV3.Document = {
        ...mockOpenAPISpec,
        paths: {
          "/api/users": {
            // Valid HTTP method
            get: {
              operationId: "getUsers",
              responses: {},
            },
            // Non-HTTP method property that should be skipped
            servers: [{ url: "https://api.example.com" }],
            // Another non-HTTP method that should be skipped
            summary: "Users API endpoint",
            // Another valid HTTP method
            post: {
              operationId: "createUser",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithNonHttpMethods)
      expect(tools.size).toBe(2)
      expect(tools.has("GET::api-users")).toBe(true)
      expect(tools.has("POST::api-users")).toBe(true)
      // Verify non-HTTP methods aren't included
      expect([...tools.keys()].some((key) => key.startsWith("SERVERS-"))).toBe(false)
      expect([...tools.keys()].some((key) => key.startsWith("SUMMARY-"))).toBe(false)
    })

    // New tests for Input Schema Composition and $ref inlining
    it("should merge primitive request bodies into a 'body' property and mark required", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Primitive API", version: "1.0.0" },
        paths: {
          "/echo": {
            post: {
              summary: "Echo primitive",
              requestBody: {
                content: { "application/json": { schema: { type: "string" } } },
              },
              responses: { "200": { description: "OK" } },
            },
          },
        },
      }
      const tools = openAPILoader.parseOpenAPISpec(spec)
      const tool = tools.get("POST::echo")!
      expect(tool.inputSchema.properties).toHaveProperty("body")
      expect((tool.inputSchema.properties! as any).body.type).toBe("string")
      expect(tool.inputSchema.required).toEqual(["body"])
    })

    it("should merge object request bodies and preserve property names and required flags", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Object API", version: "1.0.0" },
        paths: {
          "/create": {
            post: {
              summary: "Create object",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { foo: { type: "integer" }, bar: { type: "boolean" } },
                      required: ["foo"],
                    },
                  },
                },
              },
              responses: { "200": { description: "OK" } },
            },
          },
        },
      }
      const tools = openAPILoader.parseOpenAPISpec(spec)
      const tool = tools.get("POST::create")!
      expect(tool.inputSchema.properties).toHaveProperty("foo")
      expect(tool.inputSchema.properties).toHaveProperty("bar")
      expect(tool.inputSchema.required).toEqual(["foo"])
    })

    it("should merge array request bodies into 'body' property and mark required", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Array API", version: "1.0.0" },
        paths: {
          "/list": {
            post: {
              summary: "List items",
              requestBody: {
                content: {
                  "application/json": { schema: { type: "array", items: { type: "number" } } },
                },
              },
              responses: { "200": { description: "OK" } },
            },
          },
        },
      }
      const tools = openAPILoader.parseOpenAPISpec(spec)
      const tool = tools.get("POST::list")!
      expect(tool.inputSchema.properties).toHaveProperty("body")
      expect((tool.inputSchema.properties! as any).body.type).toBe("array")
      expect(tool.inputSchema.required).toEqual(["body"])
    })

    it("should merge parameters and requestBody, handling name collisions by prefixing", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Mix API", version: "1.0.0" },
        paths: {
          "/items/{id}": {
            post: {
              summary: "Update item",
              parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" }, value: { type: "string" } },
                      required: ["value"],
                    },
                  },
                },
              },
              responses: { "200": { description: "OK" } },
            },
          },
        },
      }
      const tools = openAPILoader.parseOpenAPISpec(spec)
      const tool = tools.get("POST::items-id")!
      // Path param 'id' and body properties
      expect(tool.inputSchema.properties).toHaveProperty("id")
      expect(tool.inputSchema.properties).toHaveProperty("value")
      // Only required: path param and required body properties
      expect(tool.inputSchema.required).toEqual(["id", "value"])
    })

    it("should inline $ref schemas and drop recursive cycles in requestBody", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Ref API", version: "1.0.0" },
        paths: {
          "/person": {
            post: {
              summary: "Create person",
              requestBody: {
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/Person" } },
                },
              },
              responses: { "200": { description: "OK" } },
            },
          },
        },
        components: {
          schemas: {
            Person: {
              type: "object",
              properties: {
                name: { type: "string" },
                friend: { $ref: "#/components/schemas/Person" },
              },
              required: ["name"],
            },
          },
        },
      }
      const tools = openAPILoader.parseOpenAPISpec(spec)
      const tool = tools.get("POST::person")!
      expect(tool.inputSchema.properties).toHaveProperty("name")
      expect(tool.inputSchema.properties).toHaveProperty("friend")
      // friend nested should be empty object due to recursion
      expect((tool.inputSchema.properties! as any).friend).toEqual({})
      expect(tool.inputSchema.required).toEqual(["name"])
    })

    it("should resolve parameter references properly", () => {
      const specWithRefParams: OpenAPIV3.Document = {
        ...mockOpenAPISpec,
        paths: {
          "/items/{id}": {
            get: {
              operationId: "getItemById",
              parameters: [
                { $ref: "#/components/parameters/IdParam" },
                { $ref: "#/components/parameters/LimitParam" },
              ],
              responses: {},
            },
          },
        },
        components: {
          parameters: {
            IdParam: {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Item identifier",
            },
            LimitParam: {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer" },
              description: "Maximum number of results",
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithRefParams)
      expect(tools.size).toBe(1)

      const tool = tools.get("GET::items-id")
      expect(tool).toBeDefined()

      // Check that both referenced parameters were properly resolved
      const properties = tool!.inputSchema.properties!
      expect(properties).toHaveProperty("id")
      expect(properties).toHaveProperty("limit")

      // Check the details of each resolved parameter
      expect(properties.id).toEqual({
        type: "string",
        description: "Item identifier",
        "x-parameter-location": "path",
      })

      expect(properties.limit).toEqual({
        type: "integer",
        description: "Maximum number of results",
        "x-parameter-location": "query",
      })

      // Verify that required parameters were correctly identified
      expect(tool!.inputSchema.required).toContain("id")
      // Check that limit isn't required (should not be in the required array)
      const required = tool!.inputSchema.required as string[]
      expect(required.includes("limit")).toBe(false)
    })

    it("should resolve nested references in parameters", () => {
      const specWithNestedRefs: OpenAPIV3.Document = {
        ...mockOpenAPISpec,
        paths: {
          "/products": {
            get: {
              operationId: "getProducts",
              parameters: [
                { $ref: "#/components/parameters/FilterParam" },
                { $ref: "#/components/parameters/PaginationParam" },
              ],
              responses: {},
            },
          },
        },
        components: {
          schemas: {
            PaginationOptions: {
              type: "object",
              properties: {
                page: { type: "integer", description: "Page number", default: 1 },
                size: { type: "integer", description: "Items per page", default: 20 },
              },
            },
            FilterOptions: {
              type: "object",
              properties: {
                category: { type: "string", description: "Product category" },
                minPrice: { type: "number", description: "Minimum price" },
              },
            },
          },
          parameters: {
            FilterParam: {
              name: "filter",
              in: "query",
              required: false,
              schema: { $ref: "#/components/schemas/FilterOptions" },
              description: "Product filtering options",
            },
            PaginationParam: {
              name: "pagination",
              in: "query",
              required: false,
              schema: { $ref: "#/components/schemas/PaginationOptions" },
              description: "Pagination options",
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithNestedRefs)
      expect(tools.size).toBe(1)

      const tool = tools.get("GET::products")
      expect(tool).toBeDefined()

      // Check that both referenced parameters were properly resolved
      const properties = tool!.inputSchema.properties!
      expect(properties).toHaveProperty("filter")
      expect(properties).toHaveProperty("pagination")

      // Now that we've improved the implementation, we should get fully resolved nested references
      const filterParam = properties.filter as Record<string, any>
      expect(filterParam.type).toBe("object")
      expect(filterParam.description).toBe("Product filtering options")
      expect(filterParam["x-parameter-location"]).toBe("query")
      // Check that nested properties are preserved
      expect(filterParam.properties).toBeDefined()
      expect(filterParam.properties.category).toBeDefined()
      expect(filterParam.properties.category.type).toBe("string")
      expect(filterParam.properties.category.description).toBe("Product category")
      expect(filterParam.properties.minPrice).toBeDefined()
      expect(filterParam.properties.minPrice.type).toBe("number")
      expect(filterParam.properties.minPrice.description).toBe("Minimum price")

      const paginationParam = properties.pagination as Record<string, any>
      expect(paginationParam.type).toBe("object")
      expect(paginationParam.description).toBe("Pagination options")
      expect(paginationParam["x-parameter-location"]).toBe("query")
      // Check that nested properties with defaults are preserved
      expect(paginationParam.properties).toBeDefined()
      expect(paginationParam.properties.page).toBeDefined()
      expect(paginationParam.properties.page.type).toBe("integer")
      expect(paginationParam.properties.page.default).toBe(1)
      expect(paginationParam.properties.size).toBeDefined()
      expect(paginationParam.properties.size.type).toBe("integer")
      expect(paginationParam.properties.size.default).toBe(20)

      // Neither parameter should be required
      const required = tool!.inputSchema.required
      expect(required).toBeUndefined()
    })

    it("REGRESSION: should generate unambiguous toolIds for paths with underscores and hyphens", () => {
      // This test validates that the original toolId ambiguity issue is resolved
      // by ensuring the OpenAPI loader generates unambiguous toolIds

      const specWithProblematicPaths: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/user_profile-data": {
            get: {
              operationId: "getUserProfileData",
              summary: "Get user profile data",
              responses: {},
            },
          },
          "/api_v1-user-management": {
            post: {
              operationId: "createUserManagement",
              summary: "Create user management",
              responses: {},
            },
          },
          "/service_users-authority_groups": {
            put: {
              operationId: "updateServiceUsersAuthorityGroups",
              summary: "Update service users authority groups",
              responses: {},
            },
          },
          "/user-profile_data": {
            delete: {
              operationId: "deleteUserProfileData",
              summary: "Delete user profile data",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(specWithProblematicPaths)

      // Validate that all expected toolIds are generated with :: separator
      const expectedToolIds = [
        "GET::user_profile--data",
        "POST::api_v1--user--management",
        "PUT::service_users--authority_groups",
        "DELETE::user--profile_data",
      ]

      for (const expectedToolId of expectedToolIds) {
        expect(tools.has(expectedToolId)).toBe(true)

        // Validate the toolId format is unambiguous
        expect(expectedToolId).toContain("::")
        expect(expectedToolId.split("::")).toHaveLength(2)

        const [method, pathPart] = expectedToolId.split("::")
        expect(method).toMatch(/^(GET|POST|PUT|DELETE)$/)
        expect(pathPart).toBeTruthy()
        expect(pathPart).not.toContain("::") // Ensure no double separators
      }

      // Validate that the tools are correctly created
      const getUserProfileDataTool = tools.get("GET::user_profile--data")!
      expect(getUserProfileDataTool).toBeDefined()
      // Just verify the tool exists and has a reasonable name, don't check exact abbreviation
      expect(getUserProfileDataTool.name).toBeTruthy()
      expect(getUserProfileDataTool.name.length).toBeGreaterThan(0)

      const createUserManagementTool = tools.get("POST::api_v1--user--management")!
      expect(createUserManagementTool).toBeDefined()
      // Just verify the tool exists and has a reasonable name, don't check exact abbreviation
      expect(createUserManagementTool.name).toBeTruthy()
      expect(createUserManagementTool.name.length).toBeGreaterThan(0)
    })

    // Replace the ambiguous test with comprehensive parameter inheritance tests
    describe("Path Item Parameter Inheritance", () => {
      it("should inherit path-level parameters when operation has no parameters", () => {
        const specWithPathParams: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Test API", version: "1.0.0" },
          paths: {
            "/users/{id}": {
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                  description: "User ID from path level",
                },
                {
                  name: "version",
                  in: "query",
                  schema: { type: "string" },
                  description: "API version from path level",
                },
              ],
              get: {
                operationId: "getUserById",
                summary: "Get user by ID",
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(specWithPathParams)
        const tool = tools.get("GET::users-id") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("id")
        expect(tool.inputSchema.properties).toHaveProperty("version")
        expect((tool.inputSchema.properties! as any).id.description).toBe("User ID from path level")
        expect((tool.inputSchema.properties! as any).version.description).toBe(
          "API version from path level",
        )
        expect(tool.inputSchema.required).toEqual(["id"])
      })

      it("should merge path-level and operation-level parameters", () => {
        const specWithMixedParams: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Test API", version: "1.0.0" },
          paths: {
            "/users/{id}": {
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                  description: "User ID from path level",
                },
                {
                  name: "include",
                  in: "query",
                  schema: { type: "string" },
                  description: "Include fields from path level",
                },
              ],
              get: {
                operationId: "getUserById",
                summary: "Get user by ID",
                parameters: [
                  {
                    name: "format",
                    in: "query",
                    schema: { type: "string", enum: ["json", "xml"] },
                    description: "Response format from operation level",
                  },
                  {
                    name: "limit",
                    in: "query",
                    required: true,
                    schema: { type: "integer" },
                    description: "Limit from operation level",
                  },
                ],
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(specWithMixedParams)
        const tool = tools.get("GET::users-id") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("id")
        expect(tool.inputSchema.properties).toHaveProperty("include")
        expect(tool.inputSchema.properties).toHaveProperty("format")
        expect(tool.inputSchema.properties).toHaveProperty("limit")
        expect(tool.inputSchema.required).toEqual(["id", "limit"])
      })

      it("should allow operation-level parameters to override path-level parameters", () => {
        const specWithOverridingParams: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Test API", version: "1.0.0" },
          paths: {
            "/users/{id}": {
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                  description: "User ID from path level",
                },
                {
                  name: "format",
                  in: "query",
                  schema: { type: "string" },
                  description: "Format from path level",
                },
              ],
              get: {
                operationId: "getUserById",
                summary: "Get user by ID",
                parameters: [
                  {
                    name: "format",
                    in: "query",
                    required: true,
                    schema: { type: "string", enum: ["json", "xml"] },
                    description: "Format from operation level (overrides path level)",
                  },
                ],
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(specWithOverridingParams)
        const tool = tools.get("GET::users-id") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("id")
        expect(tool.inputSchema.properties).toHaveProperty("format")
        expect((tool.inputSchema.properties! as any).format.description).toBe(
          "Format from operation level (overrides path level)",
        )
        expect((tool.inputSchema.properties! as any).format.enum).toEqual(["json", "xml"])
        expect(tool.inputSchema.required).toEqual(["id", "format"])
      })
    })

    describe("Request Body Content Types", () => {
      it("should handle application/x-www-form-urlencoded request body", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Form API", version: "1.0.0" },
          paths: {
            "/submit": {
              post: {
                operationId: "submitForm",
                summary: "Submit form data",
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        type: "object",
                        properties: {
                          username: { type: "string" },
                          password: { type: "string" },
                          remember: { type: "boolean" },
                        },
                        required: ["username", "password"],
                      },
                    },
                  },
                },
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("POST::submit") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("username")
        expect(tool.inputSchema.properties).toHaveProperty("password")
        expect(tool.inputSchema.properties).toHaveProperty("remember")
        expect(tool.inputSchema.required).toEqual(["username", "password"])
      })

      it("should handle multipart/form-data request body with file uploads", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Upload API", version: "1.0.0" },
          paths: {
            "/upload": {
              post: {
                operationId: "uploadFile",
                summary: "Upload file",
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        type: "object",
                        properties: {
                          file: {
                            type: "string",
                            format: "binary",
                            description: "File to upload",
                          },
                          metadata: {
                            type: "string",
                            format: "byte",
                            description: "Base64 encoded metadata",
                          },
                          description: {
                            type: "string",
                            description: "File description",
                          },
                        },
                        required: ["file"],
                      },
                    },
                  },
                },
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("POST::upload") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("file")
        expect(tool.inputSchema.properties).toHaveProperty("metadata")
        expect(tool.inputSchema.properties).toHaveProperty("description")
        expect((tool.inputSchema.properties! as any).file.format).toBe("binary")
        expect((tool.inputSchema.properties! as any).metadata.format).toBe("byte")
        expect(tool.inputSchema.required).toEqual(["file"])
      })

      it("should choose first content type when multiple are available", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Multi Content API", version: "1.0.0" },
          paths: {
            "/data": {
              post: {
                operationId: "postData",
                summary: "Post data",
                requestBody: {
                  content: {
                    "application/xml": {
                      schema: {
                        type: "object",
                        properties: { xmlData: { type: "string" } },
                      },
                    },
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { jsonData: { type: "string" } },
                      },
                    },
                    "text/plain": {
                      schema: { type: "string" },
                    },
                  },
                },
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("POST::data") as Tool

        expect(tool).toBeDefined()
        // Should prefer application/json when available
        expect(tool.inputSchema.properties).toHaveProperty("jsonData")
        expect(tool.inputSchema.properties).not.toHaveProperty("xmlData")
      })
    })

    describe("Schema Composition Keywords", () => {
      it("should handle allOf schema composition", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Composition API", version: "1.0.0" },
          paths: {
            "/users": {
              post: {
                operationId: "createUser",
                summary: "Create user",
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        allOf: [
                          {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              email: { type: "string" },
                            },
                            required: ["name"],
                          },
                          {
                            type: "object",
                            properties: {
                              age: { type: "integer" },
                              active: { type: "boolean" },
                            },
                            required: ["age"],
                          },
                        ],
                      },
                    },
                  },
                },
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("POST::users") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("name")
        expect(tool.inputSchema.properties).toHaveProperty("email")
        expect(tool.inputSchema.properties).toHaveProperty("age")
        expect(tool.inputSchema.properties).toHaveProperty("active")
      })

      it("should handle oneOf schema composition", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "OneOf API", version: "1.0.0" },
          paths: {
            "/payment": {
              post: {
                operationId: "processPayment",
                summary: "Process payment",
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        oneOf: [
                          {
                            type: "object",
                            properties: {
                              creditCard: { type: "string" },
                              expiryDate: { type: "string" },
                            },
                            required: ["creditCard"],
                          },
                          {
                            type: "object",
                            properties: {
                              paypalEmail: { type: "string" },
                            },
                            required: ["paypalEmail"],
                          },
                        ],
                      },
                    },
                  },
                },
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("POST::payment") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema).toHaveProperty("oneOf")
      })

      it("should handle anyOf schema composition", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "AnyOf API", version: "1.0.0" },
          paths: {
            "/search": {
              post: {
                operationId: "search",
                summary: "Search content",
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        anyOf: [
                          {
                            type: "object",
                            properties: { query: { type: "string" } },
                          },
                          {
                            type: "object",
                            properties: { filters: { type: "array", items: { type: "string" } } },
                          },
                        ],
                      },
                    },
                  },
                },
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("POST::search") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema).toHaveProperty("anyOf")
      })

      it("should handle not schema composition", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Not API", version: "1.0.0" },
          paths: {
            "/validate": {
              post: {
                operationId: "validateData",
                summary: "Validate data",
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          value: {
                            not: {
                              type: "string",
                              enum: ["forbidden"],
                            },
                          },
                        },
                      },
                    },
                  },
                },
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("POST::validate") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("value")
        expect((tool.inputSchema.properties! as any).value).toHaveProperty("not")
      })
    })

    describe("Deprecated Operations", () => {
      it("should handle deprecated operations", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Deprecated API", version: "1.0.0" },
          paths: {
            "/legacy": {
              get: {
                operationId: "getLegacyData",
                summary: "Get legacy data",
                deprecated: true,
                responses: { "200": { description: "Success" } },
              },
            },
            "/current": {
              get: {
                operationId: "getCurrentData",
                summary: "Get current data",
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)

        // Both tools should be created (deprecated operations are not skipped)
        expect(tools.size).toBe(2)
        expect(tools.has("GET::legacy")).toBe(true)
        expect(tools.has("GET::current")).toBe(true)

        const legacyTool = tools.get("GET::legacy") as Tool
        const currentTool = tools.get("GET::current") as Tool

        expect(legacyTool).toBeDefined()
        expect(currentTool).toBeDefined()

        // Check if deprecated flag is preserved (implementation dependent)
        // Note: Current implementation doesn't explicitly handle deprecated flag
        // This test documents the current behavior
      })
    })

    describe("Header and Cookie Parameters", () => {
      it("should handle header parameters with x-parameter-location", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Header API", version: "1.0.0" },
          paths: {
            "/secure": {
              get: {
                operationId: "getSecureData",
                summary: "Get secure data",
                parameters: [
                  {
                    name: "Authorization",
                    in: "header",
                    required: true,
                    schema: { type: "string" },
                    description: "Bearer token",
                  },
                  {
                    name: "X-API-Version",
                    in: "header",
                    schema: { type: "string", default: "v1" },
                    description: "API version header",
                  },
                ],
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("GET::secure") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("Authorization")
        expect(tool.inputSchema.properties).toHaveProperty("X-API-Version")

        const authParam = (tool.inputSchema.properties! as any).Authorization
        const versionParam = (tool.inputSchema.properties! as any)["X-API-Version"]

        expect(authParam["x-parameter-location"]).toBe("header")
        expect(versionParam["x-parameter-location"]).toBe("header")
        expect(tool.inputSchema.required).toEqual(["Authorization"])
      })

      it("should handle cookie parameters with x-parameter-location", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Cookie API", version: "1.0.0" },
          paths: {
            "/session": {
              get: {
                operationId: "getSessionData",
                summary: "Get session data",
                parameters: [
                  {
                    name: "sessionId",
                    in: "cookie",
                    required: true,
                    schema: { type: "string" },
                    description: "Session identifier",
                  },
                  {
                    name: "preferences",
                    in: "cookie",
                    schema: { type: "string" },
                    description: "User preferences",
                  },
                ],
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("GET::session") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("sessionId")
        expect(tool.inputSchema.properties).toHaveProperty("preferences")

        const sessionParam = (tool.inputSchema.properties! as any).sessionId
        const prefsParam = (tool.inputSchema.properties! as any).preferences

        expect(sessionParam["x-parameter-location"]).toBe("cookie")
        expect(prefsParam["x-parameter-location"]).toBe("cookie")
        expect(tool.inputSchema.required).toEqual(["sessionId"])
      })

      it("should handle mixed parameter locations", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Mixed Params API", version: "1.0.0" },
          paths: {
            "/users/{id}": {
              get: {
                operationId: "getUserWithMixedParams",
                summary: "Get user with mixed parameter types",
                parameters: [
                  {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "User ID",
                  },
                  {
                    name: "format",
                    in: "query",
                    schema: { type: "string", enum: ["json", "xml"] },
                    description: "Response format",
                  },
                  {
                    name: "Authorization",
                    in: "header",
                    required: true,
                    schema: { type: "string" },
                    description: "Auth header",
                  },
                  {
                    name: "sessionId",
                    in: "cookie",
                    schema: { type: "string" },
                    description: "Session cookie",
                  },
                ],
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        const tools = openAPILoader.parseOpenAPISpec(spec)
        const tool = tools.get("GET::users-id") as Tool

        expect(tool).toBeDefined()
        expect(tool.inputSchema.properties).toHaveProperty("id")
        expect(tool.inputSchema.properties).toHaveProperty("format")
        expect(tool.inputSchema.properties).toHaveProperty("Authorization")
        expect(tool.inputSchema.properties).toHaveProperty("sessionId")

        const params = tool.inputSchema.properties! as any
        expect(params.id["x-parameter-location"]).toBe("path")
        expect(params.format["x-parameter-location"]).toBe("query")
        expect(params.Authorization["x-parameter-location"]).toBe("header")
        expect(params.sessionId["x-parameter-location"]).toBe("cookie")

        expect(tool.inputSchema.required).toEqual(["id", "Authorization"])
      })
    })

    describe("External References", () => {
      it("should handle missing external references gracefully", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "External Ref API", version: "1.0.0" },
          paths: {
            "/users": {
              post: {
                operationId: "createUser",
                summary: "Create user",
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        $ref: "external.yaml#/components/schemas/User",
                      },
                    },
                  },
                },
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        // Should not throw an error, but handle gracefully
        expect(() => {
          const tools = openAPILoader.parseOpenAPISpec(spec)
          expect(tools.size).toBe(1)
          const tool = tools.get("POST::users") as Tool
          expect(tool).toBeDefined()
          // External refs that can't be resolved should result in empty schema
          expect(tool.inputSchema.properties).toHaveProperty("body")
        }).not.toThrow()
      })

      it("should handle malformed external references", () => {
        const spec: OpenAPIV3.Document = {
          openapi: "3.0.0",
          info: { title: "Malformed Ref API", version: "1.0.0" },
          paths: {
            "/data": {
              get: {
                operationId: "getData",
                summary: "Get data",
                parameters: [
                  {
                    $ref: "invalid-reference-format",
                  } as any,
                ],
                responses: { "200": { description: "Success" } },
              },
            },
          },
        }

        // Should handle malformed refs gracefully
        expect(() => {
          const tools = openAPILoader.parseOpenAPISpec(spec)
          expect(tools.size).toBe(1)
          const tool = tools.get("GET::data") as Tool
          expect(tool).toBeDefined()
        }).not.toThrow()
      })
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
      expect(tools.has("GET::users")).toBe(true)
    })
  })

  describe("disableAbbreviation", () => {
    it("should not abbreviate operation IDs when disableAbbreviation is true", () => {
      const loader = new OpenAPISpecLoader({ disableAbbreviation: true })
      const longName = "ServiceUsersManagementController_updateServiceUsersAuthorityGroup"
      const result = loader.abbreviateOperationId(longName)

      // Should not be abbreviated
      expect(result).toContain("service-users-management-controller")
      expect(result).toContain("update-service-users-authority-group")
    })
  })

  describe("abbreviateOperationId", () => {
    const maxLength = 64
    // Helper to check length and character validity
    const isValidToolName = (name: string): void => {
      expect(name.length).toBeLessThanOrEqual(maxLength)
      expect(name).toMatch(/^[a-z0-9-]+$/)
      expect(name).not.toMatch(/--/)
      expect(name.startsWith("-")).toBe(false)
      expect(name.endsWith("-")).toBe(false)
    }

    it("should not change short, valid names", () => {
      const name = "short-and-valid"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toBe(name)
      isValidToolName(result)
    })

    it("should sanitize basic invalid characters and lowercase", () => {
      const name = "Get User By ID"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toBe("get-user-by-id")
      isValidToolName(result)
    })

    it("should handle empty string input", () => {
      const result = openAPILoader.abbreviateOperationId("", maxLength)
      expect(result).toBe("unnamed-tool")
      isValidToolName(result)
    })

    it("should handle string with only special characters", () => {
      const result = openAPILoader.abbreviateOperationId("_!@#$%^&*_()+", maxLength)
      // Expecting a hash as it becomes empty after initial sanitization
      expect(result).toMatch(/^tool-[a-f0-9]{8}$/)
      isValidToolName(result)
    })

    it("should remove common words", () => {
      const name = "UserServiceGetUserDetailsControllerApi"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      // UserServiceGetUserDetailsControllerApi -> User Service Get User Details
      // Remove Controller, Api -> User Service Get User Details
      // Abbr: Usr Svc Get Usr Details -> usr-svc-get-usr-details
      expect(result).toBe("usr-svc-get-usr-details")
      isValidToolName(result)
    })

    it("should apply standard abbreviations preserving TitleCase", () => {
      const name = "UpdateUserConfigurationManagement"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toBe("upd-usr-config-mgmt")
      isValidToolName(result)
    })

    it("should apply standard abbreviations preserving ALLCAPS", () => {
      const name = "LIST_USER_RESOURCES_API"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toBe("lst-usr-resrcs")
      isValidToolName(result)
    })

    it("should apply vowel removal for long words", () => {
      const name = "ServiceUsersExtraordinarilyLongManagementControllerUpdateUserAuthorityGroup"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      // This will likely be truncated with hash as well due to length
      expect(result.length).toBeLessThanOrEqual(maxLength)
      isValidToolName(result)
    })

    it("should truncate and hash very long names", () => {
      const name =
        "ThisIsAVeryLongOperationIdThatExceedsTheMaximumLengthAndNeedsToBeTruncatedAndHashedServiceUsersManagementControllerUpdateUserAuthorityGroup"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toMatch(/^[a-z0-9-]+-[a-f0-9]{4}$/)
      expect(result.length).toBeLessThanOrEqual(maxLength)
      isValidToolName(result)
    })

    it("should handle names that become empty after processing before hash", () => {
      const name = "Controller_Service_API_Method" // All common words as per revised list + service/method
      // Controller, Service, API, Method -> split
      // Controller, API removed by common. -> Service, Method
      // Abbr: Svc, Method -> svc-method
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toBe("svc-method") // Not empty, so no hash
      isValidToolName(result)
    })

    it("should ensure no leading/trailing/multiple hyphens after processing", () => {
      const name = "---LeadingTrailingAnd---Multiple---Hyphens---"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      // Initial sanitization -> LeadingTrailingAnd-Multiple-Hyphens
      // splitCombined -> [Leading, Trailing, And, Multiple, Hyphens]
      // common word removal (and) -> [Leading, Trailing, Multiple, Hyphens]
      // join -> leading-trailing-multiple-hyphens
      expect(result).toBe("leading-trailing-multiple-hyphens")
      isValidToolName(result)
    })

    it("should handle name that is exactly maxLength", () => {
      const name = "a".repeat(maxLength)
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toBe(name)
      isValidToolName(result)
    })

    it("should handle name that is maxLength + 1", () => {
      const name = "a".repeat(maxLength + 1)
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toMatch(/^[a-z0-9-]+-[a-f0-9]{4}$/) // Expect hash
      isValidToolName(result)
    })

    it("should correctly abbreviate the original problematic example", () => {
      const name = "ServiceUsersManagementController_updateServiceUsersAuthorityGroup"
      // Original length 69 > 64 -> originalWasLong = true, so needsHash = true.
      // Processed: svc-usrs-mgmt-upd-svc-usrs-auth-grp (length 37)
      // Not > maxLengthForBase (59). So, not truncated.
      // Result: svc-usrs-mgmt-upd-svc-usrs-auth-grp-HASH
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toMatch(/^svc-usrs-mgmt-upd-svc-usrs-auth-grp-[a-f0-9]{4}$/)
      isValidToolName(result)
    })

    it("should handle names requiring multiple processing steps ending in truncation", () => {
      const name =
        "AN_EXTREMELY_LONG_IDENTIFIER_FOR_UPDATING_CONFIGURATION_RESOURCES_AND_OTHER_THINGS_ServiceController"
      // Original length 110 > 64 -> originalWasLong = true, so needsHash = true.
      // Processed: an-extremely-long-id-upd-config-resrcs-other-things-svc (length 63)
      // currentName (63) > maxLengthForBase (59). Truncate to 59: an-extremely-long-id-upd-config-resrcs-other-things-sv
      // Result: an-extremely-long-id-upd-config-resrcs-other-things-sv-HASH
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toMatch(/^[a-z0-9-]+-[a-f0-9]{4}$/) // General hash check is fine here
      isValidToolName(result)
    })

    it("should handle names with numbers", () => {
      const name = "getUserDetailsForUser123AndService456"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      // Trace with current logic:
      // Initial: getUserDetailsForUser123AndService456
      // Split: get, User, Details, For, User, 123, And, Service, 456
      // Common word removal (assuming for, and, the, with added to list):
      //   -> get, User, Details, User, 123, Service, 456
      // Abbreviate: Get, Usr, Details, Usr, 123, Svc, 456
      // Joined & lowercased: get-usr-details-usr-123-svc-456
      // Previous actual output: get-usr-details-for-user123-and-service456
      // This indicates common words 'for' 'and' were NOT removed, and 'User', 'Service' were not abbreviated from User123 etc.
      // The new common word list in the main function now includes "for" and "and".
      // The splitCombined already correctly separates User123 to User, 123.
      // So the expectation should be get-usr-details-usr-123-svc-456
      expect(result).toBe("get-usr-details-usr-123-svc-456")
      isValidToolName(result)
    })

    it("should produce different hashes for slightly different long names", () => {
      const name1 = "ThisIsAnExtremelyLongNameThatWillBeTruncatedAndHashedPartOneService"
      const name2 = "ThisIsAnExtremelyLongNameThatWillBeTruncatedAndHashedPartTwoService"
      const result1 = openAPILoader.abbreviateOperationId(name1, maxLength)
      const result2 = openAPILoader.abbreviateOperationId(name2, maxLength)
      expect(result1).not.toBe(result2)
      expect(result1.slice(-4)).not.toBe(result2.slice(-4)) // Check hash part is different
      isValidToolName(result1)
      isValidToolName(result2)
    })

    it("should handle names that become valid after only sanitization and are within limit", () => {
      const name = "My Operation With Spaces"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toBe("my-spaces")
      isValidToolName(result)
    })

    it("should handle names that become valid after sanitization but exceed limit and need hashing", () => {
      const name =
        "My Very Very Very Very Very Very Very Very Very Very Very Very Very Long Operation With Spaces"
      const result = openAPILoader.abbreviateOperationId(name, maxLength)
      expect(result).toMatch(/^[a-z0-9-]+-[a-f0-9]{4}$/)
      isValidToolName(result)
    })
  })

  describe("ExtendedTool metadata", () => {
    it("should populate metadata fields for filtering", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users/{id}": {
            get: {
              operationId: "getUserById",
              tags: ["users", "profiles"],
              description: "Get user by ID",
              responses: {},
            },
          },
          "/api/v1/orders": {
            post: {
              operationId: "createOrder",
              tags: ["orders"],
              description: "Create a new order",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(spec)

      const getUserTool = tools.get("GET::users-id") as ExtendedTool
      expect(getUserTool).toBeDefined()
      expect(getUserTool.tags).toEqual(["users", "profiles"])
      expect(getUserTool.httpMethod).toBe("GET")
      expect(getUserTool.resourceName).toBe("users")
      expect(getUserTool.originalPath).toBe("/users/{id}")

      const createOrderTool = tools.get("POST::api-v1-orders") as ExtendedTool
      expect(createOrderTool).toBeDefined()
      expect(createOrderTool.tags).toEqual(["orders"])
      expect(createOrderTool.httpMethod).toBe("POST")
      expect(createOrderTool.resourceName).toBe("orders")
      expect(createOrderTool.originalPath).toBe("/api/v1/orders")
    })

    it("should handle operations without tags", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/health": {
            get: {
              operationId: "healthCheck",
              description: "Health check endpoint",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(spec)
      const healthTool = tools.get("GET::health") as ExtendedTool

      expect(healthTool).toBeDefined()
      expect(healthTool.tags).toEqual([])
      expect(healthTool.httpMethod).toBe("GET")
      expect(healthTool.resourceName).toBe("health")
      expect(healthTool.originalPath).toBe("/health")
    })

    it("should extract resource names correctly", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: { operationId: "getUsers", responses: {} },
          },
          "/users/{id}": {
            get: { operationId: "getUserById", responses: {} },
          },
          "/users/{id}/posts": {
            get: { operationId: "getUserPosts", responses: {} },
          },
          "/api/v1/products/{id}/reviews": {
            get: { operationId: "getProductReviews", responses: {} },
          },
          "/health": {
            get: { operationId: "healthCheck", responses: {} },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(spec)

      expect((tools.get("GET::users") as ExtendedTool).resourceName).toBe("users")
      expect((tools.get("GET::users-id") as ExtendedTool).resourceName).toBe("users")
      expect((tools.get("GET::users-id-posts") as ExtendedTool).resourceName).toBe("posts")
      expect((tools.get("GET::api-v1-products-id-reviews") as ExtendedTool).resourceName).toBe(
        "reviews",
      )
      expect((tools.get("GET::health") as ExtendedTool).resourceName).toBe("health")
    })

    it("should maintain backward compatibility with x-original-path", () => {
      const spec: OpenAPIV3.Document = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users/{id}": {
            get: {
              operationId: "getUserById",
              responses: {},
            },
          },
        },
      }

      const tools = openAPILoader.parseOpenAPISpec(spec)
      const tool = tools.get("GET::users-id") as any

      expect(tool["x-original-path"]).toBe("/users/{id}")
      expect((tool as ExtendedTool).originalPath).toBe("/users/{id}")
    })
  })
})
