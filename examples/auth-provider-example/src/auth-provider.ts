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

  async login(): Promise<void> {
    const response = await fetch(`${this.portaBillingBaseUrl}/Session/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: { login: this.loginId, password: this.password } }),
    });

    const data = await response.json();

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
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.accessToken || this.isTokenExpired()) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        console.error("Access token expired and no refresh token available. Attempting to re-login.");
        await this.login();
      }
    }
    return { "Authorization": `Bearer ${this.accessToken}`, "Content-Type": "application/json" };
  }

  async handleAuthError(error: AxiosError): Promise<boolean> {
    const statusCode = error.response?.status;

    if (statusCode === 500) {
      console.error(`PortaBilling API call failed with 500. Attempting to recover authentication.`);

      if (this.refreshToken) {
        try {
          console.error("Attempting to refresh token...");
          await this.refreshAccessToken();
          return true;
        } catch (refreshError: any) {
          console.error(`Refresh token failed: ${refreshError.message}. Attempting full re-login.`);
        }
      }

      try {
        console.error("Attempting full re-login with username/password...");
        await this.login();
        return true;
      } catch (loginError: any) {
        throw new Error(
          `Failed to re-authenticate with PortaBilling: ${loginError.message}. ` +
          `Please check your credentials and PortaBilling service status.`
        );
      }
    }

    return false;
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) {
      return true;
    }
    return this.tokenExpiry <= new Date(Date.now() + 60000);
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available for PortaBilling.");
    }

    const response = await fetch(`${this.portaBillingBaseUrl}/Session/refresh_access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: { refresh_token: this.refreshToken } }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        `PortaBilling token refresh failed: ${response.status} ${response.statusText}. ` +
        `Error details: ${data.error ? data.error.message : "No specific error message provided."}`
      );
    }

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    console.error("✅ PortaBilling token refreshed successfully.");
  }
}