import { AuthProvider } from "@ivotoby/openapi-mcp-server"
import { AxiosError } from "axios"

/**
 * Example AuthProvider that handles token expiration and refresh
 * This demonstrates automatic token refresh capabilities
 */
export class RefreshableAuthProvider implements AuthProvider {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiry: Date | null = null
  private refreshUrl: string

  constructor(refreshUrl: string, initialAccessToken?: string, initialRefreshToken?: string) {
    this.refreshUrl = refreshUrl
    this.accessToken = initialAccessToken || null
    this.refreshToken = initialRefreshToken || null
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    // Check if token is expired or about to expire (1 minute buffer)
    if (!this.accessToken || this.isTokenExpired()) {
      if (this.refreshToken) {
        await this.refreshAccessToken()
      } else {
        throw new Error(
          "Access token expired and no refresh token available. Please re-authenticate.",
        )
      }
    }

    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    }
  }

  async handleAuthError(error: AxiosError): Promise<boolean> {
    // If we get a 401/403, try to refresh the token
    if ((error.response?.status === 401 || error.response?.status === 403) && this.refreshToken) {
      try {
        await this.refreshAccessToken()
        return true // Retry the request with new token
      } catch (refreshError) {
        throw new Error(
          "Failed to refresh access token. Please re-authenticate with your credentials.",
        )
      }
    }

    return false // Don't retry for other errors
  }

  /**
   * Set initial tokens
   */
  setTokens(accessToken: string, refreshToken: string, expiresIn: number = 3600): void {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)
  }

  /**
   * Check if the current token is expired (with 1 minute buffer)
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true
    return this.tokenExpiry <= new Date(Date.now() + 60000) // 1 minute buffer
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available")
    }

    // This is a mock implementation - replace with your actual refresh logic
    const response = await fetch(this.refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token || this.refreshToken
    this.tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000)
  }
}

/**
 * Example AuthProvider for APIs that require manual token updates
 * This is useful for APIs like Beatport where automatic refresh isn't possible
 */
export class ManualTokenAuthProvider implements AuthProvider {
  private token: string | null = null
  private tokenExpiry: Date | null = null
  private apiName: string

  constructor(apiName: string = "API") {
    this.apiName = apiName
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.token || this.isTokenExpired()) {
      throw new Error(
        `${this.apiName} token expired or not set. Please update your token using the updateToken method.`,
      )
    }

    return {
      Authorization: `Bearer ${this.token}`,
      "User-Agent": `${this.apiName}-MCP-Server/1.0.0`,
    }
  }

  async handleAuthError(error: AxiosError): Promise<boolean> {
    // For manual token management, we can't auto-retry
    // Provide helpful error message instead
    const statusCode = error.response?.status
    if (statusCode === 401 || statusCode === 403) {
      throw new Error(
        `${this.apiName} authentication failed (${statusCode}). Your token may be expired or invalid.\n\n` +
          "To get a new token:\n" +
          `1. Visit the ${this.apiName} website and log in\n` +
          "2. Open browser developer tools (F12)\n" +
          "3. Go to Network tab and make an API request\n" +
          "4. Copy the Authorization header value\n" +
          "5. Update your token using the updateToken method",
      )
    }

    return false // Never retry for manual token management
  }

  /**
   * Update the token manually
   */
  updateToken(token: string, expiresIn: number = 3600): void {
    // Remove 'Bearer ' prefix if present
    this.token = token.replace(/^Bearer\s+/i, "")
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)
    console.error(`✅ ${this.apiName} token updated successfully`)
  }

  /**
   * Check if token is expired (with 5 minute buffer for manual tokens)
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true
    return this.tokenExpiry <= new Date(Date.now() + 300000) // 5 minute buffer
  }

  /**
   * Get token status for debugging
   */
  getTokenStatus(): { hasToken: boolean; isExpired: boolean; expiresAt: Date | null } {
    return {
      hasToken: !!this.token,
      isExpired: this.isTokenExpired(),
      expiresAt: this.tokenExpiry,
    }
  }
}

/**
 * Example AuthProvider for API key authentication
 * This is for APIs that use API keys instead of bearer tokens
 */
export class ApiKeyAuthProvider implements AuthProvider {
  private apiKey: string
  private keyHeader: string

  constructor(apiKey: string, keyHeader: string = "X-API-Key") {
    this.apiKey = apiKey
    this.keyHeader = keyHeader
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.apiKey) {
      throw new Error("API key is required but not set")
    }

    return {
      [this.keyHeader]: this.apiKey,
      "Content-Type": "application/json",
    }
  }

  async handleAuthError(error: AxiosError): Promise<boolean> {
    // API keys typically don't expire, so auth errors are usually permanent
    const statusCode = error.response?.status
    if (statusCode === 401 || statusCode === 403) {
      throw new Error(
        `API key authentication failed (${statusCode}). Please check that your API key is valid and has the required permissions.`,
      )
    }

    return false
  }

  /**
   * Update the API key
   */
  updateApiKey(newApiKey: string): void {
    this.apiKey = newApiKey
    console.error("✅ API key updated successfully")
  }
}
