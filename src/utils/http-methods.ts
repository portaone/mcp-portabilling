/**
 * HTTP method categorization utilities
 */

export const VALID_HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
] as const

export const GET_LIKE_METHODS = ["get", "delete", "head", "options"] as const

export const POST_LIKE_METHODS = ["post", "put", "patch"] as const

/**
 * Check if an HTTP method is valid
 */
export function isValidHttpMethod(method: string): boolean {
  return VALID_HTTP_METHODS.includes(method.toLowerCase() as any)
}

/**
 * Check if an HTTP method uses query parameters (GET-like)
 */
export function isGetLikeMethod(method: string): boolean {
  return GET_LIKE_METHODS.includes(method.toLowerCase() as any)
}

/**
 * Check if an HTTP method uses request body (POST-like)
 */
export function isPostLikeMethod(method: string): boolean {
  return POST_LIKE_METHODS.includes(method.toLowerCase() as any)
}
