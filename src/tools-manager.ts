import { Tool } from "@modelcontextprotocol/sdk/types.js"
import { OpenAPISpecLoader } from "./openapi-loader"
import { OpenAPIMCPServerConfig } from "./config"
import { OpenAPIV3 } from "openapi-types"

/**
 * Manages the tools available in the MCP server
 */
export class ToolsManager {
  private tools: Map<string, Tool> = new Map()
  private specLoader: OpenAPISpecLoader

  constructor(private config: OpenAPIMCPServerConfig) {
    this.specLoader = new OpenAPISpecLoader()
  }

  /**
   * Create dynamic discovery meta-tools
   */
  private createDynamicTools(): Map<string, Tool> {
    const dynamicTools = new Map<string, Tool>()

    // list_api_endpoints
    dynamicTools.set("list_api_endpoints", {
      name: "list_api_endpoints",
      description: "List all available API endpoints",
      inputSchema: { type: "object", properties: {} },
    })

    // get_api_endpoint_schema
    dynamicTools.set("get_api_endpoint_schema", {
      name: "get_api_endpoint_schema",
      description: "Get the JSON schema for a specified API endpoint",
      inputSchema: {
        type: "object",
        properties: {
          endpoint: { type: "string", description: "Endpoint path (e.g. /users/{id})" },
        },
        required: ["endpoint"],
      },
    })

    // invoke_api_endpoint
    dynamicTools.set("invoke_api_endpoint", {
      name: "invoke_api_endpoint",
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
    const spec = await this.specLoader.loadOpenAPISpec(this.config.openApiSpec)
    // Determine tools loading mode
    if (this.config.toolsMode === "dynamic") {
      // Use dynamic discovery meta-tools
      this.tools = this.createDynamicTools()
      return
    }
    // Load and filter standard tools
    const rawTools = this.specLoader.parseOpenAPISpec(spec)
    const filtered = new Map<string, Tool>()

    for (const [toolId, tool] of rawTools.entries()) {
      // includeTools filter
      if (this.config.includeTools && this.config.includeTools.length > 0) {
        const includeToolsLower = this.config.includeTools.map((t) => t.toLowerCase())
        if (
          !includeToolsLower.includes(toolId.toLowerCase()) &&
          !includeToolsLower.includes(tool.name.toLowerCase())
        ) {
          continue
        }
      }
      // includeOperations filter
      if (this.config.includeOperations && this.config.includeOperations.length > 0) {
        const { method } = this.parseToolId(toolId)
        if (
          !this.config.includeOperations
            .map((op) => op.toLowerCase())
            .includes(method.toLowerCase())
        ) {
          continue
        }
      }
      // includeResources filter
      if (this.config.includeResources && this.config.includeResources.length > 0) {
        const { path } = this.parseToolId(toolId)
        // Match exact resource prefix (after leading slash)
        const match = this.config.includeResources.some(
          (res) => path === `/${res}` || path.startsWith(`/${res}/`),
        )
        if (!match) continue
      }
      // includeTags filter
      if (this.config.includeTags && this.config.includeTags.length > 0) {
        // Attempt to read tags from original spec paths
        const { method, path } = this.parseToolId(toolId)
        const methodLower = method.toLowerCase() as OpenAPIV3.HttpMethods
        const pathItem = spec.paths[path] as OpenAPIV3.PathItemObject | undefined

        if (!pathItem) continue

        // Get the operation for the method (get, post, etc.)
        const opObj = pathItem[methodLower]
        const tags: string[] = Array.isArray(opObj?.tags) ? (opObj.tags as string[]) : []
        const includeTagsLower = this.config.includeTags.map((tag) => tag.toLowerCase())
        if (!tags.some((tag) => includeTagsLower.includes(tag.toLowerCase()))) continue
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
   */
  parseToolId(toolId: string): { method: string; path: string } {
    const [method, ...pathParts] = toolId.split("-")
    const path = "/" + pathParts.join("/").replace(/-/g, "/")
    return { method, path }
  }
}
