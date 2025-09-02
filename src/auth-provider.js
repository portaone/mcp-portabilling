/**
 * Check if an error is authentication-related
 *
 * @param error - The error to check
 * @returns true if the error is authentication-related
 */
export function isAuthError(error) {
    return error.response?.status === 401 || error.response?.status === 403;
}
/**
 * Simple AuthProvider implementation that uses static headers
 * This is used for backward compatibility when no AuthProvider is provided
 */
export class StaticAuthProvider {
    headers;
    constructor(headers = {}) {
        this.headers = headers;
    }
    async getAuthHeaders() {
        return { ...this.headers };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async handleAuthError(_error) {
        // Static auth provider cannot handle auth errors
        return false;
    }
}
//# sourceMappingURL=auth-provider.js.map