import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import axios from "axios"
import { ApiClient } from "../src/api-client"

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

  describe("executeApiCall", () => {
    it("should make GET request with correct parameters", async () => {
      await apiClient.executeApiCall("GET-users-list", { page: 1, limit: 10 })

      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/users/list",
        headers: { "X-API-Key": "test-key" },
        params: { page: 1, limit: 10 },
      })
    })

    it("should make POST request with correct body", async () => {
      await apiClient.executeApiCall("POST-users-create", {
        name: "John",
        email: "john@example.com",
      })

      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "post",
        url: "/users/create",
        headers: { "X-API-Key": "test-key" },
        data: { name: "John", email: "john@example.com" },
      })
    })

    it("should convert array parameters to comma-separated strings for GET requests", async () => {
      await apiClient.executeApiCall("GET-users-search", { tags: ["admin", "active"] })

      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/users/search",
        headers: { "X-API-Key": "test-key" },
        params: { tags: "admin,active" },
      })
    })

    it("should return response data on successful request", async () => {
      const result = await apiClient.executeApiCall("GET-users-list", {})
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

      await expect(apiClient.executeApiCall("GET-users-list", {})).rejects.toThrow(
        'API request failed: Request failed (404: {"error":"Not found"})',
      )
    })

    it("should handle non-axios errors", async () => {
      const error = new Error("Network error")
      mockAxiosInstance.mockRejectedValueOnce(error)
      vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)

      await expect(apiClient.executeApiCall("GET-users-list", {})).rejects.toThrow("Network error")
    })

    it("should replace path parameters in URL correctly and remove them from query parameters", async () => {
      await apiClient.executeApiCall("GET-pet-petId", { petId: 1, filter: "all" })
      expect(mockAxiosInstance).toHaveBeenCalledWith({
        method: "get",
        url: "/pet/1",
        headers: { "X-API-Key": "test-key" },
        params: { filter: "all" },
      })
    })
  })

  describe("parseToolId", () => {
    it("should correctly parse tool ID into method and path", async () => {
      await apiClient.executeApiCall("GET-users-profile-details", {})

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: "/users/profile/details",
        }),
      )
    })

    it("should handle hyphens in path segments", async () => {
      await apiClient.executeApiCall("POST-api-v1-user-profile", {})

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "/api/v1/user/profile",
        }),
      )
    })
  })
})
