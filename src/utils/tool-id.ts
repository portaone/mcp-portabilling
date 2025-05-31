/**
 * Utility functions for working with tool IDs
 */

/**
 * Parse a tool ID into HTTP method and path
 *
 * Tool IDs have the format: METHOD::pathPart
 * Where pathPart has slashes converted to hyphens for storage/transmission,
 * legitimate hyphens in path segments are escaped as double hyphens (--),
 * and this function converts them back to the original API path.
 *
 * @param toolId - Tool ID in format METHOD::pathPart
 * @returns Object containing method and path
 *
 * @example
 * parseToolId("GET::users") → { method: "GET", path: "/users" }
 * parseToolId("POST::api-v1-users") → { method: "POST", path: "/api/v1/users" }
 * parseToolId("PUT::user_profile-data") → { method: "PUT", path: "/user_profile/data" }
 * parseToolId("GET::api-resource--name-items") → { method: "GET", path: "/api/resource-name/items" }
 */
export function parseToolId(toolId: string): { method: string; path: string } {
  const [method, pathPart] = toolId.split("::", 2)
  if (!pathPart) {
    return { method, path: "" }
  }

  // Parse the pathPart character by character to handle escaped hyphens correctly
  let result = ""
  let i = 0

  while (i < pathPart.length) {
    if (pathPart[i] === "-") {
      // Check if this is an escaped hyphen (--)
      if (i + 1 < pathPart.length && pathPart[i + 1] === "-") {
        // This is an escaped hyphen, add a literal hyphen to result
        result += "-"
        i += 2 // Skip both hyphens
      } else {
        // This is a path separator, add a slash to result
        result += "/"
        i += 1
      }
    } else {
      // Regular character, add as-is
      result += pathPart[i]
      i += 1
    }
  }

  return { method, path: "/" + result }
}

/**
 * Sanitize a string to contain only safe characters for tool IDs
 *
 * Removes or replaces characters that are not alphanumeric, underscores, or hyphens.
 * This ensures consistent and safe ID formatting while preserving escaped hyphens.
 *
 * Note: This function is designed to work with the hyphen escaping scheme where
 * legitimate hyphens are escaped as double hyphens (--).
 *
 * @param input - String to sanitize (may contain escaped hyphens as --)
 * @returns Sanitized string containing only [A-Za-z0-9_-]
 */
function sanitizeForToolId(input: string): string {
  return input
    .replace(/[^A-Za-z0-9_-]/g, "") // Remove any character not in the allowed set
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
  // Note: We don't collapse consecutive hyphens here because they might be part of our escaping scheme
  // The escaping scheme uses -- to represent legitimate hyphens, so we preserve all hyphen sequences
}

/**
 * Generate a tool ID from HTTP method and path
 *
 * This is the inverse of parseToolId - it converts an API path to the toolId format
 * by escaping legitimate hyphens in path segments (- becomes --), then replacing
 * slashes with single hyphens, removing path parameter braces, and sanitizing
 * special characters to ensure only safe characters [A-Za-z0-9_-] are used.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - API path (e.g., "/users/{id}")
 * @returns Tool ID in format METHOD::pathPart with escaped hyphens and sanitized characters
 *
 * @example
 * generateToolId("GET", "/users") → "GET::users"
 * generateToolId("POST", "/api/v1/users") → "POST::api-v1-users"
 * generateToolId("PUT", "/users/{id}") → "PUT::users-id"
 * generateToolId("GET", "/api/resource-name/items") → "GET::api-resource--name-items"
 * generateToolId("POST", "/user-profile/data") → "POST::user--profile-data"
 * generateToolId("GET", "/api/--existing-double/test") → "GET::api----existing--double-test"
 */
export function generateToolId(method: string, path: string): string {
  const cleanPath = path
    .replace(/^\//, "") // Remove leading slash
    .replace(/\/+/g, "/") // Collapse multiple consecutive slashes to single slash
    .replace(/\{([^}]+)\}/g, "$1") // Remove curly braces from path params
    .replace(/-/g, "--") // Escape legitimate hyphens in path segments
    .replace(/\//g, "-") // Convert slashes to single hyphens

  const sanitizedPath = sanitizeForToolId(cleanPath)

  return `${method.toUpperCase()}::${sanitizedPath}`
}
