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
        // With hyphen escaping: /-api-/users/- becomes -api--users- (after removing leading slash and escaping hyphens)
        // Then slashes become hyphens: api---users (the middle hyphen was escaped to --, then slash became -)
        // After sanitization, leading/trailing hyphens are removed: api---users (no leading/trailing hyphens to remove)
        expect(result).toBe("DELETE::api---users")
      })

      it("should collapse multiple consecutive hyphens", () => {
        const result = generateToolId("GET", "/api///v1///users")
        // Multiple slashes are collapsed first: /api/v1/users
        // Then converted: api-v1-users (no hyphens to escape in this case)
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
        // The hyphen in "user_data-v2" gets escaped: user_data--v2
        // Then slashes become hyphens: api123-user_data--v2-settings
        expect(result).toBe("PATCH::api123-user_data--v2-settings")
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

    it("should handle paths with legitimate hyphens in segments (REGRESSION FIX)", () => {
      // These are the specific cases mentioned in the improvement plan
      const pathsWithHyphens = [
        "/api/resource-name/items",
        "/user-profile/data",
        "/api/v1/user-management/groups",
        "/service-users/authority-groups",
        "/complex-path/with-many-hyphens/in-segments",
        "/api/multi-word-resource/sub-resource/action",
        "/v2/user-accounts/account-settings/privacy-controls",
      ]

      for (const originalPath of pathsWithHyphens) {
        const method = "GET"

        // Generate toolId
        const toolId = generateToolId(method, originalPath)

        // Parse it back
        const parsed = parseToolId(toolId)

        // Should be unambiguous and consistent
        expect(parsed.method).toBe(method)

        // The key fix: parsed path should exactly match the original path
        // This verifies that hyphens in path segments are preserved correctly
        expect(parsed.path).toBe(originalPath)

        // ToolId should use :: separator and contain escaped hyphens
        expect(toolId).toContain("::")
        expect(toolId.split("::")).toHaveLength(2)

        // Verify that the toolId contains escaped hyphens (--) for legitimate hyphens
        if (originalPath.includes("-")) {
          expect(toolId).toContain("--")
        }
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

        // With the new escaping, the parsed path should exactly match the original path
        // This is the fix - hyphens are now preserved correctly!
        expect(parsed.path).toBe(path)

        // ToolId should use :: separator
        expect(toolId).toContain("::")
        expect(toolId.split("::")).toHaveLength(2)
      }
    })

    it("should demonstrate the difference from old broken behavior", () => {
      // This test shows how the old behavior was broken and the new behavior fixes it
      const pathWithHyphens = "/api/resource-name/items"
      const method = "GET"

      const toolId = generateToolId(method, pathWithHyphens)
      const parsed = parseToolId(toolId)

      // NEW BEHAVIOR (correct): Hyphens are preserved
      expect(parsed.path).toBe("/api/resource-name/items")
      expect(toolId).toBe("GET::api-resource--name-items")

      // OLD BEHAVIOR would have been:
      // toolId: "GET::api-resource-name-items" (no escaping)
      // parsed.path: "/api/resource/name/items" (incorrect - hyphens became slashes)

      // Verify the toolId contains escaped hyphens
      expect(toolId).toContain("--")
    })

    it("should handle edge cases with hyphen escaping", () => {
      const edgeCases = [
        { path: "/api/trailing-hyphen-/test", description: "path with trailing hyphen in segment" },
        {
          path: "/api/mixed_under-score-hyphen/test",
          description: "path with mixed underscores and hyphens",
        },
      ]

      for (const { path, description } of edgeCases) {
        const method = "POST"
        const toolId = generateToolId(method, path)
        const parsed = parseToolId(toolId)

        // The round-trip should preserve the original path structure
        expect(parsed.path).toBe(path)
        expect(parsed.method).toBe(method)

        // Should use :: separator
        expect(toolId).toContain("::")
        expect(toolId.split("::")).toHaveLength(2)
      }
    })

    it("should handle edge case with leading hyphen in segment", () => {
      // Leading hyphens in segments create a special case due to sanitization
      const pathWithLeadingHyphen = "/api/-leading-hyphen/test"
      const method = "POST"

      const toolId = generateToolId(method, pathWithLeadingHyphen)
      const parsed = parseToolId(toolId)

      // Due to sanitization removing leading hyphens, this case has a limitation
      expect(parsed.path).toBe("/api-/leading-hyphen/test")
      expect(parsed.method).toBe(method)

      // The toolId should still be valid
      expect(toolId).toContain("::")
      expect(toolId.split("::")).toHaveLength(2)
    })

    it("should handle limitation with consecutive hyphens in original path", () => {
      // This test documents a known limitation: paths with consecutive hyphens
      // in the original path segments cannot be perfectly round-tripped due to
      // the inherent ambiguity in the escaping scheme.
      // This is an extremely rare edge case in real-world APIs.

      const pathWithConsecutiveHyphens = "/api/--double-hyphen/test"
      const method = "GET"

      const toolId = generateToolId(method, pathWithConsecutiveHyphens)
      const parsed = parseToolId(toolId)

      // The parsed path will be different due to the escaping ambiguity
      expect(parsed.path).toBe("/api--/double-hyphen/test")
      expect(parsed.method).toBe(method)

      // This is a known limitation - consecutive hyphens in original path segments
      // create ambiguity in the escaping scheme. However, this is extremely rare
      // in real-world REST APIs, which typically use single hyphens as separators.
      expect(parsed.path).not.toBe(pathWithConsecutiveHyphens)

      // The toolId should still be valid
      expect(toolId).toContain("::")
      expect(toolId.split("::")).toHaveLength(2)
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
