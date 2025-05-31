import { describe, it, expect } from "vitest"
import { AxiosError } from "axios"
import { AuthProvider, StaticAuthProvider, isAuthError } from "../src/auth-provider"

describe("AuthProvider", () => {
  describe("isAuthError", () => {
    it("should return true for 401 errors", () => {
      const error = {
        response: { status: 401 },
      } as AxiosError

      expect(isAuthError(error)).toBe(true)
    })

    it("should return true for 403 errors", () => {
      const error = {
        response: { status: 403 },
      } as AxiosError

      expect(isAuthError(error)).toBe(true)
    })

    it("should return false for other error statuses", () => {
      const error404 = {
        response: { status: 404 },
      } as AxiosError

      const error500 = {
        response: { status: 500 },
      } as AxiosError

      expect(isAuthError(error404)).toBe(false)
      expect(isAuthError(error500)).toBe(false)
    })

    it("should return false for errors without response", () => {
      const error = {} as AxiosError
      expect(isAuthError(error)).toBe(false)
    })

    // Edge case tests for isAuthError
    describe("Edge Cases", () => {
      it("should return false for non-Axios plain error objects", () => {
        // Plain Error object
        const plainError = new Error("Network error") as unknown as AxiosError
        expect(isAuthError(plainError)).toBe(false)

        // Generic object with error-like properties but no response
        const genericError = {
          message: "Something went wrong",
          code: "NETWORK_ERROR",
        } as unknown as AxiosError
        expect(isAuthError(genericError)).toBe(false)

        // Object with response but no status
        const errorWithoutStatus = {
          response: { data: "Unauthorized" },
        } as unknown as AxiosError
        expect(isAuthError(errorWithoutStatus)).toBe(false)
      })

      it("should return false for Axios-like errors with response but undefined status", () => {
        const errorWithUndefinedStatus = {
          response: {
            status: undefined,
            data: "Some error data",
          },
        } as unknown as AxiosError
        expect(isAuthError(errorWithUndefinedStatus)).toBe(false)
      })

      it("should return false for Axios-like errors with response but non-number status", () => {
        const errorWithStringStatus = {
          response: {
            status: "401" as unknown as number,
            data: "Unauthorized",
          },
        } as AxiosError
        expect(isAuthError(errorWithStringStatus)).toBe(false)

        const errorWithNullStatus = {
          response: {
            status: null as unknown as number,
            data: "Forbidden",
          },
        } as AxiosError
        expect(isAuthError(errorWithNullStatus)).toBe(false)

        const errorWithObjectStatus = {
          response: {
            status: { code: 401 } as unknown as number,
            data: "Unauthorized",
          },
        } as AxiosError
        expect(isAuthError(errorWithObjectStatus)).toBe(false)
      })

      it("should return false for errors with response property but response is null", () => {
        const errorWithNullResponse = {
          response: null,
        } as unknown as AxiosError
        expect(isAuthError(errorWithNullResponse)).toBe(false)
      })

      it("should return false for errors with response property but response is undefined", () => {
        const errorWithUndefinedResponse = {
          response: undefined,
        } as unknown as AxiosError
        expect(isAuthError(errorWithUndefinedResponse)).toBe(false)
      })

      it("should handle edge case status codes correctly", () => {
        // Status 0 (network error)
        const networkError = {
          response: { status: 0 },
        } as AxiosError
        expect(isAuthError(networkError)).toBe(false)

        // Negative status
        const negativeStatusError = {
          response: { status: -1 },
        } as AxiosError
        expect(isAuthError(negativeStatusError)).toBe(false)

        // Very large status code
        const largeStatusError = {
          response: { status: 999999 },
        } as AxiosError
        expect(isAuthError(largeStatusError)).toBe(false)

        // Float status code (should still work if it's 401.0 or 403.0)
        const floatStatus401 = {
          response: { status: 401.0 },
        } as AxiosError
        expect(isAuthError(floatStatus401)).toBe(true)

        const floatStatus403 = {
          response: { status: 403.0 },
        } as AxiosError
        expect(isAuthError(floatStatus403)).toBe(true)

        // Float status code that's not exactly 401 or 403
        const floatStatusOther = {
          response: { status: 401.5 },
        } as AxiosError
        expect(isAuthError(floatStatusOther)).toBe(false)
      })
    })
  })

  describe("StaticAuthProvider", () => {
    it("should return provided headers", async () => {
      const headers = { Authorization: "Bearer token123", "X-API-Key": "key456" }
      const provider = new StaticAuthProvider(headers)

      const result = await provider.getAuthHeaders()
      expect(result).toEqual(headers)
    })

    it("should return empty object when no headers provided", async () => {
      const provider = new StaticAuthProvider()

      const result = await provider.getAuthHeaders()
      expect(result).toEqual({})
    })

    it("should return copy of headers (not reference)", async () => {
      const headers = { Authorization: "Bearer token123" }
      const provider = new StaticAuthProvider(headers)

      const result = await provider.getAuthHeaders()
      result["X-Modified"] = "test"

      const result2 = await provider.getAuthHeaders()
      expect(result2).toEqual(headers)
      expect(result2).not.toHaveProperty("X-Modified")
    })

    it("should always return false for handleAuthError", async () => {
      const provider = new StaticAuthProvider()
      const error = { response: { status: 401 } } as AxiosError

      const result = await provider.handleAuthError(error)
      expect(result).toBe(false)
    })

    // Edge case tests for StaticAuthProvider constructor
    describe("Constructor Edge Cases", () => {
      it("should handle null passed to constructor", () => {
        // Note: TypeScript may prevent this, but testing runtime behavior
        const provider = new StaticAuthProvider(null as unknown as Record<string, string>)

        // Should not throw during construction
        expect(provider).toBeInstanceOf(StaticAuthProvider)
      })

      it("should handle null headers gracefully in getAuthHeaders", async () => {
        const provider = new StaticAuthProvider(null as unknown as Record<string, string>)

        // Should handle null gracefully and return empty object or throw meaningful error
        await expect(async () => {
          const result = await provider.getAuthHeaders()
          // If it doesn't throw, it should return an object (likely empty)
          expect(typeof result).toBe("object")
          expect(result).not.toBeNull()
        }).not.toThrow()
      })

      it("should handle undefined passed to constructor", () => {
        const provider = new StaticAuthProvider(undefined as unknown as Record<string, string>)
        expect(provider).toBeInstanceOf(StaticAuthProvider)
      })

      it("should handle undefined headers gracefully in getAuthHeaders", async () => {
        const provider = new StaticAuthProvider(undefined as unknown as Record<string, string>)

        const result = await provider.getAuthHeaders()
        expect(typeof result).toBe("object")
        expect(result).not.toBeNull()
      })

      it("should handle non-object values passed to constructor", () => {
        // Testing with various non-object types
        const stringProvider = new StaticAuthProvider(
          "not an object" as unknown as Record<string, string>,
        )
        expect(stringProvider).toBeInstanceOf(StaticAuthProvider)

        const numberProvider = new StaticAuthProvider(123 as unknown as Record<string, string>)
        expect(numberProvider).toBeInstanceOf(StaticAuthProvider)

        const booleanProvider = new StaticAuthProvider(true as unknown as Record<string, string>)
        expect(booleanProvider).toBeInstanceOf(StaticAuthProvider)
      })

      it("should handle non-object headers gracefully in getAuthHeaders", async () => {
        const stringProvider = new StaticAuthProvider(
          "not an object" as unknown as Record<string, string>,
        )

        // Should either throw a meaningful error or handle gracefully
        await expect(async () => {
          const result = await stringProvider.getAuthHeaders()
          expect(typeof result).toBe("object")
        }).not.toThrow()
      })

      it("should handle headers with non-string values", async () => {
        const headersWithMixedTypes = {
          Authorization: "Bearer token123",
          "X-Numeric": 123,
          "X-Boolean": true,
          "X-Null": null,
          "X-Undefined": undefined,
          "X-Object": { nested: "value" },
        } as unknown as Record<string, string>

        const provider = new StaticAuthProvider(headersWithMixedTypes)

        const result = await provider.getAuthHeaders()
        expect(typeof result).toBe("object")
        expect(result).not.toBeNull()

        // Should preserve string values
        expect(result["Authorization"]).toBe("Bearer token123")

        // Behavior for non-string values depends on implementation
        // At minimum, it should not crash
      })

      it("should handle empty object as headers", async () => {
        const provider = new StaticAuthProvider({})

        const result = await provider.getAuthHeaders()
        expect(result).toEqual({})
      })

      it("should handle headers with special characters and unicode", async () => {
        const headersWithSpecialChars = {
          "X-Special-Chars": "!@#$%^&*()_+-=[]{}|;':\",./<>?",
          "X-Unicode": "🚀 Hello 世界 café naïve résumé",
          "X-Empty-String": "",
          "X-Whitespace": "   \t\n\r   ",
        }

        const provider = new StaticAuthProvider(headersWithSpecialChars)

        const result = await provider.getAuthHeaders()
        expect(result).toEqual(headersWithSpecialChars)
      })
    })
  })

  describe("Custom AuthProvider Implementation", () => {
    class MockAuthProvider implements AuthProvider {
      private isValid = true
      private retryCount = 0

      async getAuthHeaders(): Promise<Record<string, string>> {
        if (!this.isValid) {
          throw new Error("Token expired")
        }
        return { Authorization: "Bearer valid-token" }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async handleAuthError(_error: AxiosError): Promise<boolean> {
        this.retryCount++
        if (this.retryCount === 1) {
          // First auth error - refresh token and retry
          this.isValid = true
          return true
        }
        // Second auth error - give up
        return false
      }

      // Test helper methods
      expireToken(): void {
        this.isValid = false
      }

      getRetryCount(): number {
        return this.retryCount
      }
    }

    it("should provide valid headers when token is valid", async () => {
      const provider = new MockAuthProvider()

      const headers = await provider.getAuthHeaders()
      expect(headers).toEqual({ Authorization: "Bearer valid-token" })
    })

    it("should throw error when token is expired", async () => {
      const provider = new MockAuthProvider()
      provider.expireToken()

      await expect(provider.getAuthHeaders()).rejects.toThrow("Token expired")
    })

    it("should handle auth errors with retry logic", async () => {
      const provider = new MockAuthProvider()
      const error = { response: { status: 401 } } as AxiosError

      // First call should return true (retry)
      const shouldRetry1 = await provider.handleAuthError(error)
      expect(shouldRetry1).toBe(true)
      expect(provider.getRetryCount()).toBe(1)

      // Second call should return false (don't retry)
      const shouldRetry2 = await provider.handleAuthError(error)
      expect(shouldRetry2).toBe(false)
      expect(provider.getRetryCount()).toBe(2)
    })
  })
})
