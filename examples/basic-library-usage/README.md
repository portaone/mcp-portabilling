# Basic Library Usage Example

This example demonstrates how to use `@ivotoby/openapi-mcp-server` as a library to create a dedicated MCP server for a specific API.

## Overview

Instead of using the CLI tool directly, you can import and use the `OpenAPIServer` class in your own Node.js application. This approach is useful when you want to:

- Create a dedicated package for a specific API
- Add custom logic or middleware
- Bundle the server with your application
- Customize the server behavior

## Setup

1. Install dependencies:

```bash
npm install
```

2. Update the configuration in `src/index.ts`:

   - Replace `https://api.example.com` with your API's base URL
   - Replace `https://api.example.com/openapi.json` with your OpenAPI spec URL
   - Update the headers with your API credentials

3. Build the project:

```bash
npm run build
```

4. Run the server:

```bash
npm start
```

## Configuration

The server is configured in `src/index.ts`. Key configuration options:

- `name`: Name of your MCP server
- `version`: Version of your server
- `apiBaseUrl`: Base URL for your API
- `openApiSpec`: URL or path to your OpenAPI specification
- `headers`: Static authentication headers
- `transportType`: Use 'stdio' for Claude Desktop integration
- `toolsMode`: Use 'all' to load all endpoints as tools

## Usage with Claude Desktop

To use this server with Claude Desktop, add it to your configuration:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "node",
      "args": ["/path/to/your/project/dist/index.js"]
    }
  }
}
```

## Next Steps

- See the `auth-provider-example` for dynamic authentication
- See the `beatport-example` for a real-world implementation
- Check the main README for more configuration options
