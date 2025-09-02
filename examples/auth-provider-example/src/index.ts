#!/usr/bin/env node

import { OpenAPIServer } from "@ivotoby/openapi-mcp-server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PortaBillingAuthProvider } from "./auth-provider.js";

async function main(): Promise<void> {
  try {
    const portaBillingApiBaseUrl = process.env.API_BASE_URL;
    const portaBillingOpenApiSpec = process.env.OPENAPI_SPEC_PATH;
    const loginId = process.env.PORTABILLING_LOGIN_ID;
    const password = process.env.PORTABILLING_PASSWORD;

    if (!portaBillingApiBaseUrl) {
      throw new Error("Environment variable API_BASE_URL is not set. Example: https://demo.portaone.com:8444/rest");
    }
    if (!portaBillingOpenApiSpec) {
      throw new Error("Environment variable OPENAPI_SPEC_PATH is not set. Example: https://demo.portaone.com:8444/doc/api/CustomerInterface.json");
    }
    if (!loginId) {
      throw new Error("Environment variable PORTABILLING_LOGIN_ID is not set.");
    }
    if (!password) {
      throw new Error("Environment variable PORTABILLING_PASSWORD is not set.");
    }

    const authProvider = new PortaBillingAuthProvider(
      portaBillingApiBaseUrl,
      loginId,
      password
    );

    await authProvider.login();

    const config = {
      name: "porta-billing-mcp-server",
      version: "1.0.0",
      apiBaseUrl: portaBillingApiBaseUrl,
      openApiSpec: portaBillingOpenApiSpec,
      specInputMethod: "url" as const,
      authProvider: authProvider,
      transportType: "stdio" as const,
      toolsMode: "all" as const,
    };

    const server = new OpenAPIServer(config);
    const transport = new StdioServerTransport();

    await server.start(transport);
    console.error("PortaBilling MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to start PortaBilling MCP server:", error);
    process.exit(1);
  }
}

main();
