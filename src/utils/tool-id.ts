/**
 * Utility functions for working with tool IDs
 */

/**
 * Parse a tool ID into HTTP method and path
 *
 * Tool IDs have the format: METHOD::pathPart
 * Where pathPart has slashes converted to double underscores (__) for storage/transmission.
 * This approach avoids the ambiguity issues with hyphen-based escaping since double
 * underscores are extremely rare in real API paths.
 *
 * @param toolId - Tool ID in format METHOD::pathPart
 * @returns Object containing method and path
 *
 * @example
 * parseToolId("GET::users") → { method: "GET", path: "/users" }
 * parseToolId("POST::api__v1__users") → { method: "POST", path: "/api/v1/users" }
 * parseToolId("PUT::user_profile__data") → { method: "PUT", path: "/user_profile/data" }
 * parseToolId("GET::api__resource-name__items") → { method: "GET", path: "/api/resource-name/items" }
 */
export function parseToolId(toolId: string): { method: string; path: string } {
  const [method, pathPart] = toolId.split("::", 2)
  if (!pathPart) {
    return { method, path: "" }
  }

  // Simply replace double underscores with slashes - no complex escaping needed
  const path = pathPart.replace(/__/g, "/")

  return { method, path: "/" + path }
}

/**
 * Sanitize a string to contain only safe characters for tool IDs
 *
 * Removes or replaces characters that are not alphanumeric, underscores, or hyphens.
 * This ensures consistent and safe ID formatting while preserving double underscores
 * which are used as path separators and triple-dash markers for path parameters.
 *
 * @param input - String to sanitize
 * @returns Sanitized string containing only [A-Za-z0-9_-]
 */
function sanitizeForToolId(input: string): string {
  return input
    .replace(/[^A-Za-z0-9_-]/g, "") // Remove any character not in the allowed set
    .replace(/_{3,}/g, "__") // Collapse 3+ consecutive underscores to double underscore (preserve path separators)
    .replace(/(?<!-)-{4,}(?!-)/g, "---") // Collapse 4+ consecutive hyphens to triple hyphen, excluding valid triple hyphen markers
    .replace(/^[_-]+|[_-]+$/g, "") // Remove leading/trailing underscores and hyphens
}

/**
 * Generate a tool ID from HTTP method and path
 *
 * This converts an API path to the toolId format by replacing slashes with double
 * underscores (__), transforming path parameter braces to unique markers, and sanitizing special characters
 * to ensure only safe characters [A-Za-z0-9_-] are used.
 *
 * The double underscore approach eliminates the ambiguity issues of the previous
 * hyphen-based escaping scheme since __ is extremely rare in real API paths.
 * Path parameters {param} are converted to ---param to preserve the parameter location
 * information for accurate replacement during API calls.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - API path (e.g., "/users/{id}")
 * @returns Tool ID in format METHOD::pathPart with double underscores as separators
 *
 * @example
 * generateToolId("GET", "/users") → "GET::users"
 * generateToolId("POST", "/api/v1/users") → "POST::api__v1__users"
 * generateToolId("PUT", "/users/{id}") → "PUT::users__---id"
 * generateToolId("GET", "/inputs/{input}") → "GET::inputs__---input"
 * generateToolId("GET", "/api/resource-name/items") → "GET::api__resource-name__items"
 * generateToolId("POST", "/user-profile/data") → "POST::user-profile__data"
 * generateToolId("GET", "/api/--existing-double/test") → "GET::api__--existing-double__test"
 */
export function generateToolId(method: string, path: string): string {
  // Clean up the path structure
  const cleanPath = path
    .replace(/^\//, "") // Remove leading slash
    .replace(/\/+/g, "/") // Collapse multiple consecutive slashes to single slash
    .replace(/\{([^}]+)\}/g, "---$1") // Transform path params to unique markers
    .replace(/\//g, "__") // Convert slashes to double underscores

  const sanitizedPath = sanitizeForToolId(cleanPath)

  return `${method.toUpperCase()}::${sanitizedPath}`
}
