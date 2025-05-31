import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { OpenAPISpecLoader, ExtendedTool } from "./openapi-loader"
import { OpenAPIMCPServerConfig } from "./config"
import { OpenAPIV3 } from "openapi-types"
import { parseToolId as parseToolIdUtil } from "./utils/tool-id.js"

/**
 * Manages the tools available in the MCP server
 */
export class ToolsManager {
  private tools: Map<string, Tool> = new Map()
  private specLoader: OpenAPISpecLoader

  constructor(private config: OpenAPIMCPServerConfig) {
    // Ensure toolsMode has a default value of 'all'
    this.config.toolsMode = this.config.toolsMode || "all"
    this.specLoader = new OpenAPISpecLoader({
      disableAbbreviation: this.config.disableAbbreviation,
    })
  }

  /**
   * Create dynamic discovery meta-tools
   */
  private createDynamicTools(): Map<string, Tool> {
    const dynamicTools = new Map<string, Tool>()

    // LIST-API-ENDPOINTS
    dynamicTools.set("LIST-API-ENDPOINTS", {
      name: "list-api-endpoints",
      description: "List all available API endpoints",
      inputSchema: { type: "object", properties: {} },
    })

    // GET-API-ENDPOINT-SCHEMA
    dynamicTools.set("GET-API-ENDPOINT-SCHEMA", {
      name: "get-api-endpoint-schema",
      description: "Get the JSON schema for a specified API endpoint",
      inputSchema: {
        type: "object",
        properties: {
          endpoint: { type: "string", description: "Endpoint path (e.g. /users/{id})" },
        },
        required: ["endpoint"],
      },
    })

    // INVOKE-API-ENDPOINT
    dynamicTools.set("INVOKE-API-ENDPOINT", {
      name: "invoke-api-endpoint",
      description: "Invoke an API endpoint with provided parameters",
      inputSchema: {
        type: "object",
        properties: {
          endpoint: { type: "string", description: "Endpoint path to invoke" },
          params: {
            type: "object",
            description: "Parameters for the API call",
            properties: {},
          },
        },
        required: ["endpoint"],
      },
    })

    return dynamicTools
  }

  /**
   * Initialize tools from the OpenAPI specification
   */
  async initialize(): Promise<void> {
    const spec = await this.specLoader.loadOpenAPISpec(
      this.config.openApiSpec,
      this.config.specInputMethod,
      this.config.inlineSpecContent,
    )
    // Determine tools loading mode
    if (this.config.toolsMode === "dynamic") {
      // Use dynamic discovery meta-tools
      this.tools = this.createDynamicTools()
      return
    }
    // Load and filter standard tools
    const rawTools = this.specLoader.parseOpenAPISpec(spec)
    const filtered = new Map<string, Tool>()

    // Precompute lowercase filter arrays for better performance
    const includeToolsLower = this.config.includeTools?.map((t) => t.toLowerCase()) || []
    const includeOperationsLower =
      this.config.includeOperations?.map((op) => op.toLowerCase()) || []
    const includeResourcesLower =
      this.config.includeResources?.map((res) => res.toLowerCase()) || []
    const includeTagsLower = this.config.includeTags?.map((tag) => tag.toLowerCase()) || []

    for (const [toolId, tool] of rawTools.entries()) {
      const extendedTool = tool as ExtendedTool

      // includeTools filter
      if (includeToolsLower.length > 0) {
        const toolIdLower = toolId.toLowerCase()
        const toolNameLower = tool.name.toLowerCase()
        if (
          !includeToolsLower.includes(toolIdLower) &&
          !includeToolsLower.includes(toolNameLower)
        ) {
          continue
        }
      }

      // includeOperations filter
      if (includeOperationsLower.length > 0) {
        const httpMethod = extendedTool.httpMethod?.toLowerCase()
        if (!httpMethod || !includeOperationsLower.includes(httpMethod)) {
          continue
        }
      }

      // includeResources filter
      if (includeResourcesLower.length > 0) {
        const resourceName = extendedTool.resourceName?.toLowerCase()
        if (!resourceName || !includeResourcesLower.includes(resourceName)) {
          continue
        }
      }

      // includeTags filter
      if (includeTagsLower.length > 0) {
        const toolTags = extendedTool.tags || []
        const hasMatchingTag = toolTags.some((tag) => includeTagsLower.includes(tag.toLowerCase()))
        if (!hasMatchingTag) {
          continue
        }
      }

      filtered.set(toolId, tool)
    }
    this.tools = filtered

    // Log the registered tools
    for (const [toolId, tool] of this.tools.entries()) {
      console.error(`Registered tool: ${toolId} (${tool.name})`)
    }
  }

  /**
   * Get all available tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get all available tools with their IDs
   * Returns array of [toolId, tool] pairs
   */
  getToolsWithIds(): [string, Tool][] {
    return Array.from(this.tools.entries())
  }

  /**
   * Find a tool by ID or name
   */
  findTool(idOrName: string): { toolId: string; tool: Tool } | undefined {
    const lowerIdOrName = idOrName.toLowerCase()

    // Try to find by ID first (case-insensitive)
    for (const [toolId, tool] of this.tools.entries()) {
      if (toolId.toLowerCase() === lowerIdOrName) {
        return { toolId, tool }
      }
    }

    // Then try to find by name (case-insensitive)
    for (const [toolId, tool] of this.tools.entries()) {
      if (tool.name.toLowerCase() === lowerIdOrName) {
        return { toolId, tool }
      }
    }

    return undefined
  }

  /**
   * Get the path and method from a tool ID
   *
   * Note: This converts hyphens back to slashes to reconstruct the original API path.
   * This is consistent with ApiClient.parseToolId() which needs the actual path for HTTP requests.
   */
  parseToolId(toolId: string): { method: string; path: string } {
    return parseToolIdUtil(toolId)
  }
}
