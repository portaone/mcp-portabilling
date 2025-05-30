#!/usr/bin/env node

import { OpenAPIServer } from "@ivotoby/openapi-mcp-server"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  RefreshableAuthProvider,
  ManualTokenAuthProvider,
  ApiKeyAuthProvider,
} from "./auth-provider.js"

/**
 * Example showing different AuthProvider implementations
 * Uncomment the example you want to try
 */
async function main(): Promise<void> {
  try {
    // Example 1: Refreshable Token Authentication
    // Uncomment this section to use automatic token refresh
    /*
    const authProvider = new RefreshableAuthProvider(
      'https://api.example.com/oauth/token', // Token refresh URL
      'initial-access-token',                // Initial access token
      'initial-refresh-token'                // Initial refresh token
    )
    */

    // Example 2: Manual Token Management (like Beatport)
    // Uncomment this section for manual token updates
    /*
    const authProvider = new ManualTokenAuthProvider('MyAPI')
    // Set initial token (you would get this from user input or config)
    authProvider.updateToken('your-bearer-token-here', 3600)
    */

    // Example 3: API Key Authentication
    // Uncomment this section for API key auth
    const authProvider = new ApiKeyAuthProvider(
      "your-api-key-here", // Your API key
      "X-API-Key", // Header name (optional, defaults to X-API-Key)
    )

    const config = {
      name: "auth-provider-example",
      version: "1.0.0",
      apiBaseUrl: "https://api.example.com",
      openApiSpec: "https://api.example.com/openapi.json",
      specInputMethod: "url" as const,
      authProvider: authProvider, // Use AuthProvider instead of static headers
      transportType: "stdio" as const,
      toolsMode: "all" as const,
    }

    // Create and start the server
    const server = new OpenAPIServer(config)
    const transport = new StdioServerTransport()

    await server.start(transport)
    console.error("AuthProvider Example MCP Server running on stdio")
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

// Run the server
main()
