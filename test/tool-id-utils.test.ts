import { describe, it, expect } from "vitest"
import { parseToolId, generateToolId } from "../src/utils/tool-id.js"

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

    describe("Character Sanitization", () => {
      it("should remove special characters not in [A-Za-z0-9_-]", () => {
        const result = generateToolId("POST", "/api/v2.1/users@domain.com")
        expect(result).toBe("POST::api-v21-usersdomaincom")
      })

      it("should handle dots in version numbers", () => {
        const result = generateToolId("GET", "/api/v1.2.3/users")
        expect(result).toBe("GET::api-v123-users")
      })

      it("should remove at symbols and other email-like characters", () => {
        const result = generateToolId("PUT", "/users/{email@domain.com}/profile")
        expect(result).toBe("PUT::users-emaildomaincom-profile")
      })

      it("should handle query parameter-like syntax", () => {
        const result = generateToolId("GET", "/search?q=test&limit=10")
        expect(result).toBe("GET::searchqtestlimit10")
      })

      it("should remove parentheses and brackets", () => {
        const result = generateToolId("POST", "/api/users(active)/groups[admin]")
        expect(result).toBe("POST::api-usersactive-groupsadmin")
      })

      it("should handle spaces and tabs", () => {
        const result = generateToolId("PATCH", "/api/user profile/settings")
        expect(result).toBe("PATCH::api-userprofile-settings")
      })

      it("should remove leading and trailing hyphens after sanitization", () => {
        const result = generateToolId("DELETE", "/-api-/users/-")
        expect(result).toBe("DELETE::api-users")
      })

      it("should collapse multiple consecutive hyphens", () => {
        const result = generateToolId("GET", "/api///v1///users")
        expect(result).toBe("GET::api-v1-users")
      })

      it("should handle complex special character combinations", () => {
        const result = generateToolId(
          "POST",
          "/api/v2.0/users/{user@domain.com}/posts?filter=active&sort=date",
        )
        expect(result).toBe("POST::api-v20-users-userdomaincom-postsfilteractivesortdate")
      })

      it("should preserve underscores in the sanitized output", () => {
        const result = generateToolId("PUT", "/api_v1/user_profile/settings_data")
        expect(result).toBe("PUT::api_v1-user_profile-settings_data")
      })

      it("should handle Unicode characters by removing them", () => {
        const result = generateToolId("GET", "/api/users/José/profile")
        expect(result).toBe("GET::api-users-Jos-profile")
      })

      it("should handle empty path after sanitization", () => {
        const result = generateToolId("GET", "/!@#$%^&*()")
        expect(result).toBe("GET::")
      })

      it("should handle paths with only special characters", () => {
        const result = generateToolId("POST", "/???/!!!/***")
        expect(result).toBe("POST::")
      })

      it("should maintain alphanumeric characters and allowed symbols", () => {
        const result = generateToolId("PATCH", "/api123/user_data-v2/settings")
        expect(result).toBe("PATCH::api123-user_data-v2-settings")
      })
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

    it("should handle round-trip with sanitized special characters", () => {
      const testCases = [
        { method: "GET", path: "/api/v2.1/users" },
        { method: "POST", path: "/users/{email@domain.com}/profile" },
        { method: "PUT", path: "/search?q=test&limit=10" },
        { method: "DELETE", path: "/api/users(active)/groups[admin]" },
      ]

      for (const testCase of testCases) {
        // Generate toolId from method and path (this will sanitize special chars)
        const toolId = generateToolId(testCase.method, testCase.path)

        // Parse it back
        const parsed = parseToolId(toolId)

        // Method should match exactly
        expect(parsed.method).toBe(testCase.method.toUpperCase())

        // The parsed path will be the sanitized version with slashes restored
        // Note: Special characters will be removed, so we can't expect exact match
        expect(parsed.path).toMatch(/^\/[A-Za-z0-9_/-]*$/)
        expect(toolId).toMatch(/^[A-Z]+::[A-Za-z0-9_-]*$/)
      }
    })
  })

  describe("Tool ID Format Validation", () => {
    it("should ensure all generated tool IDs contain only safe characters", () => {
      const testPaths = [
        "/api/v2.1/users@domain.com",
        "/search?q=test&limit=10",
        "/users/{email@domain.com}/profile",
        "/api/users(active)/groups[admin]",
        "/complex/path!@#$%^&*()/with/special/chars",
        "/unicode/José/müller/path",
      ]

      for (const path of testPaths) {
        const toolId = generateToolId("GET", path)

        // Should match the expected format: METHOD::pathPart
        expect(toolId).toMatch(/^[A-Z]+::[A-Za-z0-9_-]*$/)

        // Should not contain any unsafe characters
        expect(toolId).not.toMatch(/[^A-Za-z0-9_:-]/)

        // Should have exactly one :: separator
        expect(toolId.split("::")).toHaveLength(2)
      }
    })

    it("should handle edge cases gracefully", () => {
      // Empty path
      expect(generateToolId("GET", "")).toBe("GET::")

      // Only slashes
      expect(generateToolId("POST", "///")).toBe("POST::")

      // Only special characters
      expect(generateToolId("PUT", "/!@#$%^&*()")).toBe("PUT::")

      // Mixed valid and invalid characters
      expect(generateToolId("DELETE", "/api123!@#/users_data$%^")).toBe("DELETE::api123-users_data")
    })
  })
})
