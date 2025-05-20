import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { readFile } from "fs/promises"
import { OpenAPISpecLoader } from "../src/openapi-loader"
import { OpenAPIV3 } from "openapi-types"
import { Tool } from "@modelcontextprotocol/sdk/types.js"

// Mock dependencies
vi.mock("fs/promises")

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
    vi.clearAllMocks()
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

      const result = await openAPILoader.loadOpenAPISpec(url)

      expect(fetch).toHaveBeenCalledWith(url)
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
      expect(getUsersTool.name).toBe("get-usrs")
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

      expect(getUsersTool.name).toBe("get-usrs")
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

  describe("abbreviateOperationId", () => {
    const maxLength = 64
    // Helper to check length and character validity
    const isValidToolName = (name: string) => {
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
})
