import { describe, it, expect, vi, beforeEach } from "vitest"
import { ApiClient } from "../src/api-client.js"
import { StaticAuthProvider } from "../src/auth-provider.js"
import { OpenAPISpecLoader } from "../src/openapi-loader.js"

// Test for Issue #34: Endpoint path dots being removed
describe("Issue #34 Regression Test - Dot Removal in Endpoint Paths", () => {
  it("should preserve dots in endpoint paths and not remove them", async () => {
    // This test specifically addresses the bug described in issue #34:
    // Original bug: "1.0/test" gets converted to "10/test" (dot removed)
    // Expected behavior: "1.0/test" should remain as "1.0/test"

    const mockSpecLoader = new OpenAPISpecLoader()
    const mockApiClient = new ApiClient(
      "https://api.example.com",
      new StaticAuthProvider(),
      mockSpecLoader,
    )

    // Create a mock OpenAPI spec with paths containing dots
    const testSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/api/1.0/test": {
          get: {
            operationId: "getTestV1",
            responses: { "200": { description: "Success" } },
          },
        },
        "/api/v2.1/users": {
          get: {
            operationId: "getUsersV2_1",
            responses: { "200": { description: "Success" } },
          },
        },
        "/endpoints/3.14/pi": {
          post: {
            operationId: "createPi",
            responses: { "200": { description: "Success" } },
          },
        },
      },
    }

    // Set the spec and generate tools
    mockApiClient.setOpenApiSpec(testSpec as any)
    const tools = mockSpecLoader.parseOpenAPISpec(testSpec as any)
    mockApiClient.setTools(tools)

    // Mock axios to capture the actual request URLs
    const capturedConfigs: any[] = []
    const mockAxios = vi.fn().mockImplementation((config) => {
      capturedConfigs.push(config)
      return Promise.resolve({ data: { success: true } })
    })
    ;(mockApiClient as any).axiosInstance = mockAxios

    // Test case 1: "1.0" should not become "10"
    const toolId1 = "GET::api__10__test" // This would be the incorrect tool ID if dots are removed
    try {
      await mockApiClient.executeApiCall(toolId1, {})
    } catch (error) {
      // This should fail because the correct tool ID should preserve the dot
    }

    // Test case 2: Find the correct tool ID that should preserve dots
    const allTools = Array.from(tools.keys())
    // After fix: We expect to find tool IDs that preserve dots
    const dotPreservingToolIds = allTools.filter(
      (id) =>
        id.includes("api") &&
        (id.includes("1.0") || // Fixed behavior - dots preserved
          id.includes("v2.1") || // Fixed behavior - dots preserved
          id.includes("3.14")), // Fixed behavior - dots preserved
    )

    expect(dotPreservingToolIds.length).toBeGreaterThan(0)

    // Execute API calls with the actual generated tool IDs
    for (const toolId of dotPreservingToolIds) {
      capturedConfigs.length = 0 // Clear previous captures
      await mockApiClient.executeApiCall(toolId, {})

      expect(capturedConfigs.length).toBe(1)
      const config = capturedConfigs[0]

      // The issue: URLs should preserve dots but currently don't

      // After fix - dots should be preserved in the path
      if (toolId.includes("1.0")) {
        // Tool ID should preserve dots and URL should contain them
        expect(config.url).toContain("/1.0/") // Fixed behavior - dots preserved
        expect(config.url).not.toContain("/10/") // Old buggy behavior should not happen
      }
      if (toolId.includes("v2.1")) {
        expect(config.url).toContain("/v2.1/") // Fixed behavior - dots preserved
        expect(config.url).not.toContain("/v21/") // Old buggy behavior should not happen
      }
      if (toolId.includes("3.14")) {
        expect(config.url).toContain("/3.14/") // Fixed behavior - dots preserved
        expect(config.url).not.toContain("/314/") // Old buggy behavior should not happen
      }
    }
  })

  it("should demonstrate the exact issue from GitHub #34 description", async () => {
    // Recreate the exact scenario described in the issue
    const mockSpecLoader = new OpenAPISpecLoader()
    const mockApiClient = new ApiClient(
      "https://api.example.com",
      new StaticAuthProvider(),
      mockSpecLoader,
    )

    const testSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/1.0/test": {
          get: {
            operationId: "testEndpoint",
            responses: { "200": { description: "Success" } },
          },
        },
      },
    }

    mockApiClient.setOpenApiSpec(testSpec as any)
    const tools = mockSpecLoader.parseOpenAPISpec(testSpec as any)
    mockApiClient.setTools(tools)

    let capturedConfig: any = null
    const mockAxios = vi.fn().mockImplementation((config) => {
      capturedConfig = config
      return Promise.resolve({ data: { success: true } })
    })
    ;(mockApiClient as any).axiosInstance = mockAxios

    // Get the generated tool ID
    const toolIds = Array.from(tools.keys())
    expect(toolIds.length).toBe(1)

    const toolId = toolIds[0]
    // Removed debug logging for tool ID

    await mockApiClient.executeApiCall(toolId, {})

    expect(capturedConfig).toBeDefined()
    // Removed debug logging for actual URL

    // After fix: "1.0/test" should remain as "1.0/test"
    expect(capturedConfig.url).toBe("/1.0/test") // Fixed behavior - dots preserved
    expect(capturedConfig.url).not.toBe("/10/test") // Old buggy behavior should not happen
  })
})
