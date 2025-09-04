import { AxiosError } from "axios";
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
    getAuthHeaders(): Promise<Record<string, string>>;
    /**
     * Handle authentication errors from API responses
     * This is called when the API returns authentication-related errors (401, 403)
     *
     * @param error - The axios error from the failed request
     * @returns Promise that resolves to true if the request should be retried, false otherwise
     */
    handleAuthError(error: AxiosError): Promise<boolean>;
}
/**
 * Check if an error is authentication-related
 *
 * @param error - The error to check
 * @returns true if the error is authentication-related
 */
export declare function isAuthError(error: AxiosError): boolean;
/**
 * Simple AuthProvider implementation that uses static headers
 * This is used for backward compatibility when no AuthProvider is provided
 */
export declare class StaticAuthProvider implements AuthProvider {
    private headers;
    constructor(headers?: Record<string, string>);
    getAuthHeaders(): Promise<Record<string, string>>;
    handleAuthError(_error: AxiosError): Promise<boolean>;
}
//# sourceMappingURL=auth-provider.d.ts.map