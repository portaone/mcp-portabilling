/**
 * Utility functions for working with tool IDs
 */

/**
 * Parse a tool ID into HTTP method and path
 *
 * Tool IDs have the format: METHOD::pathPart
 * Where pathPart has slashes converted to hyphens for storage/transmission,
 * special characters sanitized, and this function converts them back to the original API path.
 *
 * @param toolId - Tool ID in format METHOD::pathPart
 * @returns Object containing method and path
 *
 * @example
 * parseToolId("GET::users") → { method: "GET", path: "/users" }
 * parseToolId("POST::api-v1-users") → { method: "POST", path: "/api/v1/users" }
 * parseToolId("PUT::user_profile-data") → { method: "PUT", path: "/user_profile/data" }
 */
export function parseToolId(toolId: string): { method: string; path: string } {
  const [method, pathPart] = toolId.split("::", 2)
  const path = pathPart ? "/" + pathPart.replace(/-/g, "/") : ""
  return { method, path }
}

/**
 * Sanitize a string to contain only safe characters for tool IDs
 *
 * Removes or replaces characters that are not alphanumeric, underscores, or hyphens.
 * This ensures consistent and safe ID formatting.
 *
 * @param input - String to sanitize
 * @returns Sanitized string containing only [A-Za-z0-9_-]
 */
function sanitizeForToolId(input: string): string {
  return input
    .replace(/[^A-Za-z0-9_-]/g, "") // Remove any character not in the allowed set
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .replace(/-{2,}/g, "-") // Replace multiple consecutive hyphens with single hyphen
}

/**
 * Generate a tool ID from HTTP method and path
 *
 * This is the inverse of parseToolId - it converts an API path to the toolId format
 * by replacing slashes with hyphens, removing path parameter braces, and sanitizing
 * special characters to ensure only safe characters [A-Za-z0-9_-] are used.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - API path (e.g., "/users/{id}")
 * @returns Tool ID in format METHOD::pathPart with sanitized characters
 *
 * @example
 * generateToolId("GET", "/users") → "GET::users"
 * generateToolId("POST", "/api/v1/users") → "POST::api-v1-users"
 * generateToolId("PUT", "/users/{id}") → "PUT::users-id"
 * generateToolId("GET", "/users/{user-id}/posts") → "GET::users-user-id-posts"
 * generateToolId("POST", "/api/v2.1/users@domain") → "POST::api-v21-usersdomain"
 */
export function generateToolId(method: string, path: string): string {
  const cleanPath = path
    .replace(/^\//, "") // Remove leading slash
    .replace(/\{([^}]+)\}/g, "$1") // Remove curly braces from path params
    .replace(/\//g, "-") // Convert slashes to hyphens

  const sanitizedPath = sanitizeForToolId(cleanPath)

  return `${method.toUpperCase()}::${sanitizedPath}`
}
