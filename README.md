# PortaBilling MCP Server

A Model Context Protocol (MCP) server that exposes PortaBilling’s OpenAPI endpoints as MCP resources. This server enables Large Language Models to discover and interact with REST APIs defined by OpenAPI specifications via the MCP protocol.

---

# User Guide

This section covers how to use the MCP server as an end user with Claude Desktop, Cursor, or other MCP-compatible tools.

## Quick Start for Users

Using with Claude Desktop (Stdio Transport)

Clone this repository. Install dependencies:
```bash
git clone https://github.com/portaone/mcp-portabilling
cd mcp-portabilling
npm install
npm run build
cd examples/auth-provider-example
npm install
npm run build
```

Next, you need to configure your Claude Desktop application to connect to the PortaBilling MCP server. Open your Claude Desktop configuration file and add the following to the `mcpServers` object:

```json
{
  "mcpServers": {
    "portabilling": {
      "command": "npx",
      "args": ["-y", "/home/username/mcp-openapi-server/examples/auth-provider-example/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://demo.portaone.com:8444/rest",
        "OPENAPI_SPEC_PATH": "https://demo.portaone.com:8444/doc/api/CustomerInterface.json",
        "PORTABILLING_LOGIN_ID": "your_login",
        "PORTABILLING_PASSWORD": "your_password",
        "API_HEADERS": ""
      }
    }
  }
}

```

Make sure to replace `"your_login"` and `"your_password"` with your actual PortaBilling credentials (the example above refers to the Retail realm).


## Debugging

When using Claude Desktop, the logs appear in the Claude Desktop logs

---

# PortaBilling Authentication Provider for MCP OpenAPI Server

## Overview

This section explains how to use the `PortaBillingAuthProvider` to connect the MCP OpenAPI Server to a PortaBilling API server. This custom authentication provider handles the specific authentication flow required by PortaBilling, including initial login with username and password, and subsequent token refreshes.

The `PortaBillingAuthProvider` is designed to be used with the Claude Desktop example, allowing you to interact with the PortaBilling API through the MCP server.

## Authentication Flow

The `PortaBillingAuthProvider` implements the following authentication flow:

1.  **Initial Login**: When the server starts, the `PortaBillingAuthProvider` makes a `POST` request to the `/Session/login` endpoint of the PortaBilling API with the provided username and password.

2.  **Token Storage**: Upon successful login, the provider stores the `access_token`, `refresh_token`, and token expiry time.

3.  **Authenticated Requests**: For each subsequent request to the PortaBilling API, the provider adds the `Authorization: Bearer <access_token>` header.

4.  **Token Expiration Check**: Before making a request, the provider checks if the access token is expired or about to expire.

5.  **Token Refresh**: If the access token is expired and a refresh token is available, the provider makes a `POST` request to the `/Session/refresh_access_token` endpoint with the refresh token to get a new access token.

6.  **Re-login**: If the refresh token is not available or the refresh fails, the provider will attempt to re-login using the original username and password.

7.  **Error Handling**: The provider includes specific error handling for `500` status codes from the PortaBilling API. If a `500` error is received, it will attempt to refresh the token or re-login to recover the session.

## Common Patterns

The `PortaBillingAuthProvider` included in this repository serves as a comprehensive example of implementing the `AuthProvider` interface for a real-world API with a complex authentication flow (initial login, token refresh, and error recovery). Please refer to its section and the source code in `examples/auth-provider-example/` for a detailed implementation pattern.

### OpenAPI Schema Processing

#### Reference Resolution

This MCP server implements robust OpenAPI reference (`$ref`) resolution to ensure accurate representation of API schemas:

- **Parameter References**: Fully resolves `$ref` pointers to parameter components in the OpenAPI spec
- **Schema References**: Handles nested schema references within parameters and request bodies
- **Recursive References**: Prevents infinite loops by detecting and handling circular references
- **Nested Properties**: Preserves complex nested object and array structures with all their attributes

### Input Schema Composition

The server intelligently merges parameters and request bodies into a unified input schema for each tool:

- **Parameters + Request Body Merging**: Combines path, query, and body parameters into a single schema
- **Collision Handling**: Resolves naming conflicts by prefixing body properties that conflict with parameter names
- **Type Preservation**: Maintains the original type information for all schema elements
- **Metadata Retention**: Preserves descriptions, formats, defaults, enums, and other schema attributes

### Complex Schema Support

The MCP server handles various OpenAPI schema complexities:

- **Primitive Type Bodies**: Wraps non-object request bodies in a "body" property
- **Object Bodies**: Flattens object properties into the tool's input schema
- **Array Bodies**: Properly handles array schemas with their nested item definitions
- **Required Properties**: Tracks and preserves which parameters and properties are required

---

## License

MIT
