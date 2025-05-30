import { describe, it, expect, vi } from "vitest"
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
      expireToken() {
        this.isValid = false
      }

      getRetryCount() {
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
