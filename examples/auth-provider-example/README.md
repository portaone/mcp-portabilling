# AuthProvider Example

This example demonstrates how to use the `AuthProvider` interface with `@ivotoby/openapi-mcp-server` for dynamic authentication scenarios.

## Overview

The `AuthProvider` interface allows you to handle complex authentication scenarios that static headers cannot address:

- **Token Expiration**: Automatically detect and handle expired tokens
- **Token Refresh**: Automatically refresh tokens when they expire
- **Manual Token Updates**: Handle APIs that require manual token renewal
- **API Key Management**: Manage API keys with validation
- **Custom Authentication**: Implement any authentication pattern

## Examples Included

### 1. RefreshableAuthProvider

Automatically refreshes tokens using a refresh token when they expire.

**Use case**: OAuth2 APIs with refresh tokens

```typescript
const authProvider = new RefreshableAuthProvider(
  "https://api.example.com/oauth/token", // Token refresh URL
  "initial-access-token", // Initial access token
  "initial-refresh-token", // Initial refresh token
)
```

**Features**:

- Automatic token refresh before expiration
- Retry logic for authentication errors
- Token expiry tracking with buffer time

### 2. ManualTokenAuthProvider

Handles APIs that require manual token updates (like Beatport).

**Use case**: APIs where automatic refresh isn't possible

```typescript
const authProvider = new ManualTokenAuthProvider("MyAPI")
authProvider.updateToken("your-bearer-token-here", 3600)
```

**Features**:

- Manual token updates
- Clear error messages with instructions
- Token status tracking
- Expiry warnings

### 3. ApiKeyAuthProvider

Simple API key authentication with validation.

**Use case**: APIs that use API keys instead of bearer tokens

```typescript
const authProvider = new ApiKeyAuthProvider(
  "your-api-key-here", // Your API key
  "X-API-Key", // Header name (optional)
)
```

**Features**:

- API key validation
- Custom header names
- Clear error messages

## Setup

1. Install dependencies:

```bash
npm install
```

2. Choose an authentication example:

   - Edit `src/index.ts` and uncomment the example you want to try
   - Update the configuration with your API details

3. Build the project:

```bash
npm run build
```

4. Run the server:

```bash
npm start
```

## Configuration

Each AuthProvider example shows different configuration patterns:

### Refreshable Token Example

```typescript
const authProvider = new RefreshableAuthProvider(
  "https://api.example.com/oauth/token",
  "initial-access-token",
  "initial-refresh-token",
)

const config = {
  // ... other config
  authProvider: authProvider,
}
```

### Manual Token Example

```typescript
const authProvider = new ManualTokenAuthProvider("MyAPI")
authProvider.updateToken("your-token", 3600)

const config = {
  // ... other config
  authProvider: authProvider,
}
```

### API Key Example

```typescript
const authProvider = new ApiKeyAuthProvider("your-api-key", "X-API-Key")

const config = {
  // ... other config
  authProvider: authProvider,
}
```

## Key Benefits

### 1. Dynamic Authentication

- Headers are fetched fresh for each request
- Tokens can be validated before sending requests
- Supports runtime token updates

### 2. Error Handling

- Automatic detection of authentication errors (401/403)
- Custom error messages with actionable instructions
- Retry logic for recoverable errors

### 3. Flexibility

- Implement any authentication pattern
- Support for multiple authentication methods
- Easy to extend for custom requirements

## Real-World Usage

### Beatport-style Manual Token Management

```typescript
class BeatportAuthProvider extends ManualTokenAuthProvider {
  constructor() {
    super("Beatport")
  }

  async handleAuthError(error: AxiosError): Promise<boolean> {
    throw new Error(
      "Beatport authentication failed. To get a new token:\n" +
        "1. Go to https://www.beatport.com\n" +
        "2. Log in to your account\n" +
        "3. Open browser dev tools (F12)\n" +
        "4. Go to Network tab\n" +
        "5. Make any API request\n" +
        "6. Copy the Authorization header\n" +
        "7. Update your token using updateToken()",
    )
  }
}
```

### OAuth2 with Automatic Refresh

```typescript
class OAuth2AuthProvider extends RefreshableAuthProvider {
  constructor(clientId: string, clientSecret: string) {
    super("https://api.example.com/oauth/token")
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  // Override refresh logic for your specific OAuth2 implementation
  private async refreshAccessToken(): Promise<void> {
    // Custom OAuth2 refresh implementation
  }
}
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "my-auth-api": {
      "command": "node",
      "args": ["/path/to/auth-provider-example/dist/index.js"]
    }
  }
}
```

## Next Steps

- See the `beatport-example` for a complete real-world implementation
- Check the main documentation for more AuthProvider patterns
- Implement your own custom AuthProvider for your specific API
