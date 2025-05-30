#!/usr/bin/env node

import { OpenAPIServer } from "@ivotoby/openapi-mcp-server"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { BeatportAuthProvider } from "./beatport-auth.js"

/**
 * Beatport MCP Server
 *
 * A dedicated MCP server for the Beatport API using mcp-openapi-server
 * with custom authentication handling for Beatport's token requirements
 */
async function main(): Promise<void> {
  try {
    // Create Beatport auth provider
    const authProvider = new BeatportAuthProvider()

    // You can set an initial token from environment variable
    const initialToken = process.env.BEATPORT_TOKEN
    if (initialToken) {
      authProvider.updateToken(initialToken)
      console.error("🎵 Using Beatport token from environment variable")
    } else {
      console.error("⚠️  No initial Beatport token provided")
      console.error("   You will need to update the token manually after starting")
    }

    const config = {
      name: "beatport-mcp-server",
      version: "1.0.0",
      apiBaseUrl: "https://api.beatport.com",
      openApiSpec: "https://api.beatport.com/v4/catalog/openapi.json",
      specInputMethod: "url" as const,
      authProvider: authProvider,
      transportType: "stdio" as const,
      toolsMode: "all" as const,
      // Filter to only include useful endpoints
      includeOperations: ["get", "post"],
      // Focus on catalog endpoints
      includeResources: ["tracks", "artists", "labels", "releases", "genres", "search"],
    }

    // Create and start the server
    const server = new OpenAPIServer(config)
    const transport = new StdioServerTransport()

    await server.start(transport)
    console.error("🎵 Beatport MCP Server running on stdio")
    console.error("   Ready to search tracks, artists, and more!")

    // Log token status
    const tokenStatus = authProvider.getTokenStatus()
    if (tokenStatus.hasToken) {
      console.error(`   Token status: ${tokenStatus.isExpired ? "Expired" : "Valid"}`)
      if (tokenStatus.timeUntilExpiry) {
        console.error(`   Time until expiry: ${tokenStatus.timeUntilExpiry}`)
      }
    }
  } catch (error) {
    console.error("Failed to start Beatport MCP server:", error)
    process.exit(1)
  }
}

// Run the server
main()
