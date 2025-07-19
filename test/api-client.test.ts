import { describe, it, expect, vi, beforeEach } from "vitest"
import { ApiClient } from "../src/api-client.js"
import { StaticAuthProvider } from "../src/auth-provider.js"
import { OpenAPISpecLoader } from "../src/openapi-loader.js"
import { Tool } from "@modelcontextprotocol/sdk/types.js"

describe("ApiClient Dynamic Meta-Tools", () => {
  let apiClient: ApiClient
  let mockAxios: any
  let mockSpecLoader: OpenAPISpecLoader

  beforeEach(() => {
    mockAxios = {
      create: vi.fn().mockReturnThis(),
      request: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
    }

    mockSpecLoader = new OpenAPISpecLoader()
    apiClient = new ApiClient("https://api.example.com", new StaticAuthProvider(), mockSpecLoader)

    // Mock the axios instance
    ;(apiClient as any).axiosInstance = mockAxios
  })

  describe("LIST-API-ENDPOINTS", () => {
    it("should handle LIST-API-ENDPOINTS meta-tool without making HTTP request", async () => {
      const openApiSpec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              summary: "Get users",
              description: "Retrieve all users",
            },
            post: {
              summary: "Create user",
              description: "Create a new user",
            },
          },
          "/users/{id}": {
            get: {
              summary: "Get user by ID",
              description: "Retrieve a specific user",
            },
          },
        },
      }

      apiClient.setOpenApiSpec(openApiSpec)

      const result = await apiClient.executeApiCall("LIST-API-ENDPOINTS", {})

      expect(result).toEqual({
        endpoints: [
          {
            method: "GET",
            path: "/users",
            summary: "Get users",
            description: "Retrieve all users",
            operationId: "",
            tags: [],
          },
          {
            method: "POST",
            path: "/users",
            summary: "Create user",
            description: "Create a new user",
            operationId: "",
            tags: [],
          },
          {
            method: "GET",
            path: "/users/{id}",
            summary: "Get user by ID",
            description: "Retrieve a specific user",
            operationId: "",
            tags: [],
          },
        ],
        total: 3,
        note: "Use INVOKE-API-ENDPOINT to call specific endpoints with the path parameter",
      })

      // Verify no HTTP request was made
      expect(mockAxios.request).not.toHaveBeenCalled()
      expect(mockAxios.get).not.toHaveBeenCalled()
      expect(mockAxios.post).not.toHaveBeenCalled()
    })

    it("should work without OpenAPI spec using fallback", async () => {
      const tools = new Map<string, Tool>([
        [
          "GET::users",
          {
            name: "Get Users",
            description: "List all users",
            inputSchema: { type: "object", properties: {} },
          },
        ],
        [
          "POST::users",
          {
            name: "Create User",
            description: "Create a user",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      ])

      apiClient.setTools(tools)

      const result = await apiClient.executeApiCall("LIST-API-ENDPOINTS", {})

      expect(result.endpoints).toHaveLength(2)
      expect(result.note).toContain("Limited endpoint information")
    })
  })

  describe("GET-API-ENDPOINT-SCHEMA", () => {
    it("should handle GET-API-ENDPOINT-SCHEMA meta-tool", async () => {
      const openApiSpec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              summary: "Get users",
              description: "Retrieve all users",
              parameters: [
                {
                  name: "page",
                  in: "query",
                  schema: { type: "integer" },
                },
              ],
            },
          },
        },
      }

      apiClient.setOpenApiSpec(openApiSpec)

      const result = await apiClient.executeApiCall("GET-API-ENDPOINT-SCHEMA", {
        endpoint: "/users",
      })

      expect(result.path).toBe("/users")
      expect(result.operations).toHaveLength(1)
      expect(result.operations[0].method).toBe("GET")
      expect(result.operations[0].summary).toBe("Get users")
    })
  })

  describe("INVOKE-API-ENDPOINT", () => {
    it("should handle INVOKE-API-ENDPOINT meta-tool with direct HTTP request", async () => {
      const openApiSpec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              summary: "Get users",
            },
          },
        },
      }

      apiClient.setOpenApiSpec(openApiSpec)
      mockAxios.request.mockResolvedValue({ data: [{ id: 1, name: "John" }] })

      const result = await apiClient.executeApiCall("INVOKE-API-ENDPOINT", {
        endpoint: "/users",
        method: "GET",
        params: { page: 1 },
      })

      expect(result).toEqual([{ id: 1, name: "John" }])
      expect(mockAxios.request).toHaveBeenCalledWith({
        method: "get",
        url: "/users",
        headers: {},
        params: { page: 1 },
      })
    })
  })

  it("should provide specific error messages for GET-API-ENDPOINT-SCHEMA with missing endpoint", async () => {
    const tools = new Map([
      [
        "GET-API-ENDPOINT-SCHEMA",
        {
          name: "get-api-endpoint-schema",
          description: "Get schema",
          inputSchema: { type: "object" as const, properties: {} },
        } as any,
      ],
    ])
    apiClient.setTools(tools)

    await expect(apiClient.executeApiCall("GET-API-ENDPOINT-SCHEMA", {})).rejects.toThrow(
      "Missing required parameter 'endpoint' for tool 'GET-API-ENDPOINT-SCHEMA'",
    )
  })

  it("should provide specific error messages for INVOKE-API-ENDPOINT with missing endpoint", async () => {
    const tools = new Map([
      [
        "INVOKE-API-ENDPOINT",
        {
          name: "invoke-api-endpoint",
          description: "Invoke endpoint",
          inputSchema: { type: "object" as const, properties: {} },
        } as any,
      ],
    ])
    apiClient.setTools(tools)

    await expect(apiClient.executeApiCall("INVOKE-API-ENDPOINT", {})).rejects.toThrow(
      "Missing required parameter 'endpoint' for tool 'INVOKE-API-ENDPOINT'",
    )
  })

  it("should provide specific error messages for GET-API-ENDPOINT-SCHEMA with invalid endpoint", async () => {
    const tools = new Map([
      [
        "GET-API-ENDPOINT-SCHEMA",
        {
          name: "get-api-endpoint-schema",
          description: "Get schema",
          inputSchema: { type: "object" as const, properties: {} },
        } as any,
      ],
    ])
    apiClient.setTools(tools)

    // Mock OpenAPI spec with no matching endpoint
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {},
    } as any
    apiClient.setOpenApiSpec(mockSpec)

    await expect(
      apiClient.executeApiCall("GET-API-ENDPOINT-SCHEMA", { endpoint: "/invalid" }),
    ).rejects.toThrow("No endpoint found for path '/invalid' in tool 'GET-API-ENDPOINT-SCHEMA'")
  })
})
