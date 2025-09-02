## PRP: PortaBilling Authentication Integration

### Goal

Integrate PortaBilling API authentication into the `mcp-openapi-server` by implementing a custom `AuthProvider` that handles initial login with username/password and automatic token refresh using PortaBilling's dedicated refresh endpoint.

### Why

The current `mcp-openapi-server` setup requires manual updates when the PortaBilling access token expires. This project aims to automate the token management process, allowing the MCP server to seamlessly interact with the PortaBilling API without interruption due to expired tokens. This will improve the user experience for Claude Desktop users by providing a "set-and-forget" authentication mechanism for PortaBilling.

### What

A new `PortaBillingAuthProvider` class will be created, implementing the `@ivotoby/openapi-mcp-server`'s `AuthProvider` interface. This provider will:
1.  Perform an initial login to PortaBilling's `/Session/login` endpoint using configured username and password to obtain an `access_token` and `refresh_token`.
2.  Supply the `access_token` in the `Authorization: Bearer` header for all subsequent API requests.
3.  Automatically detect expired `access_token`s and use the `refresh_token` to acquire a new `access_token` via PortaBilling's `/Session/refresh_access_token` endpoint.
4.  Handle authentication errors (specifically 500 status codes from PortaBilling) by attempting token refresh or re-login.

### Success Criteria

*   The `mcp-openapi-server` successfully starts and connects to the PortaBilling API using the `PortaBillingAuthProvider`.
*   API calls made through the MCP server to PortaBilling are successfully authenticated using the `Authorization: Bearer` header.
*   The `access_token` is automatically refreshed by the `PortaBillingAuthProvider` before or upon expiration, without requiring manual intervention.
*   The MCP server can operate continuously with the PortaBilling API for extended periods without authentication failures due to token expiry.
*   All existing tests in `examples/auth-provider-example/` pass after the changes.

### All Needed Context

#### Documentation

