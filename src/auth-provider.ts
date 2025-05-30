import { AxiosError } from "axios"

/**
 * Interface for providing authentication headers and handling authentication errors
 */
export interface AuthProvider {
  /**
   * Get authentication headers for the current request
   * This method is called before each API request to get fresh headers
   *
   * @returns Promise that resolves to headers object
   * @throws Error if authentication is not available (e.g., token expired)
   */
  getAuthHeaders(): Promise<Record<string, string>>

  /**
   * Handle authentication errors from API responses
   * This is called when the API returns authentication-related errors (401, 403)
   *
   * @param error - The axios error from the failed request
   * @returns Promise that resolves to true if the request should be retried, false otherwise
   */
  handleAuthError(error: AxiosError): Promise<boolean>
}

/**
 * Check if an error is authentication-related
 *
 * @param error - The error to check
 * @returns true if the error is authentication-related
 */
export function isAuthError(error: AxiosError): boolean {
  return error.response?.status === 401 || error.response?.status === 403
}

/**
 * Simple AuthProvider implementation that uses static headers
 * This is used for backward compatibility when no AuthProvider is provided
 */
export class StaticAuthProvider implements AuthProvider {
  constructor(private headers: Record<string, string> = {}) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    return { ...this.headers }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handleAuthError(_error: AxiosError): Promise<boolean> {
    // Static auth provider cannot handle auth errors
    return false
  }
}
