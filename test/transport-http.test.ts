import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as http from "http"
import { StreamableHttpServerTransport } from "../src/transport/StreamableHttpServerTransport"
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"

// Mock http server
vi.mock("http", () => {
  const mockServer = {
    listen: vi.fn((port: number, host: string, cb: Function) => {
      setTimeout(() => cb(), 0)
    }),
    close: vi.fn((cb: Function) => {
      setTimeout(() => cb(), 0)
    }),
    on: vi.fn(),
  }
  return {
    createServer: vi.fn(() => mockServer),
    Server: vi.fn(() => mockServer),
  }
})

describe("StreamableHttpServerTransport", () => {
  let transport: StreamableHttpServerTransport

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create transport
    transport = new StreamableHttpServerTransport(3000, "127.0.0.1", "/mcp")
  })

  afterEach(async () => {
    // Clean up
    await transport.close()
  })

  it("should start the HTTP server on the specified port and host", async () => {
    await transport.start()

    expect(http.createServer).toHaveBeenCalled()
    expect((http.createServer() as any).listen).toHaveBeenCalledWith(
      3000,
      "127.0.0.1",
      expect.any(Function),
    )
  })

  it("should handle initialization request and set session ID", () => {
    transport.onmessage = vi.fn()

    // Access the private sessions Map directly
    const transportAny = transport as any

    // Create a test session ID
    const sessionId = "test-session-id"

    // Mock initialization data
    const initData = {
      jsonrpc: "2.0" as const,
      id: 1,
      method: "initialize",
      params: {
        client: { name: "test", version: "1.0" },
        protocol: { name: "mcp", version: "2025-03-26" },
      },
    }

    // Create mock response
    const initRes = createMockResponse()

    // Call the handleInitializeRequest method directly
    transportAny.handleInitializeRequest(initData, {}, initRes)

    // Verify headers were set
    expect(initRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/json")
    expect(initRes.setHeader).toHaveBeenCalledWith("Mcp-Session-Id", expect.any(String))

    // Extract the generated session ID
    const generatedSessionId = initRes.setHeader.mock.calls.find(
      (call) => call[0] === "Mcp-Session-Id",
    )?.[1]

    // Make sure a session was created
    expect(transportAny.sessions.has(generatedSessionId)).toBeTruthy()

    // Verify the message handler was set correctly
    const sessionData = transportAny.sessions.get(generatedSessionId)
    expect(sessionData.messageHandler).toBe(transport.onmessage)

    // Verify onmessage was called with the init data
    expect(transport.onmessage).toHaveBeenCalledWith(initData)
  })

  it("should send messages to active sessions", async () => {
    // Setup spy for message handler
    transport.onmessage = vi.fn()

    // Create a session manually
    const transportAny = transport as any
    const sessionId = "test-session-id"
    transportAny.sessions.set(sessionId, {
      messageHandler: transport.onmessage,
      activeResponses: new Set(),
      initialized: true,
    })

    // Create mock streaming response
    const mockRes = createMockResponse()

    // Add the response to active responses for the session
    const session = transportAny.sessions.get(sessionId)
    session.activeResponses.add(mockRes)

    // Create a test message
    const message: JSONRPCMessage = {
      jsonrpc: "2.0" as const,
      id: 123,
      result: { success: true },
    }

    // Send the message
    await transport.send(message)

    // Verify the message was written to the response
    expect(mockRes.write).toHaveBeenCalledWith(JSON.stringify(message) + "\n")
  })

  it("should handle session termination with DELETE", () => {
    // Setup the transport with a session
    const transportAny = transport as any
    const sessionId = "test-session-id"

    // Create a session and add it to the transport
    transportAny.sessions.set(sessionId, {
      messageHandler: vi.fn(),
      activeResponses: new Set(),
      initialized: true,
    })

    // Create a DELETE request with the session ID
    const deleteReq = {
      url: "/mcp",
      method: "DELETE",
      headers: {
        "mcp-session-id": sessionId,
      },
      on: vi.fn(),
    }

    const deleteRes = createMockResponse()

    // Handle the DELETE request
    transportAny.handleDeleteRequest(deleteReq, deleteRes)

    // Should respond with 204 No Content
    expect(deleteRes.writeHead).toHaveBeenCalledWith(204)
    expect(deleteRes.end).toHaveBeenCalled()

    // Session should be removed
    expect(transportAny.sessions.has(sessionId)).toBe(false)
  })
})

// Helper functions to create mock objects
function createInitRequest() {
  const req = {
    url: "/mcp",
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    on: vi.fn(),
    destroy: vi.fn(),
  }

  // Set up the mock implementation to return req
  req.on.mockImplementation(() => req)

  return req
}

function createMockResponse() {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
    write: vi.fn(),
    setHeader: vi.fn(),
    on: vi.fn(),
  }
}
