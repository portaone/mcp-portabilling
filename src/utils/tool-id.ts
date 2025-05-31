/**
 * Utility functions for working with tool IDs
 */

/**
 * Parse a tool ID into HTTP method and path
 *
 * Tool IDs have the format: METHOD::pathPart
 * Where pathPart has slashes converted to hyphens for storage/transmission,
 * and this function converts them back to the original API path.
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
 * Generate a tool ID from HTTP method and path
 *
 * This is the inverse of parseToolId - it converts an API path to the toolId format
 * by replacing slashes with hyphens and removing path parameter braces.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - API path (e.g., "/users/{id}")
 * @returns Tool ID in format METHOD::pathPart
 *
 * @example
 * generateToolId("GET", "/users") → "GET::users"
 * generateToolId("POST", "/api/v1/users") → "POST::api-v1-users"
 * generateToolId("PUT", "/users/{id}") → "PUT::users-id"
 */
export function generateToolId(method: string, path: string): string {
  const cleanPath = path
    .replace(/^\//, "") // Remove leading slash
    .replace(/\{([^}]+)\}/g, "$1") // Remove curly braces from path params
    .replace(/\//g, "-") // Convert slashes to hyphens
  return `${method.toUpperCase()}::${cleanPath}`
}
