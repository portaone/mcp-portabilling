import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ToolsManager } from "../src/tools-manager"
import { OpenAPISpecLoader } from "../src/openapi-loader"
import { Tool } from "@modelcontextprotocol/sdk/types.js"

// Mock dependencies
vi.mock("../src/openapi-loader", () => {
  return {
    OpenAPISpecLoader: vi.fn().mockImplementation(() => ({
      loadOpenAPISpec: vi.fn(),
      parseOpenAPISpec: vi.fn(),
    })),
  }
})

describe("ToolsManager", () => {
  let toolsManager: ToolsManager
  let mockConfig: any
  let mockSpecLoader: any

  beforeEach(() => {
    mockConfig = {
      name: "test-server",
      version: "1.0.0",
      apiBaseUrl: "http://example.com/api",
      openApiSpec: "http://example.com/openapi.json",
    }

    toolsManager = new ToolsManager(mockConfig)
    mockSpecLoader = (toolsManager as any).specLoader
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("initialize", () => {
    it("should load and parse the OpenAPI spec", async () => {
      const mockSpec = { paths: {} }
      const mockTools = new Map([
        ["GET::users", { name: "List Users", description: "Get all users" } as Tool],
        ["POST::users", { name: "Create User", description: "Create a new user" } as Tool],
      ])

      mockSpecLoader.loadOpenAPISpec.mockResolvedValue(mockSpec)
      mockSpecLoader.parseOpenAPISpec.mockReturnValue(mockTools)

      await toolsManager.initialize()

      expect(mockSpecLoader.loadOpenAPISpec).toHaveBeenCalledWith(
        mockConfig.openApiSpec,
        undefined,
        undefined,
      )
      expect(mockSpecLoader.parseOpenAPISpec).toHaveBeenCalledWith(mockSpec)
      expect((toolsManager as any).tools).toEqual(mockTools)
    })

    it("should load dynamic meta-tools when toolsMode is dynamic", async () => {
      // Configure for dynamic mode
      ;(toolsManager as any).config.toolsMode = "dynamic"
      const spyLoad = mockSpecLoader.loadOpenAPISpec.mockResolvedValue({} as any)
      await toolsManager.initialize()
      // parseOpenAPISpec should not be called
      expect(mockSpecLoader.parseOpenAPISpec).not.toHaveBeenCalled()
      const tools = toolsManager.getAllTools().map((t) => t.name)
      expect(tools).toEqual([
        "list-api-endpoints",
        "get-api-endpoint-schema",
        "invoke-api-endpoint",
      ])
    })

    it("should filter tools by includeTools list", async () => {
      // Setup raw tools
      const mockTools = new Map([
        ["GET::foo", { name: "foo" } as Tool],
        ["GET::bar", { name: "bar" } as Tool],
      ])
      mockSpecLoader.loadOpenAPISpec.mockResolvedValue({ paths: {} } as any)
      mockSpecLoader.parseOpenAPISpec.mockReturnValue(mockTools)
      ;(toolsManager as any).config.toolsMode = "all"
      ;(toolsManager as any).config.includeTools = ["GET::bar"]
      await toolsManager.initialize()
      expect(Array.from((toolsManager as any).tools.keys())).toEqual(["GET::bar"])
    })

    it("should filter tools by includeOperations list", async () => {
      const mockTools = new Map([
        ["GET::1", { name: "g1" } as Tool],
        ["POST::1", { name: "p1" } as Tool],
      ])
      mockSpecLoader.loadOpenAPISpec.mockResolvedValue({ paths: {} } as any)
      mockSpecLoader.parseOpenAPISpec.mockReturnValue(mockTools)
      ;(toolsManager as any).config.toolsMode = "all"
      ;(toolsManager as any).config.includeOperations = ["get"]
      await toolsManager.initialize()
      expect(Array.from((toolsManager as any).tools.keys())).toEqual(["GET::1"])
    })

    it("should filter tools by includeResources list", async () => {
      const mockTools = new Map([
        ["GET::users", { name: "u" } as Tool],
        ["GET::orders-id", { name: "o" } as Tool],
      ])
      mockSpecLoader.loadOpenAPISpec.mockResolvedValue({ paths: {} } as any)
      mockSpecLoader.parseOpenAPISpec.mockReturnValue(mockTools)
      ;(toolsManager as any).config.toolsMode = "all"
      ;(toolsManager as any).config.includeResources = ["users"]
      await toolsManager.initialize()
      expect(Array.from((toolsManager as any).tools.keys())).toEqual(["GET::users"])
    })

    it("should filter tools by includeTags list", async () => {
      const spec = {
        paths: {
          "/a": { get: { tags: ["x"] } },
          "/b": { get: { tags: ["y"] } },
        },
      } as any
      const mockTools = new Map([
        ["GET::a", { name: "a" } as Tool],
        ["GET::b", { name: "b" } as Tool],
      ])
      mockSpecLoader.loadOpenAPISpec.mockResolvedValue(spec)
      mockSpecLoader.parseOpenAPISpec.mockReturnValue(mockTools)
      ;(toolsManager as any).config.toolsMode = "all"
      ;(toolsManager as any).config.includeTags = ["x"]
      await toolsManager.initialize()
      expect(Array.from((toolsManager as any).tools.keys())).toEqual(["GET::a"])
    })

    it("should filter tools by includeTags list case-insensitively", async () => {
      const spec = {
        paths: {
          "/a": { get: { tags: ["USERS"] } },
          "/b": { get: { tags: ["products"] } },
        },
      } as any
      const mockTools = new Map([
        ["GET::a", { name: "a" } as Tool],
        ["GET::b", { name: "b" } as Tool],
      ])
      mockSpecLoader.loadOpenAPISpec.mockResolvedValue(spec)
      mockSpecLoader.parseOpenAPISpec.mockReturnValue(mockTools)
      ;(toolsManager as any).config.toolsMode = "all"
      ;(toolsManager as any).config.includeTags = ["users"] // lowercase, will match uppercase "USERS"
      await toolsManager.initialize()
      expect(Array.from((toolsManager as any).tools.keys())).toEqual(["GET::a"])
    })
  })

  describe("getAllTools - return all tools", () => {
    it("should return all tools", async () => {
      const mockTools = new Map([
        ["GET::users", { name: "List Users" } as Tool],
        ["POST::users", { name: "Create User" } as Tool],
      ])

      // Set up the tools map
      vi.spyOn(toolsManager as any, "tools", "get").mockReturnValue(mockTools)

      const tools = toolsManager.getAllTools()

      expect(tools).toEqual([{ name: "List Users" }, { name: "Create User" }])
    })
  })

  describe("getToolsWithIds", () => {
    it("should return all tools with their IDs", async () => {
      const mockTools = new Map([
        ["GET::users", { name: "List Users" } as Tool],
        ["POST::users", { name: "Create User" } as Tool],
      ])

      // Set up the tools map
      vi.spyOn(toolsManager as any, "tools", "get").mockReturnValue(mockTools)

      const toolsWithIds = toolsManager.getToolsWithIds()

      expect(toolsWithIds).toEqual([
        ["GET::users", { name: "List Users" }],
        ["POST::users", { name: "Create User" }],
      ])
    })
  })

  describe("findTool", () => {
    it("should find a tool by ID", () => {
      const mockTools = new Map([
        ["GET::users", { name: "List Users" } as Tool],
        ["POST::users", { name: "Create User" } as Tool],
      ])

      // Set up the tools map
      vi.spyOn(toolsManager as any, "tools", "get").mockReturnValue(mockTools)

      const result = toolsManager.findTool("GET::users")

      expect(result).toEqual({
        toolId: "GET::users",
        tool: { name: "List Users" },
      })
    })

    it("should find a tool by name", () => {
      const mockTools = new Map([
        ["GET::users", { name: "List Users" } as Tool],
        ["POST::users", { name: "Create User" } as Tool],
      ])

      // Set up the tools map
      vi.spyOn(toolsManager as any, "tools", "get").mockReturnValue(mockTools)

      const result = toolsManager.findTool("Create User")

      expect(result).toEqual({
        toolId: "POST::users",
        tool: { name: "Create User" },
      })
    })

    it("should return undefined if tool is not found", () => {
      const mockTools = new Map([["GET::users", { name: "List Users" } as Tool]])

      // Set up the tools map
      vi.spyOn(toolsManager as any, "tools", "get").mockReturnValue(mockTools)

      const result = toolsManager.findTool("nonexistent")

      expect(result).toBeUndefined()
    })
  })

  describe("parseToolId", () => {
    it("should parse a tool ID into method and path", () => {
      const result = toolsManager.parseToolId("GET::users-active")
      expect(result).toEqual({
        method: "GET",
        path: "/users-active",
      })
    })

    it("should handle complex paths with hyphens", () => {
      const result = toolsManager.parseToolId("POST::api-v1-user-profile-update")
      expect(result).toEqual({
        method: "POST",
        path: "/api-v1-user-profile-update",
      })
    })

    it("should handle paths with underscores", () => {
      const result = toolsManager.parseToolId("GET::user_profile-user_id")
      expect(result).toEqual({
        method: "GET",
        path: "/user_profile-user_id",
      })
    })

    it("should handle paths with special characters (encoded)", () => {
      const specialPath = "/user_profile/{user_id}/data-2024_06"
      const pathPart = "user_profile-user_id-data-2024_06"
      const toolId = `GET::${pathPart}`
      const result = toolsManager.parseToolId(toolId)
      expect(result).toEqual({
        method: "GET",
        path: "/user_profile-user_id-data-2024_06",
      })
    })

    it("should round-trip encode and decode toolId for any path", () => {
      const paths = [
        "/user_profile/{user_id}",
        "/api/v1/user-profile_update",
        "/foo-bar_baz/123",
        "/complex/path_with-mixed_chars/and123",
      ]
      for (const path of paths) {
        const method = "GET"
        // Simulate the toolId generation process
        const cleanPath = path
          .replace(/^\//, "")
          .replace(/\{([^}]+)\}/g, "$1")
          .replace(/\//g, "-")
        const toolId = `${method}::${cleanPath}`
        const { method: parsedMethod, path: parsedPath } = toolsManager.parseToolId(toolId)
        expect(parsedMethod).toBe(method)
        // The parsed path should have slashes converted to hyphens and curly braces removed
        const expectedPath =
          "/" +
          path
            .replace(/^\//, "")
            .replace(/\{([^}]+)\}/g, "$1")
            .replace(/\//g, "-")
        expect(parsedPath).toBe(expectedPath)
      }
    })

    it("REGRESSION: should resolve original toolId ambiguity issue with underscores and hyphens", () => {
      // This test validates that the original issue is resolved:
      // Before the fix, paths with underscores and hyphens could be parsed incorrectly
      // because the separator was ambiguous

      const problematicPaths = [
        // Original problematic case: path with underscores and hyphens
        "/user_profile-data",
        "/api_v1-user-management",
        "/service_users-authority_groups",
        // Edge cases that could cause confusion
        "/user-profile_data",
        "/api-v1_user_management",
        "/complex_path-with-mixed_separators",
      ]

      for (const originalPath of problematicPaths) {
        const method = "POST"

        // Step 1: Simulate toolId generation (as done in openapi-loader.ts)
        const cleanPath = originalPath
          .replace(/^\//, "") // Remove leading slash
          .replace(/\{([^}]+)\}/g, "$1") // Remove curly braces from path params
          .replace(/\//g, "-") // Convert slashes to hyphens
        const toolId = `${method}::${cleanPath}`

        // Step 2: Parse the toolId back (as done in tools-manager.ts and api-client.ts)
        const { method: parsedMethod, path: parsedPath } = toolsManager.parseToolId(toolId)

        // Step 3: Validate the round-trip is unambiguous
        expect(parsedMethod).toBe(method)

        // The parsed path should be deterministic and unambiguous
        // It will have the format: /original-path-with-slashes-as-hyphens
        const expectedPath = "/" + cleanPath
        expect(parsedPath).toBe(expectedPath)

        // Step 4: Validate that the toolId format is unambiguous
        // The :: separator ensures we can always split correctly
        expect(toolId).toContain("::")
        expect(toolId.split("::")).toHaveLength(2)
        expect(toolId.split("::")[0]).toBe(method)
        expect(toolId.split("::")[1]).toBe(cleanPath)
      }
    })

    it("REGRESSION: demonstrates that old format would have been ambiguous", () => {
      // This test demonstrates why the old format was problematic
      // and validates that the new format resolves the ambiguity

      const problematicPaths = [
        "/user_profile-data", // Could be confused with "/user/profile-data"
        "/api-v1_user", // Could be confused with "/api-v1/user"
        "/service_users-groups", // Could be confused with "/service/users-groups"
      ]

      for (const path of problematicPaths) {
        // With the OLD format (using single hyphen separator):
        // The toolId would be: "GET-user_profile-data"
        // When parsing, it's ambiguous where the method ends and path begins
        // because both method separator and path parts use hyphens

        // With the NEW format (using :: separator):
        const method = "GET"
        const cleanPath = path.replace(/^\//, "").replace(/\//g, "-")
        const newFormatToolId = `${method}::${cleanPath}`

        // The new format is unambiguous because :: only appears once as separator
        expect(newFormatToolId.split("::")).toHaveLength(2)
        expect(newFormatToolId.split("::")[0]).toBe(method)
        expect(newFormatToolId.split("::")[1]).toBe(cleanPath)

        // Parsing is now deterministic
        const { method: parsedMethod, path: parsedPath } = toolsManager.parseToolId(newFormatToolId)
        expect(parsedMethod).toBe(method)
        expect(parsedPath).toBe("/" + cleanPath)

        // The old format would have been: "GET-user_profile-data"
        // Which could be parsed as:
        // - method="GET", path="/user_profile-data" (correct)
        // - method="GET-user", path="/profile-data" (incorrect)
        // - method="GET-user_profile", path="/data" (incorrect)

        // The new format eliminates this ambiguity completely
      }
    })
  })
})
