import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseHeaders } from '../src/config'
// We'll import loadConfig dynamically in each test after setting up mocks

describe('parseHeaders', () => {
  it('should parse header string into a record', () => {
    const headerStr = 'key1:value1,key2:value2'
    const result = parseHeaders(headerStr)
    expect(result).toEqual({
      key1: 'value1',
      key2: 'value2'
    })
  })

  it('should handle whitespace in header string', () => {
    const headerStr = 'key1: value1 , key2 :value2'
    const result = parseHeaders(headerStr)
    expect(result).toEqual({
      key1: 'value1',
      key2: 'value2'
    })
  })

  it('should return empty object for undefined input', () => {
    const result = parseHeaders(undefined)
    expect(result).toEqual({})
  })

  it('should handle empty string input', () => {
    const result = parseHeaders('')
    expect(result).toEqual({})
  })

  it('should skip malformed headers', () => {
    const headerStr = 'key1:value1,malformed,key2:value2'
    const result = parseHeaders(headerStr)
    expect(result).toEqual({
      key1: 'value1',
      key2: 'value2'
    })
  })
})

describe('loadConfig', () => {
  const originalEnv = { ...process.env }
  const originalArgv = [...process.argv]

  beforeEach(() => {
    vi.resetModules()
    process.argv = ['node', 'script.js']
    // Clear environment variables that might affect tests
    delete process.env.API_BASE_URL
    delete process.env.OPENAPI_SPEC_PATH
    delete process.env.API_HEADERS
    delete process.env.SERVER_NAME
    delete process.env.SERVER_VERSION
    
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    process.argv = [...originalArgv]
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('should load config from command line arguments', async () => {
    // Setup mocks before importing the module
    vi.mock('yargs', () => ({
      default: () => ({
        option: () => ({
          option: () => ({
            option: () => ({
              option: () => ({
                option: () => ({
                  help: () => ({
                    argv: {
                      'api-base-url': 'https://api.example.com',
                      'openapi-spec': './spec.json',
                      'headers': 'Authorization:Bearer token',
                      'name': 'test-server',
                      'version': '1.2.3'
                    }
                  })
                })
              })
            })
          })
        })
      })
    }));
    
    vi.mock('yargs/helpers', () => ({
      hideBin: (arr) => arr
    }));
    
    // Import the module after setting up mocks
    const { loadConfig } = await import('../src/config');
    
    const config = loadConfig();
    expect(config).toEqual({
      name: 'test-server',
      version: '1.2.3',
      apiBaseUrl: 'https://api.example.com',
      openApiSpec: './spec.json',
      headers: {
        Authorization: 'Bearer token'
      }
    });
  })

  it('should throw error if API base URL is missing', async () => {
    // Setup mocks before importing the module
    vi.mock('yargs', () => ({
      default: () => ({
        option: () => ({
          option: () => ({
            option: () => ({
              option: () => ({
                option: () => ({
                  help: () => ({
                    argv: {
                      'openapi-spec': './spec.json'
                    }
                  })
                })
              })
            })
          })
        })
      })
    }));
    
    vi.mock('yargs/helpers', () => ({
      hideBin: (arr) => arr
    }));
    
    // Import the module after setting up mocks
    const { loadConfig } = await import('../src/config');
    
    expect(() => loadConfig()).toThrow('API base URL is required');
  })

  it('should throw error if OpenAPI spec is missing', async () => {
    // Setup mocks before importing the module
    vi.mock('yargs', () => ({
      default: () => ({
        option: () => ({
          option: () => ({
            option: () => ({
              option: () => ({
                option: () => ({
                  help: () => ({
                    argv: {
                      'api-base-url': 'https://api.example.com'
                    }
                  })
                })
              })
            })
          })
        })
      })
    }));
    
    vi.mock('yargs/helpers', () => ({
      hideBin: (arr) => arr
    }));
    
    // Import the module after setting up mocks
    const { loadConfig } = await import('../src/config');
    
    expect(() => loadConfig()).toThrow('OpenAPI spec is required');
  })

  it('should use environment variables as fallback', async () => {
    // Setup mocks before importing the module
    vi.mock('yargs', () => ({
      default: () => ({
        option: () => ({
          option: () => ({
            option: () => ({
              option: () => ({
                option: () => ({
                  help: () => ({
                    argv: {}
                  })
                })
              })
            })
          })
        })
      })
    }));
    
    vi.mock('yargs/helpers', () => ({
      hideBin: (arr) => arr
    }));
    
    // Set environment variables
    process.env.API_BASE_URL = 'https://env.example.com'
    process.env.OPENAPI_SPEC_PATH = './env-spec.json'
    process.env.API_HEADERS = 'X-API-Key:12345'
    process.env.SERVER_NAME = 'env-server'
    process.env.SERVER_VERSION = '3.2.1'
    
    // Import the module after setting up mocks
    const { loadConfig } = await import('../src/config');
    
    const config = loadConfig()
    expect(config).toEqual({
      name: 'env-server',
      version: '3.2.1',
      apiBaseUrl: 'https://env.example.com',
      openApiSpec: './env-spec.json',
      headers: {
        'X-API-Key': '12345'
      }
    })
  })

  it('should use default values for name and version if not provided', async () => {
    // Setup mocks before importing the module
    vi.mock('yargs', () => ({
      default: () => ({
        option: () => ({
          option: () => ({
            option: () => ({
              option: () => ({
                option: () => ({
                  help: () => ({
                    argv: {
                      'api-base-url': 'https://api.example.com',
                      'openapi-spec': './spec.json'
                    }
                  })
                })
              })
            })
          })
        })
      })
    }));
    
    vi.mock('yargs/helpers', () => ({
      hideBin: (arr) => arr
    }));
    
    // Import the module after setting up mocks
    const { loadConfig } = await import('../src/config');
    
    const config = loadConfig()
    expect(config.name).toBe('mcp-openapi-server')
    expect(config.version).toBe('1.0.0')
  })
})
