import axios, { AxiosInstance, AxiosError } from "axios"
import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { AuthProvider, StaticAuthProvider, isAuthError } from "./auth-provider.js"

/**
 * Client for making API calls to the backend service
 */
export class ApiClient {
  private axiosInstance: AxiosInstance
  private toolsMap: Map<string, Tool> = new Map()
  private authProvider: AuthProvider

  /**
   * Create a new API client
   *
   * @param baseUrl - Base URL for the API
   * @param authProviderOrHeaders - AuthProvider instance or static headers for backward compatibility
   */
  constructor(baseUrl: string, authProviderOrHeaders?: AuthProvider | Record<string, string>) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
    })

    // Handle backward compatibility
    if (!authProviderOrHeaders) {
      this.authProvider = new StaticAuthProvider()
    } else if (
      typeof authProviderOrHeaders === "object" &&
      !("getAuthHeaders" in authProviderOrHeaders)
    ) {
      // It's a headers object (backward compatibility)
      this.authProvider = new StaticAuthProvider(authProviderOrHeaders)
    } else {
      // It's an AuthProvider
      this.authProvider = authProviderOrHeaders as AuthProvider
    }
  }

  /**
   * Set the available tools for the client
   *
   * @param tools - Map of tool ID to tool definition
   */
  setTools(tools: Map<string, Tool>): void {
    this.toolsMap = tools
  }

  /**
   * Get a tool definition by ID
   *
   * @param toolId - The tool ID
   * @returns The tool definition if found
   */
  private getToolDefinition(toolId: string): Tool | undefined {
    return this.toolsMap.get(toolId)
  }

  /**
   * Execute an API call based on the tool ID and parameters
   *
   * @param toolId - The tool ID in format METHOD-path-parts
   * @param params - Parameters for the API call
   * @returns The API response data
   */
  async executeApiCall(toolId: string, params: Record<string, any>): Promise<any> {
    return this.executeApiCallWithRetry(toolId, params, false)
  }

  /**
   * Execute an API call with optional retry on auth error
   *
   * @param toolId - The tool ID in format METHOD-path-parts
   * @param params - Parameters for the API call
   * @param isRetry - Whether this is a retry attempt
   * @returns The API response data
   */
  private async executeApiCallWithRetry(
    toolId: string,
    params: Record<string, any>,
    isRetry: boolean,
  ): Promise<any> {
    try {
      // Parse method and path from the tool ID
      const { method, path } = this.parseToolId(toolId)

      // Get the tool definition, if available
      const toolDef = this.getToolDefinition(toolId)

      // Interpolate path parameters into the URL and remove them from params
      const paramsCopy: Record<string, any> = { ...params }
      let resolvedPath = path

      // Helper function to escape regex special characters
      const escapeRegExp = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
      }

      // Handle path parameters
      if (toolDef?.inputSchema?.properties) {
        // Check each parameter to see if it's a path parameter
        for (const [key, value] of Object.entries(paramsCopy)) {
          const paramDef = toolDef.inputSchema.properties[key]
          // Get the parameter location from the extended schema
          const paramDef_any = paramDef as any
          const paramLocation = paramDef_any?.["x-parameter-location"]

          // If it's a path parameter, interpolate it into the URL and remove from params
          if (paramLocation === "path") {
            // Escape key before using it in regex patterns
            const escapedKey = escapeRegExp(key)
            // Try standard OpenAPI and Express-style parameters first
            const paramRegex = new RegExp(`\\{${escapedKey}\\}|:${escapedKey}(?:\\/|$)`, "g")

            // If specific parameter style was found, use it
            if (paramRegex.test(resolvedPath)) {
              resolvedPath = resolvedPath.replace(
                paramRegex,
                (match) => encodeURIComponent(value) + (match.endsWith("/") ? "/" : ""),
              )
            } else {
              // Fall back to the original simple replacement for backward compatibility
              resolvedPath = resolvedPath.replace(`/${key}`, `/${encodeURIComponent(value)}`)
            }
            delete paramsCopy[key]
          }
        }
      } else {
        // Fallback behavior if tool definition is not available
        for (const key of Object.keys(paramsCopy)) {
          const value = paramsCopy[key]
          // Escape key before using it in regex patterns
          const escapedKey = escapeRegExp(key)
          // First try standard OpenAPI and Express-style parameters
          const paramRegex = new RegExp(`\\{${escapedKey}\\}|:${escapedKey}(?:\\/|$)`, "g")

          // If found, replace using regex
          if (paramRegex.test(resolvedPath)) {
            resolvedPath = resolvedPath.replace(
              paramRegex,
              (match) => encodeURIComponent(value) + (match.endsWith("/") ? "/" : ""),
            )
            delete paramsCopy[key]
          }
          // Fall back to original simple replacement for backward compatibility
          else if (resolvedPath.includes(`/${key}`)) {
            resolvedPath = resolvedPath.replace(`/${key}`, `/${encodeURIComponent(value)}`)
            delete paramsCopy[key]
          }
        }
      }

      // Get fresh authentication headers
      const authHeaders = await this.authProvider.getAuthHeaders()

      // Prepare request configuration
      const config: any = {
        method: method.toLowerCase(),
        url: resolvedPath,
        headers: authHeaders,
      }

      // Handle parameters based on HTTP method
      if (["get", "delete", "head", "options"].includes(method.toLowerCase())) {
        // For GET-like methods, parameters go in the query string
        config.params = this.processQueryParams(paramsCopy)
      } else {
        // For POST-like methods, parameters go in the request body
        config.data = paramsCopy
      }

      // Execute the request
      const response = await this.axiosInstance(config)
      return response.data
    } catch (error) {
      // Handle errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError

        // Check if it's an authentication error and we haven't already retried
        if (!isRetry && isAuthError(axiosError)) {
          try {
            const shouldRetry = await this.authProvider.handleAuthError(axiosError)
            if (shouldRetry) {
              // Retry the request once
              return this.executeApiCallWithRetry(toolId, params, true)
            }
          } catch (authHandlerError) {
            // If auth handler throws, use that error instead
            throw authHandlerError
          }
        }

        throw new Error(
          `API request failed: ${axiosError.message}${
            axiosError.response
              ? ` (${axiosError.response.status}: ${
                  typeof axiosError.response.data === "object"
                    ? JSON.stringify(axiosError.response.data)
                    : axiosError.response.data
                })`
              : ""
          }`,
        )
      }
      throw error
    }
  }

  /**
   * Parse a tool ID into HTTP method and path
   *
   * @param toolId - Tool ID in format METHOD-path-parts
   * @returns Object containing method and path
   */
  private parseToolId(toolId: string): { method: string; path: string } {
    const [method, ...pathParts] = toolId.split("-")
    const path = "/" + pathParts.join("/").replace(/-/g, "/")
    return { method, path }
  }

  /**
   * Process query parameters for GET requests
   * Converts arrays to comma-separated strings
   *
   * @param params - The original parameters
   * @returns Processed parameters
   */
  private processQueryParams(
    params: Record<string, any>,
  ): Record<string, string | number | boolean> {
    const result: Record<string, string | number | boolean> = {}

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        result[key] = value.join(",")
      } else {
        result[key] = value
      }
    }

    return result
  }
}
