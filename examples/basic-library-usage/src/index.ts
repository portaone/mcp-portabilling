#!/usr/bin/env node

import { OpenAPIServer } from "@ivotoby/openapi-mcp-server"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

/**
 * Basic example of using mcp-openapi-server as a library
 * This creates a dedicated MCP server for a specific API
 */
async function main(): Promise<void> {
  try {
    // Configure your API server
    const config = {
      name: "my-api-mcp-server",
      version: "1.0.0",
      apiBaseUrl: "https://api.example.com",
      openApiSpec: "https://api.example.com/openapi.json",
      specInputMethod: "url" as const,
      headers: {
        Authorization: "Bearer your-api-token",
        "X-API-Key": "your-api-key",
        "User-Agent": "MyApp/1.0.0",
      },
      transportType: "stdio" as const,
      toolsMode: "all" as const,
    }

    // Create and start the server
    const server = new OpenAPIServer(config)
    const transport = new StdioServerTransport()

    await server.start(transport)
    console.error("My API MCP Server running on stdio")
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

// Run the server
main()
