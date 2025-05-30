import { AuthProvider } from "@ivotoby/openapi-mcp-server"
import { AxiosError } from "axios"

/**
 * Beatport-specific AuthProvider that handles manual token management
 *
 * Beatport requires manual token extraction from browser sessions
 * since they don't provide a public OAuth2 refresh mechanism
 */
export class BeatportAuthProvider implements AuthProvider {
  private token: string | null = null
  private tokenExpiry: Date | null = null

  constructor(initialToken?: string) {
    if (initialToken) {
      this.updateToken(initialToken)
    }
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.token || this.isTokenExpired()) {
      throw new Error(
        "Beatport token expired or not set. Please update your token using the updateToken method.\n\n" +
          "To get a new token:\n" +
          "1. Go to https://www.beatport.com and log in\n" +
          "2. Open browser developer tools (F12)\n" +
          "3. Go to the Network tab\n" +
          "4. Make any API request (search for tracks, etc.)\n" +
          "5. Find a request to api.beatport.com\n" +
          "6. Copy the Authorization header value\n" +
          "7. Call updateToken() with the new token",
      )
    }

    return {
      Authorization: `Bearer ${this.token}`,
      "User-Agent": "Beatport-MCP-Server/1.0.0",
      Accept: "application/json",
    }
  }

  async handleAuthError(error: AxiosError): Promise<boolean> {
    const statusCode = error.response?.status

    if (statusCode === 401) {
      throw new Error(
        "Beatport authentication failed (401 Unauthorized). Your token has expired.\n\n" +
          "To get a new token:\n" +
          "1. Go to https://www.beatport.com and log in\n" +
          "2. Open browser developer tools (F12)\n" +
          "3. Go to the Network tab\n" +
          "4. Search for a track or browse the catalog\n" +
          "5. Look for requests to api.beatport.com in the Network tab\n" +
          "6. Click on any API request\n" +
          '7. In the Headers section, find the "Authorization" header\n' +
          '8. Copy the full value (should start with "Bearer ")\n' +
          "9. Update your token using the updateToken command",
      )
    }

    if (statusCode === 403) {
      throw new Error(
        "Beatport authentication failed (403 Forbidden). Your token may be invalid or you may not have permission to access this resource.\n\n" +
          "Please ensure:\n" +
          "1. You are logged in to Beatport\n" +
          "2. Your account has the necessary permissions\n" +
          "3. Your token is valid and not expired\n" +
          "4. Try getting a fresh token from your browser",
      )
    }

    // Don't retry for manual token management
    return false
  }

  /**
   * Update the Beatport token manually
   *
   * @param token - The bearer token (with or without "Bearer " prefix)
   * @param expiresIn - Token expiry time in seconds (default: 1 hour)
   */
  updateToken(token: string, expiresIn: number = 3600): void {
    // Remove 'Bearer ' prefix if present
    this.token = token.replace(/^Bearer\s+/i, "")

    // Set expiry with a 5-minute buffer for manual tokens
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)

    console.error("✅ Beatport token updated successfully")
    console.error(`   Token expires at: ${this.tokenExpiry.toISOString()}`)
  }

  /**
   * Check if the current token is expired
   * Uses a 5-minute buffer to warn before actual expiry
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true

    // 5-minute buffer for manual tokens
    const bufferTime = 5 * 60 * 1000
    return this.tokenExpiry <= new Date(Date.now() + bufferTime)
  }

  /**
   * Get current token status for debugging
   */
  getTokenStatus(): {
    hasToken: boolean
    isExpired: boolean
    expiresAt: Date | null
    timeUntilExpiry: string | null
  } {
    const hasToken = !!this.token
    const isExpired = this.isTokenExpired()
    const expiresAt = this.tokenExpiry

    let timeUntilExpiry: string | null = null
    if (expiresAt) {
      const msUntilExpiry = expiresAt.getTime() - Date.now()
      if (msUntilExpiry > 0) {
        const minutes = Math.floor(msUntilExpiry / (1000 * 60))
        const hours = Math.floor(minutes / 60)
        const remainingMinutes = minutes % 60

        if (hours > 0) {
          timeUntilExpiry = `${hours}h ${remainingMinutes}m`
        } else {
          timeUntilExpiry = `${remainingMinutes}m`
        }
      } else {
        timeUntilExpiry = "Expired"
      }
    }

    return {
      hasToken,
      isExpired,
      expiresAt,
      timeUntilExpiry,
    }
  }

  /**
   * Clear the current token
   */
  clearToken(): void {
    this.token = null
    this.tokenExpiry = null
    console.error("🗑️  Beatport token cleared")
  }
}
