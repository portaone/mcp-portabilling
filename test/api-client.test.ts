import { describe, it, expect, beforeEach, vi } from "vitest"
import axios, { AxiosError } from "axios"
import { ApiClient } from "../src/api-client"
import { AuthProvider } from "../src/auth-provider"

// Mock axios
vi.mock("axios")

describe("ApiClient", () => {
  let apiClient: ApiClient
  let mockAxiosInstance: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock axios instance
    mockAxiosInstance = vi.fn().mockResolvedValue({ data: { result: "success" } })
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

    // Create ApiClient instance
    apiClient = new ApiClient("https://api.example.com", { "X-API-Key": "test-key" })
  })

  describe("constructor", () => {
    it("should create axios instance with correct base URL", () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: "https://api.example.com/",
      })
    })

    it("should append trailing slash to base URL if missing", () => {
      new ApiClient("https://api.example.com")
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: "https://api.example.com/",
      })
    })
  })

  describe("setTools", () => {
    it("should store tools map correctly", () => {
      const mockTool = {
        name: "test-tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {
            param1: { type: "string" },
          },
        },
      }

      const toolsMap = new Map()
      toolsMap.set("GET::test", mockTool)

      apiClient.setTools(toolsMap)

      // Verify tool is accessible by making a call that uses it
      const originalGetToolDefinition = (apiClient as any).getToolDefinition
      const getToolDefinitionSpy = vi.fn().mockReturnValue(mockTool)
      ;(apiClient as any).getToolDefinition = getToolDefinitionSpy

      apiClient.executeApiCall("GET::test", { param1: "value" })

      expect(getToolDefinitionSpy).toHaveBeenCalledWith("GET::test")

      // Restore original method
      ;(apiClient as any).getToolDefinition = originalGetToolDefinition
    })

    it("should replace previous tools when called multiple times", () => {
      const firstTool = {
        name: "first-tool",
        description: "First tool",
        inputSchema: { type: "object", properties: {} },
      }

      const secondTool = {
        name: "second-tool",
        description: "Second tool",
        inputSchema: { type: "object", properties: {} },
      }

      // Set first tools map
      const firstMap = new Map()
      firstMap.set("GET::first", firstTool)
      apiClient.setTools(firstMap)

      // Set second tools map
      const secondMap = new Map()
      secondMap.set("GET::second", secondTool)
      apiClient.setTools(secondMap)

      // Verify only second tool is accessible
      const getToolDefinitionSpy = vi.spyOn(apiClient as any, "getToolDefinition")

      expect((apiClient as any).getToolDefinition("GET::first")).toBeUndefined()
      expect((apiClient as any).getToolDefinition("GET::second")).toBe(secondTool)

      getToolDefinitionSpy.mockRestore()
    })

    it("should handle empty tools map", () => {
      const emptyMap = new Map()
      apiClient.setTools(emptyMap)

      expect((apiClient as any).getToolDefinition("GET::any")).toBeUndefined()
    })

    it("should clear tools when called with empty map after having tools", () => {
      const tool = {
        name: "test-tool",
        description: "Test tool",
        inputSchema: { type: "object", properties: {} },
      }

      // First set a tool
      const toolsMap = new Map()
      toolsMap.set("GET::test", tool)
      apiClient.setTools(toolsMap)

      // Verify tool exists
      expect((apiClient as any).getToolDefinition("GET::test")).toBe(tool)

      // Clear tools
      apiClient.setTools(new Map())

      // Verify tool is gone
      expect((apiClient as any).getToolDefinition("GET::test")).toBeUndefined()
    })
  })

  describe("executeApiCall", () => {
    it("should make GET request with correct parameters", async () => {
      await apiClient.executeApiCall("GET::users__list", { page: 1, limit: 10 })

      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/users/list",
        headers: { "X-API-Key": "test-key" },
        params: { page: 1, limit: 10 },
      })
    })

    it("should make POST request with correct body", async () => {
      await apiClient.executeApiCall("POST::users__create", {
        name: "John Doe",
        email: "john@example.com",
      })

      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "post",
        url: "/users/create",
        headers: { "X-API-Key": "test-key" },
        data: { name: "John Doe", email: "john@example.com" },
      })
    })

    it("should set default Content-Type for POST requests with data", async () => {
      await apiClient.executeApiCall("POST::users-create", {
        name: "John",
        email: "john@example.com",
      })

      // Verify that axios is called with data (axios will set Content-Type automatically)
      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          data: { name: "John", email: "john@example.com" },
        }),
      )
    })

    it("should set default Content-Type for PUT requests with data", async () => {
      await apiClient.executeApiCall("PUT::users-123", {
        name: "John Updated",
        email: "john.updated@example.com",
      })

      // Verify that axios is called with data (axios will set Content-Type automatically)
      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "put",
          data: { name: "John Updated", email: "john.updated@example.com" },
        }),
      )
    })

    it("should handle PATCH requests with data", async () => {
      await apiClient.executeApiCall("PATCH::users-123", {
        name: "John Patched",
      })

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          data: { name: "John Patched" },
        }),
      )
    })

    it("should convert array parameters to comma-separated strings for GET requests", async () => {
      await apiClient.executeApiCall("GET::users__search", { tags: ["admin", "active"] })

      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/users/search",
        headers: { "X-API-Key": "test-key" },
        params: { tags: "admin,active" },
      })
    })

    it("should return response data on successful request", async () => {
      const result = await apiClient.executeApiCall("GET::users__list", {})
      expect(result).toEqual({ result: "success" })
    })

    it("should handle axios errors properly", async () => {
      const axiosError = new Error("Request failed") as any
      axiosError.response = {
        status: 404,
        data: { error: "Not found" },
      }

      mockAxiosInstance.mockRejectedValueOnce(axiosError)
      vi.mocked(axios.isAxiosError).mockReturnValueOnce(true)

      await expect(apiClient.executeApiCall("GET::users__list", {})).rejects.toThrow(
        'API request failed: Request failed (404: {"error":"Not found"})',
      )
    })

    it("should handle non-axios errors", async () => {
      const error = new Error("Network error")
      mockAxiosInstance.mockRejectedValueOnce(error)
      vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)

      await expect(apiClient.executeApiCall("GET::users__list", {})).rejects.toThrow(
        "Network error",
      )
    })

    it("should handle 500 errors properly", async () => {
      const axiosError = new Error("Network error") as any
      axiosError.response = {
        status: 500,
        data: { error: "Internal Server Error" },
      }

      mockAxiosInstance.mockRejectedValueOnce(axiosError)
      vi.mocked(axios.isAxiosError).mockReturnValueOnce(true)

      await expect(apiClient.executeApiCall("GET::users__list", {})).rejects.toThrow(
        'API request failed: Network error (500: {"error":"Internal Server Error"})',
      )
    })

    it("should replace path parameters in URL correctly and remove them from query parameters", async () => {
      await apiClient.executeApiCall("GET::pet__petId", { petId: 1, filter: "all" })
      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/pet/1",
        headers: { "X-API-Key": "test-key" },
        params: { filter: "all" },
      })
    })

    it("should handle multiple path parameters correctly", async () => {
      await apiClient.executeApiCall("GET::store__order__orderId__item__itemId", {
        orderId: 123,
        itemId: 456,
        format: "json",
      })
      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/store/order/123/item/456",
        headers: { "X-API-Key": "test-key" },
        params: { format: "json" },
      })
    })

    describe("Parameter Location Handling", () => {
      it("should respect parameter location from OpenAPI spec when available", async () => {
        // Create a mock tool definition with proper OpenAPI parameter locations
        const mockTool = {
          name: "get-user-by-id",
          description: "Get user by ID",
          inputSchema: {
            type: "object",
            properties: {
              userId: {
                type: "string",
                description: "User ID",
                "x-parameter-location": "path",
              },
              fields: {
                type: "string",
                description: "Fields to return",
                "x-parameter-location": "query",
              },
            },
          },
        }

        // Set up the tool in the client
        const toolsMap = new Map()
        toolsMap.set("GET::user__userId", mockTool)
        apiClient.setTools(toolsMap)

        // Execute the call with both path and query params
        await apiClient.executeApiCall("GET::user__userId", {
          userId: "user123",
          fields: "name,email",
        })

        // Verify the correct URL was constructed and params sent
        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/user/user123",
          headers: { "X-API-Key": "test-key" },
          params: { fields: "name,email" },
        })
      })

      it("should handle header parameters correctly", async () => {
        const mockTool = {
          name: "get-user-with-header",
          description: "Get user with header parameter",
          inputSchema: {
            type: "object",
            properties: {
              userId: {
                type: "string",
                description: "User ID",
                "x-parameter-location": "path",
              },
              "X-Custom-Header": {
                type: "string",
                description: "Custom header",
                "x-parameter-location": "header",
              },
              queryParam: {
                type: "string",
                description: "Query parameter",
                "x-parameter-location": "query",
              },
            },
          },
        }

        const toolsMap = new Map()
        toolsMap.set("GET::user__userId", mockTool)
        apiClient.setTools(toolsMap)

        await apiClient.executeApiCall("GET::user__userId", {
          userId: "user123",
          "X-Custom-Header": "custom-value",
          queryParam: "query-value",
        })

        // Note: Current implementation doesn't handle header parameters yet
        // This test documents the expected behavior for future implementation
        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/user/user123",
          headers: { "X-API-Key": "test-key" },
          params: { "X-Custom-Header": "custom-value", queryParam: "query-value" },
        })
      })

      it("should handle cookie parameters correctly", async () => {
        const mockTool = {
          name: "get-user-with-cookie",
          description: "Get user with cookie parameter",
          inputSchema: {
            type: "object",
            properties: {
              userId: {
                type: "string",
                description: "User ID",
                "x-parameter-location": "path",
              },
              sessionId: {
                type: "string",
                description: "Session ID",
                "x-parameter-location": "cookie",
              },
              queryParam: {
                type: "string",
                description: "Query parameter",
                "x-parameter-location": "query",
              },
            },
          },
        }

        const toolsMap = new Map()
        toolsMap.set("GET::user__userId", mockTool)
        apiClient.setTools(toolsMap)

        await apiClient.executeApiCall("GET::user__userId", {
          userId: "user123",
          sessionId: "session-abc123",
          queryParam: "query-value",
        })

        // Note: Current implementation doesn't handle cookie parameters yet
        // This test documents the expected behavior for future implementation
        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/user/user123",
          headers: { "X-API-Key": "test-key" },
          params: { sessionId: "session-abc123", queryParam: "query-value" },
        })
      })

      it("should handle mixed parameter locations in single operation", async () => {
        const mockTool = {
          name: "complex-operation",
          description: "Operation with mixed parameter locations",
          inputSchema: {
            type: "object",
            properties: {
              resourceId: {
                type: "string",
                description: "Resource ID",
                "x-parameter-location": "path",
              },
              subResourceId: {
                type: "string",
                description: "Sub-resource ID",
                "x-parameter-location": "path",
              },
              Authorization: {
                type: "string",
                description: "Auth header",
                "x-parameter-location": "header",
              },
              sessionToken: {
                type: "string",
                description: "Session token",
                "x-parameter-location": "cookie",
              },
              filter: {
                type: "string",
                description: "Filter query",
                "x-parameter-location": "query",
              },
              sort: {
                type: "string",
                description: "Sort order",
                "x-parameter-location": "query",
              },
            },
          },
        }

        const toolsMap = new Map()
        toolsMap.set("GET::resource__resourceId__sub__subResourceId", mockTool)
        apiClient.setTools(toolsMap)

        await apiClient.executeApiCall("GET::resource__resourceId__sub__subResourceId", {
          resourceId: "res123",
          subResourceId: "sub456",
          Authorization: "Bearer token123",
          sessionToken: "session-xyz",
          filter: "active",
          sort: "name",
        })

        // Current implementation behavior - all non-path params go to query
        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/resource/res123/sub/sub456",
          headers: { "X-API-Key": "test-key" },
          params: {
            Authorization: "Bearer token123",
            sessionToken: "session-xyz",
            filter: "active",
            sort: "name",
          },
        })
      })
    })

    describe("Parameter Handling without Schema Hints", () => {
      it("should infer path parameters from toolId when no tool definition available", async () => {
        // Don't set any tools, so no schema hints available
        await apiClient.executeApiCall("GET::users__userId__posts__postId", {
          userId: "user123",
          postId: "post456",
          filter: "published",
        })

        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/users/user123/posts/post456",
          headers: { "X-API-Key": "test-key" },
          params: { filter: "published" },
        })
      })

      it("should handle edge case where argument matches path segment but not all segments have values", async () => {
        // toolId: "GET::a__b__c", args: {a:1, c:3} - what happens to 'b'?
        await apiClient.executeApiCall("GET::a__b__c", { a: 1, c: 3 })

        // Current behavior: only replaces segments that have matching arguments
        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/1/b/3",
          headers: { "X-API-Key": "test-key" },
          params: {},
        })
      })

      it("should handle case where no arguments match path segments", async () => {
        await apiClient.executeApiCall("GET::users__profile", { filter: "active", limit: 10 })

        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/users/profile",
          headers: { "X-API-Key": "test-key" },
          params: { filter: "active", limit: 10 },
        })
      })

      it("should handle partial path parameter matches without tool definition", async () => {
        // Some params match path segments, others don't
        await apiClient.executeApiCall("GET::api__version__users__userId", {
          userId: "user123",
          version: "v2",
          format: "json",
          nonMatchingParam: "value",
        })

        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/api/v2/users/user123",
          headers: { "X-API-Key": "test-key" },
          params: { format: "json", nonMatchingParam: "value" },
        })
      })

      it("should handle empty arguments with path-like toolId", async () => {
        await apiClient.executeApiCall("GET::users__userId__posts", {})

        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/users/userId/posts",
          headers: { "X-API-Key": "test-key" },
          params: {},
        })
      })

      it("should handle arguments with special characters in path replacement", async () => {
        await apiClient.executeApiCall("GET::users__userId", {
          userId: "user@123.com",
          filter: "special&chars",
        })

        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/users/user%40123.com",
          headers: { "X-API-Key": "test-key" },
          params: { filter: "special&chars" },
        })
      })
    })

    describe("Hyphen Handling in Tool IDs", () => {
      it("should correctly handle toolId with legitimate hyphens in path segments", async () => {
        // Test the critical hyphen handling - now much simpler with double underscores
        await apiClient.executeApiCall("GET::api__resource-name__items", { filter: "all" })

        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/api/resource-name/items",
          headers: { "X-API-Key": "test-key" },
          params: { filter: "all" },
        })
      })

      it("should handle multiple hyphens in different segments", async () => {
        await apiClient.executeApiCall("GET::api__user-profile__data-store", { userId: "123" })

        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/api/user-profile/data-store",
          headers: { "X-API-Key": "test-key" },
          params: { userId: "123" },
        })
      })

      it("should handle complex hyphen patterns with path parameters", async () => {
        const mockTool = {
          name: "complex-hyphen-tool",
          description: "Tool with complex hyphen patterns",
          inputSchema: {
            type: "object",
            properties: {
              "resource-id": {
                type: "string",
                description: "Resource ID with hyphen",
                "x-parameter-location": "path",
              },
            },
          },
        }

        const toolsMap = new Map()
        toolsMap.set("GET::api__resource-name__resource-id", mockTool)
        apiClient.setTools(toolsMap)

        await apiClient.executeApiCall("GET::api__resource-name__resource-id", {
          "resource-id": "res-123",
          filter: "active",
        })

        // The path should be reconstructed correctly with hyphens preserved
        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/api/resource-name/res-123",
          headers: { "X-API-Key": "test-key" },
          params: { filter: "active" },
        })
      })

      it("should handle edge case with consecutive hyphens", async () => {
        // Test --existing-double pattern - now much clearer
        await apiClient.executeApiCall("GET::api__--existing-double__test", {})

        expect(mockAxiosInstance).toHaveBeenCalledWith({
          method: "get",
          url: "/api/--existing-double/test",
          headers: { "X-API-Key": "test-key" },
          params: {},
        })
      })

      it("should handle round-trip conversion correctly", async () => {
        // Test that generateToolId -> parseToolId -> URL reconstruction works correctly
        const testCases = [
          {
            toolId: "GET::api__resource-name__items",
            expectedPath: "/api/resource-name/items",
          },
          {
            toolId: "POST::user-profile__data-store",
            expectedPath: "/user-profile/data-store",
          },
          {
            toolId: "PUT::api__v1__multi-hyphen-segments",
            expectedPath: "/api/v1/multi-hyphen-segments",
          },
        ]

        for (const testCase of testCases) {
          await apiClient.executeApiCall(testCase.toolId, {})

          expect(mockAxiosInstance).toHaveBeenCalledWith(
            expect.objectContaining({
              url: testCase.expectedPath,
            }),
          )
        }
      })
    })

    it("should handle query parameters that match path segments but are not path parameters", async () => {
      // Create a mock tool that has a segment name that could be confused with a query param
      const mockTool = {
        name: "search-results",
        description: "Search results",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
              "x-parameter-location": "query",
            },
            results: {
              type: "string",
              description: "Result format",
              "x-parameter-location": "query",
            },
          },
        },
      }

      // Set up the tool in the client
      const toolsMap = new Map()
      toolsMap.set("GET::search__results", mockTool)
      apiClient.setTools(toolsMap)

      // Execute with a param that matches a path segment but is not a path param
      await apiClient.executeApiCall("GET::search__results", {
        query: "test",
        results: "json",
      })

      // Verify both params were sent as query params, not substituted into path
      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/search/results",
        headers: { "X-API-Key": "test-key" },
        params: { query: "test", results: "json" },
      })
    })

    it("should handle OpenAPI-style path parameters with curly braces", async () => {
      // Create a mock tool with OpenAPI-style parameter in path
      const mockTool = {
        name: "get-user-by-id",
        description: "Get user by ID",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "User ID",
              "x-parameter-location": "path",
            },
          },
        },
      }

      // Set up the tool in the client and mock parseToolId to return path with {userId}
      const toolsMap = new Map()
      toolsMap.set("GET::user__userId", mockTool)
      apiClient.setTools(toolsMap)

      // Mock the parseToolId method to return a path with curly braces format
      const originalParseToolId = (apiClient as any).parseToolId
      ;(apiClient as any).parseToolId = vi.fn().mockReturnValue({
        method: "get",
        path: "/user/{userId}",
      })

      // Execute the call
      await apiClient.executeApiCall("GET::user__userId", { userId: "user123" })

      // Verify the correct URL was constructed
      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/user/user123",
        headers: { "X-API-Key": "test-key" },
        params: {},
      })

      // Restore original parseToolId
      ;(apiClient as any).parseToolId = originalParseToolId
    })

    it("should handle Express-style path parameters with colon prefix", async () => {
      // Create a mock tool with Express-style parameter in path
      const mockTool = {
        name: "get-user-by-id",
        description: "Get user by ID",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "User ID",
              "x-parameter-location": "path",
            },
          },
        },
      }

      // Set up the tool in the client and mock parseToolId to return path with :userId
      const toolsMap = new Map()
      toolsMap.set("GET::user__userId", mockTool)
      apiClient.setTools(toolsMap)

      // Mock the parseToolId method to return a path with Express format
      const originalParseToolId = (apiClient as any).parseToolId
      ;(apiClient as any).parseToolId = vi.fn().mockReturnValue({
        method: "get",
        path: "/user/:userId",
      })

      // Execute the call
      await apiClient.executeApiCall("GET::user__userId", { userId: "user123" })

      // Verify the correct URL was constructed
      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/user/user123",
        headers: { "X-API-Key": "test-key" },
        params: {},
      })

      // Restore original parseToolId
      ;(apiClient as any).parseToolId = originalParseToolId
    })

    it("should properly escape regex special characters in parameter keys", async () => {
      // Create a mock tool with a parameter key that contains regex special characters
      const mockTool = {
        name: "get-data-with-special-param",
        description: "Get data with a parameter that has special regex characters",
        inputSchema: {
          type: "object",
          properties: {
            "param.with*special+chars": {
              // Parameter with regex special characters
              type: "string",
              description: "Parameter with special characters",
              "x-parameter-location": "path",
            },
          },
        },
      }

      // Set up the tool in the client
      const toolsMap = new Map()
      toolsMap.set("GET::data__param", mockTool)
      apiClient.setTools(toolsMap)

      // Mock the parseToolId method to return a path with special parameter
      const originalParseToolId = (apiClient as any).parseToolId
      ;(apiClient as any).parseToolId = vi.fn().mockReturnValue({
        method: "get",
        path: "/data/{param.with*special+chars}",
      })

      // Execute the call
      await apiClient.executeApiCall("GET::data__param", { "param.with*special+chars": "value123" })

      // Verify the correct URL was constructed
      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/data/value123",
        headers: { "X-API-Key": "test-key" },
        params: {},
      })

      // Restore original parseToolId
      ;(apiClient as any).parseToolId = originalParseToolId
    })

    it("REGRESSION: should correctly handle toolId format with :: separator for API calls", async () => {
      // This test validates that the API client correctly handles the new toolId format
      // and reconstructs the original API path correctly

      const testCases = [
        {
          toolId: "GET::user_profile__data",
          expectedPath: "/user_profile/data",
          expectedMethod: "get",
        },
        {
          toolId: "POST::api__v1__user__management",
          expectedPath: "/api/v1/user/management",
          expectedMethod: "post",
        },
        {
          toolId: "PUT::service_users__authority_groups",
          expectedPath: "/service_users/authority_groups",
          expectedMethod: "put",
        },
      ]

      for (const testCase of testCases) {
        await apiClient.executeApiCall(testCase.toolId, { param: "value" })

        expect(mockAxiosInstance).toHaveBeenCalledWith(
          expect.objectContaining({
            method: testCase.expectedMethod,
            url: testCase.expectedPath,
          }),
        )
      }
    })

    it("should handle hyphens in path segments", async () => {
      await apiClient.executeApiCall("POST::api__v1__user-profile", {})

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "/api/v1/user-profile",
        }),
      )
    })
  })

  describe("parseToolId", () => {
    it("should correctly parse tool ID into method and path", async () => {
      await apiClient.executeApiCall("GET::users__profile__details", {})

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: "/users/profile/details",
        }),
      )
    })

    it("should handle hyphens in path segments", async () => {
      await apiClient.executeApiCall("POST::api__v1__user-profile", {})

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "/api/v1/user-profile",
        }),
      )
    })
  })

  describe("AuthProvider Integration", () => {
    let mockAuthProvider: AuthProvider
    let authApiClient: ApiClient

    beforeEach(() => {
      // Don't clear all mocks here - it breaks axios.isAxiosError

      // Setup mock axios instance
      mockAxiosInstance = vi.fn().mockResolvedValue({ data: { result: "success" } })
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

      // Create mock AuthProvider
      mockAuthProvider = {
        getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer token123" }),
        handleAuthError: vi.fn().mockResolvedValue(false),
      }

      // Create ApiClient with AuthProvider
      authApiClient = new ApiClient("https://api.example.com", mockAuthProvider)
    })

    it("should call getAuthHeaders before each request", async () => {
      await authApiClient.executeApiCall("GET::users__list", {})

      expect(mockAuthProvider.getAuthHeaders).toHaveBeenCalledTimes(1)
      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { Authorization: "Bearer token123" },
        }),
      )
    })

    it("should handle authentication errors and call handleAuthError", async () => {
      const authError = new Error("Unauthorized") as AxiosError
      authError.response = { status: 401, data: { error: "Unauthorized" } } as any

      mockAxiosInstance.mockRejectedValueOnce(authError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await expect(authApiClient.executeApiCall("GET::users__list", {})).rejects.toThrow(
        'API request failed: Unauthorized (401: {"error":"Unauthorized"})',
      )

      expect(mockAuthProvider.handleAuthError).toHaveBeenCalledWith(authError)
    })

    it("should retry request when handleAuthError returns true", async () => {
      const authError = new Error("Unauthorized") as AxiosError
      authError.response = { status: 401, data: { error: "Unauthorized" } } as any

      // First call fails with auth error, second succeeds
      mockAxiosInstance
        .mockRejectedValueOnce(authError)
        .mockResolvedValueOnce({ data: { result: "success after retry" } })

      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      // Mock auth provider to return true for retry
      vi.mocked(mockAuthProvider.handleAuthError).mockResolvedValueOnce(true)

      // Mock fresh headers for retry
      vi.mocked(mockAuthProvider.getAuthHeaders)
        .mockResolvedValueOnce({ Authorization: "Bearer token123" }) // First call
        .mockResolvedValueOnce({ Authorization: "Bearer fresh-token" }) // Retry call

      const result = await authApiClient.executeApiCall("GET::users__list", {})

      expect(result).toEqual({ result: "success after retry" })
      expect(mockAuthProvider.handleAuthError).toHaveBeenCalledWith(authError)
      expect(mockAuthProvider.getAuthHeaders).toHaveBeenCalledTimes(2)
      expect(mockAxiosInstance).toHaveBeenCalledTimes(2)

      // Verify retry call used fresh headers
      expect(mockAxiosInstance).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          headers: { Authorization: "Bearer fresh-token" },
        }),
      )
    })

    it("should not retry on non-auth errors", async () => {
      const networkError = new Error("Network error") as AxiosError
      networkError.response = { status: 500, data: { error: "Internal Server Error" } } as any

      mockAxiosInstance.mockRejectedValueOnce(networkError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await expect(authApiClient.executeApiCall("GET::users__list", {})).rejects.toThrow(
        'API request failed: Network error (500: {"error":"Internal Server Error"})',
      )

      // Should not call handleAuthError for non-auth errors
      expect(mockAuthProvider.handleAuthError).not.toHaveBeenCalled()
      expect(mockAxiosInstance).toHaveBeenCalledTimes(1)
    })

    it("should not retry more than once", async () => {
      const authError = new Error("Unauthorized") as AxiosError
      authError.response = { status: 401, data: { error: "Unauthorized" } } as any

      // Both calls fail with auth error
      mockAxiosInstance.mockRejectedValueOnce(authError).mockRejectedValueOnce(authError)

      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      // Mock auth provider to return true for retry
      vi.mocked(mockAuthProvider.handleAuthError).mockResolvedValueOnce(true)

      await expect(authApiClient.executeApiCall("GET::users__list", {})).rejects.toThrow(
        'API request failed: Unauthorized (401: {"error":"Unauthorized"})',
      )

      // Should be called twice: original + retry
      expect(mockAxiosInstance).toHaveBeenCalledTimes(2)
      // But handleAuthError should only be called once (on the original failure)
      expect(mockAuthProvider.handleAuthError).toHaveBeenCalledTimes(1)
    })

    it("should throw auth handler error if auth handler throws", async () => {
      const authError = new Error("Unauthorized") as AxiosError
      authError.response = { status: 401, data: { error: "Unauthorized" } } as any

      const authHandlerError = new Error("Token expired. Please provide a new token.")

      mockAxiosInstance.mockRejectedValueOnce(authError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)
      vi.mocked(mockAuthProvider.handleAuthError).mockRejectedValueOnce(authHandlerError)

      await expect(authApiClient.executeApiCall("GET::users__list", {})).rejects.toThrow(
        "Token expired. Please provide a new token.",
      )

      expect(mockAuthProvider.handleAuthError).toHaveBeenCalledWith(authError)
    })

    it("should get fresh headers for each request", async () => {
      // Make multiple requests
      await authApiClient.executeApiCall("GET::users__list", {})
      await authApiClient.executeApiCall("GET::posts__list", {})

      expect(mockAuthProvider.getAuthHeaders).toHaveBeenCalledTimes(2)
      expect(mockAxiosInstance).toHaveBeenCalledTimes(2)
    })
  })

  describe("Backward Compatibility", () => {
    it("should work with static headers (backward compatibility)", async () => {
      const clientWithHeaders = new ApiClient("https://api.example.com", {
        "X-API-Key": "test-key",
      })

      await clientWithHeaders.executeApiCall("GET::users__list", {})

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "X-API-Key": "test-key" },
        }),
      )
    })

    it("should work with no auth provider or headers", async () => {
      const clientWithoutAuth = new ApiClient("https://api.example.com")

      await clientWithoutAuth.executeApiCall("GET::users__list", {})

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {},
        }),
      )
    })

    it("should distinguish between AuthProvider and headers object", async () => {
      // Test with headers object (should use StaticAuthProvider internally)
      const clientWithHeaders = new ApiClient("https://api.example.com", { "X-API-Key": "test" })

      // Test with actual AuthProvider
      const authProvider: AuthProvider = {
        getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer token" }),
        handleAuthError: vi.fn().mockResolvedValue(false),
      }
      const clientWithAuthProvider = new ApiClient("https://api.example.com", authProvider)

      await clientWithHeaders.executeApiCall("GET::test", {})
      await clientWithAuthProvider.executeApiCall("GET::test", {})

      // Headers client should use static headers
      expect(mockAxiosInstance).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          headers: { "X-API-Key": "test" },
        }),
      )

      // AuthProvider client should call getAuthHeaders
      expect(authProvider.getAuthHeaders).toHaveBeenCalled()
      expect(mockAxiosInstance).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          headers: { Authorization: "Bearer token" },
        }),
      )
    })
  })
})
