#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OpenAPIServer } from "./server";
import { loadConfig } from "./config";

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = loadConfig();

    const server = new OpenAPIServer(config);

    const transport = new StdioServerTransport();
    await server.start(transport);

    console.error("OpenAPI MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
main();

// Re-export important classes for library usage
export * from "./server";
export * from "./api-client";
export * from "./config";
export * from "./tools-manager";
export * from "./openapi-loader";
