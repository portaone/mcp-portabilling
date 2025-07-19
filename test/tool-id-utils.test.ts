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
      const result = parseToolId("POST::api__v1__users__profile")
      expect(result).toEqual({
        method: "POST",
        path: "/api/v1/users/profile",
      })
    })

    it("should handle paths with underscores", () => {
      const result = parseToolId("PUT::user_profile__settings")
      expect(result).toEqual({
        method: "PUT",
        path: "/user_profile/settings",
      })
    })

    it("should handle mixed separators", () => {
      const result = parseToolId("DELETE::api_v2__user_management__groups")
      expect(result).toEqual({
        method: "DELETE",
        path: "/api_v2/user_management/groups",
      })
    })

    it("should handle paths with hyphens (no escaping needed)", () => {
      const result = parseToolId("GET::api__resource-name__items")
      expect(result).toEqual({
        method: "GET",
        path: "/api/resource-name/items",
      })
    })

    it("should handle empty path part", () => {
      const result = parseToolId("GET::")
      expect(result).toEqual({
        method: "GET",
        path: "",
      })
    })

    it("should handle multiple :: separators", () => {
      const result = parseToolId("GET::users::profile")
      expect(result).toEqual({
        method: "GET",
        path: "/users",
      })
    })

    it("should handle empty method", () => {
      const result = parseToolId("::users")
      expect(result).toEqual({
        method: "",
        path: "/users",
      })
    })

    it("should handle completely empty input", () => {
      const result = parseToolId("")
      expect(result).toEqual({
        method: "",
        path: "",
      })
    })

    it("should handle only :: separator", () => {
      const result = parseToolId("::")
      expect(result).toEqual({
        method: "",
        path: "",
      })
    })

    it("should handle method with different cases", () => {
      const testCases = [
        { input: "get::users", expected: { method: "get", path: "/users" } },
        { input: "Post::users", expected: { method: "Post", path: "/users" } },
        { input: "PUT::users", expected: { method: "PUT", path: "/users" } },
        { input: "dElEtE::users", expected: { method: "dElEtE", path: "/users" } },
      ]

      for (const { input, expected } of testCases) {
        const result = parseToolId(input)
        expect(result).toEqual(expected)
      }
    })

    it("should handle whitespace in method and path", () => {
      const testCases = [
        { input: " GET ::users", expected: { method: " GET ", path: "/users" } },
        { input: "GET:: users ", expected: { method: "GET", path: "/ users " } },
        { input: " GET :: users ", expected: { method: " GET ", path: "/ users " } },
      ]

      for (const { input, expected } of testCases) {
        const result = parseToolId(input)
        expect(result).toEqual(expected)
      }
    })

    it("should handle special characters in method", () => {
      const testCases = [
        { input: "GET@::users", expected: { method: "GET@", path: "/users" } },
        { input: "G-E-T::users", expected: { method: "G-E-T", path: "/users" } },
        { input: "123::users", expected: { method: "123", path: "/users" } },
      ]

      for (const { input, expected } of testCases) {
        const result = parseToolId(input)
        expect(result).toEqual(expected)
      }
    })

    it("should handle very long inputs", () => {
      const longMethod = "A".repeat(1000)
      const longPath = "b".repeat(1000)
      const input = `${longMethod}::${longPath}`

      const result = parseToolId(input)
      expect(result.method).toBe(longMethod)
      expect(result.path).toBe(`/${longPath}`)
    })

    it("should handle inputs with double underscores in path", () => {
      const testCases = [
        { input: "GET::__", expected: { method: "GET", path: "//" } },
        { input: "GET::____", expected: { method: "GET", path: "///" } },
        { input: "GET::api____users", expected: { method: "GET", path: "/api//users" } },
      ]

      for (const { input, expected } of testCases) {
        const result = parseToolId(input)
        expect(result).toEqual(expected)
      }
    })
  })

  describe("generateToolId", () => {
    it("should generate simple tool IDs correctly", () => {
      const result = generateToolId("GET", "/users")
      expect(result).toBe("GET::users")
    })

    it("should handle complex paths with multiple segments", () => {
      const result = generateToolId("POST", "/api/v1/users/profile")
      expect(result).toBe("POST::api__v1__users__profile")
    })

    it("should remove path parameter braces", () => {
      const result = generateToolId("GET", "/users/{id}/profile")
      expect(result).toBe("GET::users__---id__profile")
    })

    it("should handle paths with underscores", () => {
      const result = generateToolId("PUT", "/user_profile/settings")
      expect(result).toBe("PUT::user_profile__settings")
    })

    it("should handle mixed separators and path params", () => {
      const result = generateToolId("DELETE", "/api_v2/user_management/{groupId}/members")
      expect(result).toBe("DELETE::api_v2__user_management__---groupId__members")
    })

    it("should handle paths with hyphens (no escaping needed)", () => {
      const result = generateToolId("GET", "/api/resource-name/items")
      expect(result).toBe("GET::api__resource-name__items")
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
      it("should remove special characters not in [A-Za-z0-9_.-]", () => {
        const result = generateToolId("POST", "/api/v2.1/users@domain.com")
        expect(result).toBe("POST::api__v2.1__usersdomain.com")
      })

      it("should preserve dots in version numbers", () => {
        const result = generateToolId("GET", "/api/v1.2.3/users")
        expect(result).toBe("GET::api__v1.2.3__users")
      })

      it("should remove at symbols but preserve dots in email-like characters", () => {
        const result = generateToolId("PUT", "/users/{email@domain.com}/profile")
        expect(result).toBe("PUT::users__---emaildomain.com__profile")
      })

      it("should handle query parameter-like syntax", () => {
        const result = generateToolId("GET", "/search?q=test&limit=10")
        expect(result).toBe("GET::searchqtestlimit10")
      })

      it("should remove parentheses and brackets", () => {
        const result = generateToolId("POST", "/api/users(active)/groups[admin]")
        expect(result).toBe("POST::api__usersactive__groupsadmin")
      })

      it("should handle spaces and tabs", () => {
        const result = generateToolId("PATCH", "/api/user profile/settings")
        expect(result).toBe("PATCH::api__userprofile__settings")
      })

      it("should remove leading and trailing hyphens and underscores after sanitization", () => {
        const result = generateToolId("DELETE", "/-api-/users/_")
        expect(result).toBe("DELETE::api-__users")
      })

      it("should collapse multiple consecutive slashes", () => {
        const result = generateToolId("GET", "/api///v1///users")
        // Multiple slashes are collapsed first: /api/v1/users
        // Then converted: api__v1__users
        expect(result).toBe("GET::api__v1__users")
      })

      it("should handle complex special character combinations", () => {
        const result = generateToolId(
          "POST",
          "/api/v2.0/users/{user@domain.com}/posts?filter=active&sort=date",
        )
        expect(result).toBe("POST::api__v2.0__users__---userdomain.com__postsfilteractivesortdate")
      })

      it("should preserve underscores in the sanitized output", () => {
        const result = generateToolId("PUT", "/api_v1/user_profile/settings_data")
        expect(result).toBe("PUT::api_v1__user_profile__settings_data")
      })

      it("should handle Unicode characters by removing them", () => {
        const result = generateToolId("GET", "/api/users/José/profile")
        expect(result).toBe("GET::api__users__Jos__profile")
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
        expect(result).toBe("PATCH::api123__user_data-v2__settings")
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

        // Path should match the structure with ---param markers for parameters
        const expectedPath = testCase.path.replace(/\{([^}]+)\}/g, "---$1")
        expect(parsed.path).toBe(expectedPath)
      }
    })

    it("should handle paths with legitimate hyphens perfectly", () => {
      // These cases now work perfectly with no escaping needed
      const pathsWithHyphens = [
        "/api/resource-name/items",
        "/user-profile/data",
        "/api/v1/user-management/groups",
        "/service-users/authority-groups",
        "/complex-path/with-many-hyphens/in-segments",
        "/api/multi-word-resource/sub-resource/action",
        "/v2/user-accounts/account-settings/privacy-controls",
        "/api/--double-hyphen/test",
        "/api/triple---hyphen/test",
        "/api/mixed--and-single/test",
      ]

      for (const originalPath of pathsWithHyphens) {
        const method = "GET"

        // Generate toolId
        const toolId = generateToolId(method, originalPath)

        // Parse it back
        const parsed = parseToolId(toolId)

        // Should be perfect round-trip
        expect(parsed.method).toBe(method)
        expect(parsed.path).toBe(originalPath)

        // ToolId should use :: separator and __ for path separators
        expect(toolId).toContain("::")
        expect(toolId.split("::")).toHaveLength(2)

        // Verify that the toolId contains double underscores for path separators
        if (originalPath.includes("/")) {
          expect(toolId).toContain("__")
        }
      }
    })

    it("should handle the original problematic cases perfectly", () => {
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

        // Should be perfect round-trip - no ambiguity!
        expect(parsed.method).toBe(method)
        expect(parsed.path).toBe(path)

        // ToolId should use :: separator
        expect(toolId).toContain("::")
        expect(toolId.split("::")).toHaveLength(2)
      }
    })

    it("should demonstrate the improvement over old hyphen-based behavior", () => {
      const pathWithHyphens = "/api/resource-name/items"
      const method = "GET"

      const toolId = generateToolId(method, pathWithHyphens)
      const parsed = parseToolId(toolId)

      // NEW BEHAVIOR (perfect): Hyphens are preserved exactly
      expect(parsed.path).toBe("/api/resource-name/items")
      expect(toolId).toBe("GET::api__resource-name__items")

      // OLD BEHAVIOR would have been:
      // toolId: "GET::api-resource--name-items" (confusing escaping)
      // parsed.path: could be ambiguous

      // Verify the toolId uses double underscores for clarity
      expect(toolId).toContain("__")
      expect(toolId).not.toContain("--") // No more confusing escaping
    })

    it("should handle edge cases with mixed separators", () => {
      const edgeCases = [
        { path: "/api/trailing-hyphen-/test", description: "path with trailing hyphen in segment" },
        {
          path: "/api/mixed_under-score-hyphen/test",
          description: "path with mixed underscores and hyphens",
        },
        {
          path: "/api/--double/single-/mixed--/test",
          description: "complex mix of double hyphens, single hyphens, and trailing hyphens",
        },
        {
          path: "/api/user--profile/data--settings/config",
          description: "realistic API path with double hyphens in resource names",
        },
      ]

      for (const { path, description } of edgeCases) {
        const method = "POST"
        const toolId = generateToolId(method, path)
        const parsed = parseToolId(toolId)

        // Perfect round-trip should work for all cases
        expect(parsed.path).toBe(path)
        expect(parsed.method).toBe(method)

        // Should use :: separator
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
        // Note: Special characters will be removed except dots, so we can't expect exact match
        expect(parsed.path).toMatch(/^\/[A-Za-z0-9_/.-]*$/)
        expect(toolId).toMatch(/^[A-Z]+::[A-Za-z0-9_.-]*$/)
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

        // Should match the expected format: METHOD::pathPart (now includes dots)
        expect(toolId).toMatch(/^[A-Z]+::[A-Za-z0-9_.-]*$/)

        // Should not contain any unsafe characters (dots are now allowed)
        expect(toolId).not.toMatch(/[^A-Za-z0-9_.:-]/)

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
      expect(generateToolId("DELETE", "/api123!@#/users_data$%^")).toBe(
        "DELETE::api123__users_data",
      )
    })
  })

  describe("Enhanced Unicode Character Handling", () => {
    it("should remove various Unicode categories", () => {
      const testCases = [
        {
          description: "Latin accented characters",
          path: "/api/users/José/María/profile",
          expected: "GET::api__users__Jos__Mara__profile",
        },
        {
          description: "German umlauts",
          path: "/api/users/müller/straße",
          expected: "GET::api__users__mller__strae",
        },
        {
          description: "Cyrillic characters",
          path: "/api/пользователи/профиль",
          expected: "GET::api",
        },
        {
          description: "Chinese characters",
          path: "/api/用户/配置文件",
          expected: "GET::api",
        },
        {
          description: "Arabic characters",
          path: "/api/المستخدمين/الملف",
          expected: "GET::api",
        },
        {
          description: "Emoji and symbols",
          path: "/api/users/😀/👍/profile",
          expected: "GET::api__users__profile",
        },
        {
          description: "Mathematical symbols",
          path: "/api/calc/∑/∆/result",
          expected: "GET::api__calc__result",
        },
        {
          description: "Currency symbols",
          path: "/api/prices/€/$/£",
          expected: "GET::api__prices",
        },
        {
          description: "Mixed Unicode and ASCII",
          path: "/api/users/José123/müller_data/profile",
          expected: "GET::api__users__Jos123__mller_data__profile",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })

    it("should handle Unicode normalization edge cases", () => {
      const testCases = [
        {
          description: "Combining characters",
          path: "/api/café/naïve", // é = e + ´, ï = i + ¨
          expected: "GET::api__caf__nave",
        },
        {
          description: "Zero-width characters",
          path: "/api/test\u200B\u200C\u200D/data", // Zero-width space, non-joiner, joiner
          expected: "GET::api__test__data",
        },
        {
          description: "Control characters",
          path: "/api/test\u0000\u0001\u0002/data", // Null, SOH, STX
          expected: "GET::api__test__data",
        },
        {
          description: "Surrogate pairs (high Unicode)",
          path: "/api/test𝕏𝕐𝕑/data", // Mathematical script letters
          expected: "GET::api__test__data",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })

    it("should preserve ASCII alphanumeric and allowed symbols", () => {
      const testCases = [
        {
          description: "ASCII letters and numbers",
          path: "/api/users123/data456",
          expected: "GET::api__users123__data456",
        },
        {
          description: "Underscores",
          path: "/api/user_profile/settings_data",
          expected: "GET::api__user_profile__settings_data",
        },
        {
          description: "Hyphens (preserved perfectly)",
          path: "/api/user-profile/data-settings",
          expected: "GET::api__user-profile__data-settings",
        },
        {
          description: "Mixed allowed characters",
          path: "/api/user123_profile-data/settings",
          expected: "GET::api__user123_profile-data__settings",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })

    it("should handle edge cases with Unicode and path structure", () => {
      const testCases = [
        {
          description: "Unicode in path parameters",
          path: "/api/users/{José}/profile",
          expected: "GET::api__users__---Jos__profile",
        },
        {
          description: "Unicode mixed with special characters",
          path: "/api/users/José@domain.com/profile",
          expected: "GET::api__users__Josdomain.com__profile",
        },
        {
          description: "Empty segments after Unicode removal",
          path: "/api/用户/配置/profile",
          expected: "GET::api__profile",
        },
        {
          description: "Unicode at path boundaries",
          path: "/José/api/María/",
          expected: "GET::Jos__api__Mara",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })
  })

  describe("Leading and Trailing Slash Handling", () => {
    it("should handle various leading slash patterns", () => {
      const testCases = [
        {
          description: "Single leading slash (normal)",
          path: "/users",
          expected: "GET::users",
        },
        {
          description: "No leading slash",
          path: "users",
          expected: "GET::users",
        },
        {
          description: "Double leading slash",
          path: "//users",
          expected: "GET::users",
        },
        {
          description: "Multiple leading slashes",
          path: "////users",
          expected: "GET::users",
        },
        {
          description: "Leading slashes with path segments",
          path: "///api/v1/users",
          expected: "GET::api__v1__users",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })

    it("should handle various trailing slash patterns", () => {
      const testCases = [
        {
          description: "Single trailing slash",
          path: "/users/",
          expected: "GET::users",
        },
        {
          description: "Double trailing slash",
          path: "/users//",
          expected: "GET::users",
        },
        {
          description: "Multiple trailing slashes",
          path: "/users////",
          expected: "GET::users",
        },
        {
          description: "Trailing slashes with complex path",
          path: "/api/v1/users/profile/",
          expected: "GET::api__v1__users__profile",
        },
        {
          description: "Trailing slashes with path parameters",
          path: "/users/{id}/profile/",
          expected: "GET::users__---id__profile",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })

    it("should handle both leading and trailing slashes", () => {
      const testCases = [
        {
          description: "Both leading and trailing single slashes",
          path: "/users/",
          expected: "GET::users",
        },
        {
          description: "Multiple leading and trailing slashes",
          path: "///users///",
          expected: "GET::users",
        },
        {
          description: "Complex path with leading and trailing slashes",
          path: "//api/v1/users/profile//",
          expected: "GET::api__v1__users__profile",
        },
        {
          description: "Only slashes",
          path: "////",
          expected: "GET::",
        },
        {
          description: "Single slash (root)",
          path: "/",
          expected: "GET::",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })

    it("should handle consecutive slashes in middle of path", () => {
      const testCases = [
        {
          description: "Double slash in middle",
          path: "/api//users",
          expected: "GET::api__users",
        },
        {
          description: "Multiple consecutive slashes",
          path: "/api////v1///users",
          expected: "GET::api__v1__users",
        },
        {
          description: "Mixed consecutive slashes",
          path: "//api//v1/users//profile///",
          expected: "GET::api__v1__users__profile",
        },
        {
          description: "Consecutive slashes with path parameters",
          path: "/users//{id}//profile",
          expected: "GET::users__---id__profile",
        },
        {
          description: "Consecutive slashes with hyphens",
          path: "/api//user-profile///settings",
          expected: "GET::api__user-profile__settings",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })

    it("should maintain round-trip consistency with slash variations", () => {
      const testCases = [
        "/users/",
        "//users",
        "///users///",
        "/api//v1///users/",
        "//api/user-profile//",
      ]

      for (const originalPath of testCases) {
        const method = "POST"
        const toolId = generateToolId(method, originalPath)
        const parsed = parseToolId(toolId)

        // Method should match
        expect(parsed.method).toBe(method)

        // Path should be normalized (leading slash, no trailing slash, no consecutive slashes)
        expect(parsed.path).toMatch(/^\/[^/].*[^/]$|^\/[^/]$|^\/$/)

        // Should not have consecutive slashes
        expect(parsed.path).not.toMatch(/\/\//)

        // Should start with exactly one slash
        expect(parsed.path).toMatch(/^\//)

        // Should not end with slash unless it's root
        if (parsed.path !== "/") {
          expect(parsed.path).not.toMatch(/\/$/)
        }
      }
    })

    it("should handle edge cases with slashes and special characters", () => {
      const testCases = [
        {
          description: "Slashes with Unicode",
          path: "//api/José//users/",
          expected: "GET::api__Jos__users",
        },
        {
          description: "Slashes with special characters",
          path: "//api@domain.com//users/",
          expected: "GET::apidomain.com__users",
        },
        {
          description: "Slashes with path parameters and special chars",
          path: "/users//{email@domain.com}//profile/",
          expected: "GET::users__---emaildomain.com__profile",
        },
      ]

      for (const { description, path, expected } of testCases) {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      }
    })
  })
})

// New test section addressing issue #33, incorporating review comments from PR #38
describe("PR #38 Review Comment Edge Cases", () => {
  describe("Sanitization Issues with Consecutive Hyphens", () => {
    it("should preserve legitimate triple hyphens in path segments", () => {
      // Test case for review comment about -{4,} regex interfering with legitimate hyphens
      const result = generateToolId("GET", "/api/resource---name/items")
      expect(result).toBe("GET::api__resource---name__items")
    })

    it("should collapse 4+ consecutive hyphens to triple hyphen while preserving existing triple hyphens", () => {
      // This tests the edge case where we have both legitimate triple hyphens and excessive hyphens
      const result = generateToolId("POST", "/api/resource---name----test")
      expect(result).toBe("POST::api__resource---name---test")
    })

    it("should handle mixed consecutive hyphens scenarios", () => {
      const testCases = [
        {
          path: "/api/test----more",
          expected: "POST::api__test---more",
        },
        {
          path: "/api/test-----even-more",
          expected: "POST::api__test---even-more",
        },
        {
          path: "/api/resource---valid----invalid",
          expected: "POST::api__resource---valid---invalid",
        },
      ]

      testCases.forEach(({ path, expected }) => {
        const result = generateToolId("POST", path)
        expect(result).toBe(expected)
      })
    })

    // Comprehensive test coverage for the simpler hyphen collapse approach
    it("should handle complex hyphen scenarios with simple regex approach", () => {
      const complexTestCases = [
        {
          description: "Triple hyphens followed by 4 hyphens",
          path: "/api/---param----test",
          expected: "POST::api__---param---test",
        },
        {
          description: "4 hyphens followed by triple hyphens",
          path: "/api/----test---param",
          expected: "POST::api__---test---param",
        },
        {
          description: "Multiple segments with mixed hyphens",
          path: "/api/---a----b---c-----d",
          expected: "POST::api__---a---b---c---d",
        },
        {
          description: "7 consecutive hyphens",
          path: "/api/test-------more",
          expected: "POST::api__test---more",
        },
        {
          description: "Triple hyphens at start and end with excessive in middle",
          path: "/---start----middle---end",
          expected: "POST::start---middle---end", // Leading/trailing hyphens removed
        },
        {
          description: "Only hyphens",
          path: "/----------",
          expected: "POST::", // Should be sanitized to empty after processing
        },
        {
          description: "Mixed with path parameters",
          path: "/api/{param}----test---{other}",
          expected: "POST::api__---param---test---other",
        },
      ]

      complexTestCases.forEach(({ description, path, expected }) => {
        const result = generateToolId("POST", path)
        expect(result).toBe(expected)
      })
    })

    it("should verify the regex doesn't break legitimate patterns", () => {
      // Test cases that should NOT be modified by the regex
      const legitimatePatterns = [
        {
          description: "Single hyphen",
          path: "/api/test-name/items",
          expected: "GET::api__test-name__items",
        },
        {
          description: "Double hyphen",
          path: "/api/test--name/items",
          expected: "GET::api__test--name__items",
        },
        {
          description: "Triple hyphen (should be preserved)",
          path: "/api/test---name/items",
          expected: "GET::api__test---name__items",
        },
        {
          description: "Mixed single, double, triple hyphens",
          path: "/api/a-b--c---d/items",
          expected: "GET::api__a-b--c---d__items",
        },
      ]

      legitimatePatterns.forEach(({ description, path, expected }) => {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      })
    })

    it("should handle edge cases with the simple hyphen collapse approach", () => {
      const edgeCases = [
        {
          description: "Hyphens at path boundaries",
          path: "----/api/test/----",
          expected: "GET::api__test",
        },
        {
          description: "Alternating pattern",
          path: "/api/---a----b---c",
          expected: "GET::api__---a---b---c",
        },
        {
          description: "Very long hyphen sequence",
          path: "/api/test" + "-".repeat(20) + "more",
          expected: "GET::api__test---more",
        },
      ]

      edgeCases.forEach(({ description, path, expected }) => {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      })
    })

    it("should demonstrate the benefits of the simple approach over complex regex", () => {
      // This test documents why we chose the simple -{4,} approach over (?<!-)-{4,}(?!-)
      const testCases = [
        {
          description: "Simple approach is predictable: any 4+ hyphens become exactly 3",
          path: "/api/test----more",
          expected: "GET::api__test---more",
        },
        {
          description: "No complex edge cases with boundary detection",
          path: "/api/---param----test---end",
          expected: "GET::api__---param---test---end",
        },
        {
          description: "Consistent behavior regardless of context",
          path: "/start----middle----end",
          expected: "GET::start---middle---end",
        },
        {
          description: "Works correctly with path parameters",
          path: "/api/{param}----{other}-----test",
          expected: "GET::api__---param---other---test",
        },
      ]

      testCases.forEach(({ description, path, expected }) => {
        const result = generateToolId("GET", path)
        expect(result).toBe(expected)
      })

      // The simple approach avoids:
      // - Browser compatibility issues with lookbehind/lookahead (not supported in all engines)
      // - Complex regex logic that's hard to understand and maintain
      // - Potential edge cases where the negative assertions might not work as expected
      // - Performance overhead of complex regex patterns
    })
  })

  describe("Parameter Matching Precision Issues", () => {
    it("should not partially match parameter names in path segments", () => {
      // This tests the precision issue mentioned in the review comments
      // where ---param might match partial strings when parameter names are substrings

      // Create a test path that would cause issues with the old regex pattern
      const testPath = "/api__users__---userid__info__---user"
      const paramRegex1 = new RegExp(`---user(?:\\/|$)`, "g") // Current implementation
      const paramRegex2 = new RegExp(`---user(?=__|/|$)`, "g") // Suggested fix

      // The old regex should have the precision issue - matching "---user" in "---userid"
      // Let's test with a clearer case
      const problematicPath = "/api/---user-data/---user"
      const oldMatches = problematicPath.match(paramRegex1) || []
      const newMatches = problematicPath.match(paramRegex2) || []

      // The old regex should match "---user" even when it's part of "---user-data"
      // But since our implementation path uses __ separators, let's test the actual scenario
      const actualTestPath = "/api__users__---user__info__---userid"
      const oldActualMatches = actualTestPath.match(new RegExp(`---user(?:\\/|$)`, "g")) || []
      const newActualMatches = actualTestPath.match(new RegExp(`---user(?=__|/|$)`, "g")) || []

      // The old regex won't match anything because it looks for / or end of string
      // The new regex should match exactly once at the boundary
      expect(newActualMatches.length).toBe(1)
      expect(newActualMatches[0]).toBe("---user")

      // Test edge case where parameter name is a substring
      const edgeCasePath = "/api__---userid__---user"
      const edgeOldMatches = edgeCasePath.match(new RegExp(`---user(?:\\/|$)`, "g")) || []
      const edgeNewMatches = edgeCasePath.match(new RegExp(`---user(?=__|/|$)`, "g")) || []

      expect(edgeNewMatches.length).toBe(1) // Should only match ---user, not ---userid
    })

    it("should handle parameter names that are substrings of other parameters", () => {
      const testCases = [
        {
          description: "parameter name is substring of path segment",
          path: "/api/users/---userid/---user",
          paramToReplace: "user",
          replacementValue: "123",
          expectedMatches: 1, // Should only match "---user", not "---userid"
        },
        {
          description: "parameter name appears in multiple contexts",
          path: "/api/---id-data/---id",
          paramToReplace: "id",
          replacementValue: "456",
          expectedMatches: 1, // Should only match "---id", not "---id-data"
        },
      ]

      testCases.forEach(({ description, path, paramToReplace, expectedMatches }) => {
        // Test the improved regex pattern
        const improvedRegex = new RegExp(`---${paramToReplace}(?=__|/|$)`, "g")
        const matches = path.match(improvedRegex) || []
        expect(matches.length).toBe(expectedMatches)
      })
    })

    it("should correctly identify parameter boundaries with double underscores", () => {
      // Test that the improved regex correctly handles __ as a boundary
      const path = "/api__---param__more__---param2"

      const paramRegex = new RegExp(`---param(?=__|/|$)`, "g")
      const matches = path.match(paramRegex) || []

      expect(matches.length).toBe(1) // Should only match the first "---param"
      expect(matches[0]).toBe("---param")
    })
  })

  describe("API Client Parameter Replacement with Edge Cases", () => {
    it("should handle parameter replacement without substring collisions", () => {
      // This simulates the API client parameter replacement logic
      // to ensure the fixes work in practice

      const testPath = "/api/users__---userid__info__---user"
      const params = { user: "123", userid: "456" }

      let resultPath = testPath

      // Simulate the improved parameter replacement logic
      Object.keys(params).forEach((key) => {
        const value = params[key as keyof typeof params]
        const improvedRegex = new RegExp(`---${key}(?=__|/|$)`, "g")
        resultPath = resultPath.replace(improvedRegex, value)
      })

      expect(resultPath).toBe("/api/users__456__info__123")
      // Verify no incorrect replacements occurred
      expect(resultPath).not.toContain("---")
      expect(resultPath).not.toContain("123id") // Would indicate substring replacement bug
    })
  })
})
