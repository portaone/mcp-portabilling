import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { OpenAPISpecLoader } from "./openapi-loader";
import { OpenAPIMCPServerConfig } from "./config";

/**
 * Manages the tools available in the MCP server
 */
export class ToolsManager {
  private tools: Map<string, Tool> = new Map();
  private specLoader: OpenAPISpecLoader;

  constructor(private config: OpenAPIMCPServerConfig) {
    this.specLoader = new OpenAPISpecLoader();
  }

  /**
   * Initialize tools from the OpenAPI specification
   */
  async initialize(): Promise<void> {
    const spec = await this.specLoader.loadOpenAPISpec(this.config.openApiSpec);
    this.tools = this.specLoader.parseOpenAPISpec(spec);
    
    // Log the registered tools
    for (const [toolId, tool] of this.tools.entries()) {
      console.error(`Registered tool: ${toolId} (${tool.name})`);
    }
  }

  /**
   * Get all available tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Find a tool by ID or name
   */
  findTool(idOrName: string): { toolId: string; tool: Tool } | undefined {
    // Try to find by ID first
    if (this.tools.has(idOrName)) {
      return { toolId: idOrName, tool: this.tools.get(idOrName)! };
    }
    
    // Then try to find by name
    for (const [toolId, tool] of this.tools.entries()) {
      if (tool.name === idOrName) {
        return { toolId, tool };
      }
    }
    
    return undefined;
  }

  /**
   * Get the path and method from a tool ID
   */
  parseToolId(toolId: string): { method: string; path: string } {
    const [method, ...pathParts] = toolId.split("-");
    const path = "/" + pathParts.join("/").replace(/-/g, "/");
    return { method, path };
  }
}
