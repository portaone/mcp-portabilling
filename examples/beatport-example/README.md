# Beatport MCP Server

A dedicated MCP server for the Beatport API, built using `@ivotoby/openapi-mcp-server` with custom authentication handling.

## Overview

This example demonstrates a real-world implementation of a dedicated MCP server for a specific API (Beatport). It showcases:

- **Custom AuthProvider**: Handles Beatport's manual token requirements
- **API Filtering**: Only exposes relevant endpoints (tracks, artists, etc.)
- **Error Handling**: Provides clear instructions for token renewal
- **Production Ready**: Can be packaged and distributed as a standalone tool

## Features

### 🎵 Beatport API Integration

- Search tracks, artists, labels, and releases
- Browse genres and charts
- Access detailed track information
- Filter and sort results

### 🔐 Smart Authentication

- Manual token management (required for Beatport)
- Clear error messages with step-by-step token renewal instructions
- Token expiry tracking with warnings
- Automatic token validation before requests

### 🛠️ Optimized Configuration

- Only loads relevant endpoints (no admin/write operations)
- Focuses on catalog browsing and search functionality
- Efficient tool loading with filtering

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get a Beatport Token

Since Beatport doesn't provide public OAuth2, you need to extract a token from your browser:

1. Go to [Beatport.com](https://www.beatport.com) and log in
2. Open browser developer tools (F12)
3. Go to the **Network** tab
4. Search for a track or browse the catalog
5. Look for requests to `api.beatport.com` in the Network tab
6. Click on any API request
7. In the **Headers** section, find the `Authorization` header
8. Copy the full value (starts with `Bearer `)

### 3. Set Your Token (Optional)

You can provide an initial token via environment variable:

```bash
export BEATPORT_TOKEN="your-bearer-token-here"
```

### 4. Build and Run

```bash
npm run build
npm start
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "beatport": {
      "command": "node",
      "args": ["/path/to/beatport-example/dist/index.js"],
      "env": {
        "BEATPORT_TOKEN": "your-bearer-token-here"
      }
    }
  }
}
```

## Available Tools

The server exposes Beatport API endpoints as MCP tools:

### Search & Discovery

- `GET-search-tracks` - Search for tracks
- `GET-search-artists` - Search for artists
- `GET-search-labels` - Search for labels
- `GET-search-releases` - Search for releases

### Browse Catalog

- `GET-tracks` - Browse tracks with filters
- `GET-artists` - Browse artists
- `GET-labels` - Browse labels
- `GET-releases` - Browse releases
- `GET-genres` - Get available genres

### Detailed Information

- `GET-tracks-{id}` - Get detailed track information
- `GET-artists-{id}` - Get detailed artist information
- `GET-labels-{id}` - Get detailed label information
- `GET-releases-{id}` - Get detailed release information

## Token Management

### Updating Tokens

When your token expires, you'll get a clear error message with instructions. The AuthProvider handles this gracefully and provides step-by-step guidance.

### Token Status

The server logs token status on startup:

```
🎵 Beatport MCP Server running on stdio
   Ready to search tracks, artists, and more!
   Token status: Valid
   Time until expiry: 2h 45m
```

### Manual Token Updates

If you need to update the token while the server is running, you would need to restart with a new token (or implement a custom tool for runtime updates).

## Example Queries

Once connected to Claude Desktop, you can ask:

- "Search for techno tracks on Beatport"
- "Find artists similar to Charlotte de Witte"
- "What are the top releases this week?"
- "Show me tracks in the Progressive House genre"
- "Get details for track ID 12345"

## Architecture

### BeatportAuthProvider

Custom AuthProvider implementation that:

- Manages manual token updates
- Provides detailed error messages for token issues
- Tracks token expiry with buffer time
- Handles 401/403 errors gracefully

### Configuration

Optimized for Beatport's catalog API:

- Filters to only GET/POST operations
- Focuses on catalog endpoints (tracks, artists, etc.)
- Uses Beatport's OpenAPI specification

### Error Handling

Comprehensive error handling for:

- Expired tokens
- Invalid tokens
- Network issues
- API rate limits

## Packaging for Distribution

This example can be packaged as a standalone npm package:

1. Update `package.json` with your details
2. Build the project: `npm run build`
3. Publish: `npm publish`

Users can then install and use it directly:

```bash
npx your-beatport-mcp-server
```

## Extending the Example

### Adding Custom Tools

You can extend the server with custom tools for:

- Playlist management
- Favorite tracks
- Purchase history
- Custom search filters

### Runtime Token Updates

Implement a custom tool that allows token updates without restart:

```typescript
// Add to your server configuration
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "update-token") {
    const { token } = request.params.arguments
    authProvider.updateToken(token)
    return { content: [{ type: "text", text: "Token updated successfully" }] }
  }
  // ... handle other tools
})
```

## Security Considerations

- Never commit tokens to version control
- Use environment variables for token storage
- Tokens should be treated as sensitive credentials
- Consider implementing token encryption for production use

## Troubleshooting

### Common Issues

**"Token expired or not set"**

- Get a fresh token from your browser
- Make sure you copied the full Authorization header
- Check that the token starts with "Bearer "

**"Authentication failed (401)"**

- Your token has expired, get a new one
- Make sure you're logged in to Beatport
- Verify the token was copied correctly

**"Authentication failed (403)"**

- Your account may not have API access
- Try logging out and back in to Beatport
- Ensure your account is in good standing

**"Cannot find module '@ivotoby/openapi-mcp-server'"**

- Run `npm install` to install dependencies
- Make sure you're using the correct package version

## Next Steps

- Explore the other examples for different patterns
- Check the main documentation for more configuration options
- Consider contributing improvements back to the project
