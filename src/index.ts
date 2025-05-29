#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { OpenAPIServer } from "./server"
import { loadConfig } from "./config"
import { StreamableHttpServerTransport } from "./transport/StreamableHttpServerTransport"

/**
 * Main entry point for CLI usage
 */
async function main(): Promise<void> {
  try {
    const config = loadConfig()

    const server = new OpenAPIServer(config)

    // Choose transport based on config
    let transport: Transport
    if (config.transportType === "http") {
      transport = new StreamableHttpServerTransport(
        config.httpPort!,
        config.httpHost,
        config.endpointPath,
      )
      await server.start(transport)
      console.error(
        `OpenAPI MCP Server running on http://${config.httpHost}:${config.httpPort}${config.endpointPath}`,
      )
    } else {
      transport = new StdioServerTransport()
      await server.start(transport)
      console.error("OpenAPI MCP Server running on stdio")
    }
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

// Only run main() if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

// Re-export important classes for library usage
export * from "./server"
export * from "./api-client"
export * from "./config"
export * from "./tools-manager"
export * from "./openapi-loader"
export * from "./transport/StreamableHttpServerTransport"

// Export the main function for programmatic usage
export { main }