*   **PortaBilling API Documentation (General):** [https://demo.portaone.com/doc/api/](https://demo.portaone.com/doc/api/)
*   **PortaBilling `Session/login` Endpoint:** [https://demo.portaone.com:8444/rest/Session/login](https://demo.portaone.com:8444/rest/Session/login)
    *   **Request:** `POST /Session/login` with `params: { login: "username", password: "password" }` in the body.
    *   **Response:** Returns `access_token`, `refresh_token`, `expires_in`. Authentication failures return 500.
*   **PortaBilling `Session/refresh_access_token` Endpoint:** [https://demo.portaone.com:8444/rest/Session/refresh_access_token](https://demo.portaone.com:8444/rest/Session/refresh_access_token)
    *   **Request:** `POST /Session/refresh_access_token` with `params: { refresh_token: "your_refresh_token" }` in the body.
    *   **Response:** Returns new `access_token`, `refresh_token` (optional, if it changes), `expires_in`. Authentication failures return 500.

#### Code Examples (from `examples/auth-provider-example/src/auth-provider.ts`)

The `RefreshableAuthProvider` serves as a direct model for the `PortaBillingAuthProvider`, adapted for PortaBilling's 500 error handling:

```typescript
// RefreshableAuthProvider (model for PortaBillingAuthProvider)
export class RefreshableAuthProvider implements AuthProvider {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiry: Date | null = null
  private refreshUrl: string

  constructor(refreshUrl: string, initialAccessToken?: string, initialRefreshToken?: string) { /* ... */ }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.accessToken || this.isTokenExpired()) {
      if (this.refreshToken) {
        await this.refreshAccessToken()
      } else { /* ... */ }
    }
    return { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" }
  }

  async handleAuthError(error: AxiosError): Promise<boolean> {
    // Adapted for PortaBilling's 500 error handling for authentication failures
    if (error.response?.status === 500 && this.refreshToken) {
      try {
        await this.refreshAccessToken()
        return true // Retry the request
      } catch (refreshError) {
        // If refresh fails, a full re-login might be attempted by the calling logic
        throw new Error(`PortaBilling authentication failed (500). Failed to refresh token: ${refreshError.message}. Please re-authenticate.`);
      }
    }
    return false
  }

  private isTokenExpired(): boolean { /* ... */ }

  private async refreshAccessToken(): Promise<void> {
    // This is the part that needs to be adapted for PortaBilling's specific refresh endpoint
    const response = await fetch(this.refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: this.refreshToken, grant_type: "refresh_token" }),
    })
    // ... parse response and update tokens
  }
}
```

#### File Tree

```
/home/mitchell/mcp-openapi-server/
└───examples/
    └───auth-provider-example/
        ├───package.json
        ├───README.md
        ├───tsconfig.json
        └───src/
            ├───auth-provider.ts  <-- MODIFIED
            └───index.ts          <-- MODIFIED
```

### Desired Codebase Tree

The file structure will remain the same. The content of `auth-provider.ts` and `index.ts` will be modified.

### Known Gotchas

*   **PortaBilling API Spec URL:** Ensure the `OPENAPI_SPEC_PATH` environment variable correctly points to the PortaBilling customer-spec.
*   **Error Handling:** Robust error handling is crucial for network issues and specific 500 error responses from PortaBilling during login and refresh.
*   **Token Persistence:** The `access_token` and `refresh_token` will be stored in-memory. If the MCP server restarts, a new initial login with username/password will be required. Initial credentials (username/password) should be managed securely (e.g., **environment variables or a secure configuration file not committed to VCS**).
*   **`fetch` vs `axios`:** The existing `RefreshableAuthProvider` uses `fetch`. We will continue to use `fetch` for consistency.
*   **Single Base URL:** All PortaBilling API and authentication endpoints share the same base URL, which will be configured via the `API_BASE_URL` environment variable.

### Implementation Blueprint

#### Data Models (Internal State for `PortaBillingAuthProvider`)

```typescript
private portaBillingBaseUrl: string; // The single base URL for all PortaBilling endpoints
private loginId: string;
private password: string;
private accessToken: string | null = null;
private refreshToken: string | null = null;
private tokenExpiry: Date | null = null; // Timestamp when the accessToken expires
```

#### Class Structure (`examples/auth-provider-example/src/auth-provider.ts`)

```typescript
import { AuthProvider } from "@ivotoby/openapi-mcp-server";
import { AxiosError } from "axios";

export class PortaBillingAuthProvider implements AuthProvider {
  private portaBillingBaseUrl: string;
  private loginId: string;
  private password: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(portaBillingBaseUrl: string, loginId: string, password: string) {
    this.portaBillingBaseUrl = portaBillingBaseUrl;
    this.loginId = loginId;
    this.password = password;
  }

  async login(): Promise<void> { /* ... */ }
  async getAuthHeaders(): Promise<Record<string, string>> { /* ... */ }
  async handleAuthError(error: AxiosError): Promise<boolean> { /* ... */ }
  private isTokenExpired(): boolean { /* ... */ }
  private async refreshAccessToken(): Promise<void> { /* ... */ }
}
```

#### Method Implementations

1.  **`constructor(portaBillingBaseUrl: string, loginId: string, password: string)`:**
    *   Initializes `portaBillingBaseUrl`, `loginId`, and `password`.

2.  **`async login(): Promise<void>`:**
    *   **Purpose:** Performs the initial login to PortaBilling.
    *   **Endpoint:** `POST ${this.portaBillingBaseUrl}/Session/login`
    *   **Headers:** `{"Content-Type": "application/json"}`
    *   **Body:** `JSON.stringify({ params: { login: this.loginId, password: this.password } })`
    *   **Logic:**
        ```typescript
        const response = await fetch(`${this.portaBillingBaseUrl}/Session/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params: { login: this.loginId, password: this.password } }),
        });

        const data = await response.json();

        // PortaBilling returns 500 for auth failures, check response.ok and data.error
        if (!response.ok || data.error) {
          throw new Error(
            `PortaBilling login failed: ${response.status} ${response.statusText}. ` +
            `Error details: ${data.error ? data.error.message : "No specific error message provided."}`
          );
        }

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token || null;
        this.tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
        console.error("✅ PortaBilling login successful.");
        ```

3.  **`async getAuthHeaders(): Promise<Record<string, string>>`:**
    *   **Purpose:** Provides the `Authorization` header for API requests, ensuring the token is fresh.
    *   **Logic:**
        *   If `!this.accessToken` or `this.isTokenExpired()`:
            *   If `this.refreshToken` exists: `await this.refreshAccessToken()`.
            *   Else: Log "Access token expired and no refresh token available. Attempting to re-login." and `await this.login()`.
        *   Return `{"Authorization": `Bearer ${this.accessToken}`, "Content-Type": "application/json"}`.

4.  **`async handleAuthError(error: AxiosError): Promise<boolean>`:**
    *   **Purpose:** Handles 500 errors (for any API call or internal auth process) by attempting token refresh or re-login.
    *   **Logic:**
        ```typescript
        const statusCode = error.response?.status;

        // If any API call (including login/refresh attempts) returns 500,
        // we treat it as an authentication failure for PortaBilling.
        if (statusCode === 500) {
          console.error(`PortaBilling API call failed with 500. Attempting to recover authentication.`);

          if (this.refreshToken) {
            try {
              console.error("Attempting to refresh token...");
              await this.refreshAccessToken();
              return true; // Retry the request with new token
            } catch (refreshError) {
              console.error(`Refresh token failed: ${refreshError.message}. Attempting full re-login.`);
              // Fall through to re-login if refresh fails
            }
          }

          // If no refresh token, or refresh failed, attempt full re-login
          try {
            console.error("Attempting full re-login with username/password...");
            await this.login();
            return true; // Retry the request with new token
          } catch (loginError) {
            throw new Error(
              `Failed to re-authenticate with PortaBilling: ${loginError.message}. ` +
              `Please check your credentials and PortaBilling service status.`
            );
          }
        }

        return false; // Don't retry for other non-500 errors
        ```

5.  **`private isTokenExpired(): boolean`:**
    *   **Purpose:** Checks if the current `access_token` is expired with a buffer.
    *   **Logic:**
        *   If `!this.tokenExpiry`, return `true`.
        *   Return `this.tokenExpiry <= new Date(Date.now() + 60000)` (1-minute buffer).

6.  **`private async refreshAccessToken(): Promise<void>`:**
    *   **Purpose:** Refreshes the `access_token` using the `refresh_token`.
    *   **Endpoint:** `POST ${this.portaBillingBaseUrl}/Session/refresh_access_token`
    *   **Headers:** `{"Content-Type": "application/json"}`
    *   **Body:** `JSON.stringify({ params: { refresh_token: this.refreshToken } })`
    *   **Logic:**
        ```typescript
        if (!this.refreshToken) {
          throw new Error("No refresh token available for PortaBilling.");
        }

        const response = await fetch(`${this.portaBillingBaseUrl}/Session/refresh_access_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params: { refresh_token: this.refreshToken } }),
        });

        const data = await response.json();

        // PortaBilling returns 500 for auth failures, check response.ok and data.error
        if (!response.ok || data.error) {
          throw new Error(
            `PortaBilling token refresh failed: ${response.status} ${response.statusText}. ` +
            `Error details: ${data.error ? data.error.message : "No specific error message provided."}`
          );
        }

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token || this.refreshToken; // Update refresh token if a new one is provided
        this.tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
        console.error("✅ PortaBilling token refreshed successfully.");
        ```

#### Integration (`examples/auth-provider-example/src/index.ts`)

```typescript
// ... (existing imports)
import { PortaBillingAuthProvider } from "./auth-provider.js"; // New import

async function main(): Promise<void> {
  try {
    // Configuration for PortaBilling
    // Read from environment variables for flexibility and security
    const portaBillingApiBaseUrl = process.env.API_BASE_URL; // Re-using existing API_BASE_URL
    const portaBillingOpenApiSpec = process.env.OPENAPI_SPEC_PATH; // Re-using existing OPENAPI_SPEC_PATH
    const loginId = process.env.PORTABILLING_LOGIN_ID;
    const password = process.env.PORTABILLING_PASSWORD;

    // Validate required environment variables
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

    // The PortaBillingAuthProvider will now use portaBillingApiBaseUrl for all its endpoint constructions
    const authProvider = new PortaBillingAuthProvider(
      portaBillingApiBaseUrl, // Pass API_BASE_URL directly
      loginId,
      password
    );

    // Perform initial login to get tokens
    await authProvider.login();

    const config = {
      name: "porta-billing-mcp-server",
      version: "1.0.0",
      apiBaseUrl: portaBillingApiBaseUrl, // Use the actual API base URL
      openApiSpec: portaBillingOpenApiSpec, // Use the PortaBilling OpenAPI spec
      specInputMethod: "url" as const,
      authProvider: authProvider, // Use the new PortaBillingAuthProvider
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
```

#### Error Handling Strategy

*   **Network Errors:** `fetch` will throw errors for network issues, which will be caught by the `try...catch` block in `main()`.
*   **API Errors (Non-2xx, specifically 500):** `response.ok` check will catch non-successful HTTP responses. The `data.error` field in PortaBilling responses will also be checked. For 500 errors, a specific recovery strategy (refresh then re-login) is implemented in `handleAuthError`.
*   **PortaBilling Specific Errors:** The `data.error` field in PortaBilling responses will be checked, and its message will be included in the thrown error.
*   **Authentication Errors (500):** `handleAuthError` will attempt to refresh or re-login. If these attempts fail, a descriptive error message will be thrown, guiding the user on how to resolve the issue (e.g., check credentials, service status).

#### Task List (Execution Order)

1.  **Modify `examples/auth-provider-example/src/auth-provider.ts`:**
    *   Add the `PortaBillingAuthProvider` class as described above.
2.  **Modify `examples/auth-provider-example/src/index.ts`:**
    *   Import `PortaBillingAuthProvider`.
    *   Update the `main` function to read PortaBilling configuration from environment variables.
    *   Instantiate `PortaBillingAuthProvider` with `API_BASE_URL`, `loginId`, and `password`, call `login()`, and pass it to `OpenAPIServer` config.
    *   Replace the existing `ApiKeyAuthProvider` instantiation.
3.  **Run Build:** `npm run build` in `examples/auth-provider-example/`.
4.  **Run Tests:** `npm test` in `examples/auth-provider-example/` (if specific tests exist for this example, otherwise rely on general project tests).
5.  **Manual Verification:** Start the server and attempt to make API calls to PortaBilling through Claude Desktop to confirm successful authentication and token refresh.

### Validation Gates

```bash
# Navigate to the example directory
cd /home/mitchell/mcp-openapi-server/examples/auth-provider-example

# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Set environment variables before running the server
# Replace with your actual PortaBilling credentials and URLs
export API_BASE_URL="https://demo.portaone.com:8444/rest"
export OPENAPI_SPEC_PATH="https://demo.portaone.com:8444/doc/api/CustomerInterface.json"
export PORTABILLING_LOGIN_ID="your_porta_login"
export PORTABILLING_PASSWORD="your_porta_password"

# Start the server for manual verification (in a separate terminal or background)
npm start
```