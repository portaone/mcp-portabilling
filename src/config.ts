import yargs from "yargs"
import { hideBin } from "yargs/helpers"

export interface OpenAPIMCPServerConfig {
  name: string
  version: string
  apiBaseUrl: string
  openApiSpec: string
  headers?: Record<string, string>
}

/**
 * Parse header string in format 'key1:value1,key2:value2' into a record
 */
export function parseHeaders(headerStr?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (headerStr) {
    headerStr.split(",").forEach((header) => {
      const [key, value] = header.split(":")
      if (key && value) headers[key.trim()] = value.trim()
    })
  }
  return headers
}

/**
 * Load configuration from command line arguments and environment variables
 */
export function loadConfig(): OpenAPIMCPServerConfig {
  const argv = yargs(hideBin(process.argv))
    .option("api-base-url", {
      alias: "u",
      type: "string",
      description: "Base URL for the API",
    })
    .option("openapi-spec", {
      alias: "s",
      type: "string",
      description: "Path or URL to OpenAPI specification",
    })
    .option("headers", {
      alias: "H",
      type: "string",
      description: "API headers in format 'key1:value1,key2:value2'",
    })
    .option("name", {
      alias: "n",
      type: "string",
      description: "Server name",
    })
    .option("version", {
      alias: "v",
      type: "string",
      description: "Server version",
    })
    .help().argv

  // Combine CLI args and env vars, with CLI taking precedence
  const apiBaseUrl = argv["api-base-url"] || process.env.API_BASE_URL
  const openApiSpec = argv["openapi-spec"] || process.env.OPENAPI_SPEC_PATH

  if (!apiBaseUrl) {
    throw new Error("API base URL is required (--api-base-url or API_BASE_URL)")
  }
  if (!openApiSpec) {
    throw new Error("OpenAPI spec is required (--openapi-spec or OPENAPI_SPEC_PATH)")
  }

  const headers = parseHeaders(argv.headers || process.env.API_HEADERS)

  return {
    name: argv.name || process.env.SERVER_NAME || "mcp-openapi-server",
    version: argv.version || process.env.SERVER_VERSION || "1.0.0",
    apiBaseUrl,
    openApiSpec,
    headers,
  }
}
