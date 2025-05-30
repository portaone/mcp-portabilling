import { describe, it, expect } from "vitest"
import { parseToolId, generateToolId } from "../src/tool-id-utils"

describe("Tool ID Utilities", () => {
  describe("parseToolId", () => {
    it("should parse simple tool IDs correctly", () => {
      const result = parseToolId("GET::users")
      expect(result).toEqual({
        method: "GET",
        path: "/users",
      })
    })

    it("should handle complex paths with multiple segments", () => {
      const result = parseToolId("POST::api-v1-users-profile")
      expect(result).toEqual({
        method: "POST",
        path: "/api/v1/users/profile",
      })
    })

    it("should handle paths with underscores", () => {
      const result = parseToolId("PUT::user_profile-settings")
      expect(result).toEqual({
        method: "PUT",
        path: "/user_profile/settings",
      })
    })

    it("should handle mixed separators", () => {
      const result = parseToolId("DELETE::api_v2-user_management-groups")
      expect(result).toEqual({
        method: "DELETE",
        path: "/api_v2/user_management/groups",
      })
    })

    it("should handle empty path part", () => {
      const result = parseToolId("GET::")
      expect(result).toEqual({
        method: "GET",
        path: "",
      })
    })
  })

  describe("generateToolId", () => {
    it("should generate simple tool IDs correctly", () => {
      const result = generateToolId("GET", "/users")
      expect(result).toBe("GET::users")
    })

    it("should handle complex paths with multiple segments", () => {
      const result = generateToolId("POST", "/api/v1/users/profile")
      expect(result).toBe("POST::api-v1-users-profile")
    })

    it("should remove path parameter braces", () => {
      const result = generateToolId("GET", "/users/{id}/profile")
      expect(result).toBe("GET::users-id-profile")
    })

    it("should handle paths with underscores", () => {
      const result = generateToolId("PUT", "/user_profile/settings")
      expect(result).toBe("PUT::user_profile-settings")
    })

    it("should handle mixed separators and path params", () => {
      const result = generateToolId("DELETE", "/api_v2/user_management/{groupId}/members")
      expect(result).toBe("DELETE::api_v2-user_management-groupId-members")
    })

    it("should uppercase the method", () => {
      const result = generateToolId("get", "/users")
      expect(result).toBe("GET::users")
    })

    it("should handle root path", () => {
      const result = generateToolId("GET", "/")
      expect(result).toBe("GET::")
    })
  })

  describe("Round-trip consistency", () => {
    it("should maintain consistency between generateToolId and parseToolId", () => {
      const testCases = [
        { method: "GET", path: "/users" },
        { method: "POST", path: "/api/v1/users/profile" },
        { method: "PUT", path: "/users/{id}/settings" },
        { method: "DELETE", path: "/user_profile/data" },
        { method: "PATCH", path: "/api_v2/user_management/{groupId}/members" },
      ]

      for (const testCase of testCases) {
        // Generate toolId from method and path
        const toolId = generateToolId(testCase.method, testCase.path)

        // Parse it back
        const parsed = parseToolId(toolId)

        // Method should match exactly
        expect(parsed.method).toBe(testCase.method.toUpperCase())

        // Path should match the structure (path params will have braces removed)
        const expectedPath = testCase.path.replace(/\{([^}]+)\}/g, "$1")
        expect(parsed.path).toBe(expectedPath)
      }
    })

    it("should handle the original problematic cases that caused ambiguity", () => {
      const problematicPaths = [
        "/user_profile-data",
        "/api_v1-user-management",
        "/service_users-authority_groups",
        "/user-profile_data",
        "/api-v1_user_management",
        "/complex_path-with-mixed_separators",
      ]

      for (const path of problematicPaths) {
        const method = "POST"

        // Generate toolId
        const toolId = generateToolId(method, path)

        // Parse it back
        const parsed = parseToolId(toolId)

        // Should be unambiguous and consistent
        expect(parsed.method).toBe(method)

        // The parsed path will have hyphens converted back to slashes
        // This reconstructs the API path structure for HTTP requests
        const expectedPath = path.replace(/-/g, "/")
        expect(parsed.path).toBe(expectedPath)

        // ToolId should use :: separator
        expect(toolId).toContain("::")
        expect(toolId.split("::")).toHaveLength(2)
      }
    })
  })
})
