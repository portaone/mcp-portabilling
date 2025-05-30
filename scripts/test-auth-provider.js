#!/usr/bin/env node

// Test script to verify AuthProvider implementation

import { ApiClient } from '../src/api-client.js'
import { AuthProvider, StaticAuthProvider } from '../src/auth-provider.js'

console.log('🧪 Testing AuthProvider implementation...')

// Test 1: StaticAuthProvider
console.log('\n1. Testing StaticAuthProvider...')
const staticAuth = new StaticAuthProvider({ 'Authorization': 'Bearer test-token' })

staticAuth.getAuthHeaders().then(headers => {
  console.log('✅ StaticAuthProvider headers:', headers)
}).catch(err => {
  console.log('❌ StaticAuthProvider error:', err)
})

// Test 2: Custom AuthProvider
console.log('\n2. Testing Custom AuthProvider...')
class TestAuthProvider {
  constructor() {
    this.tokenValid = true
    this.callCount = 0
  }

  async getAuthHeaders() {
    this.callCount++
    if (!this.tokenValid) {
      throw new Error('Token expired')
    }
    return { 'Authorization': `Bearer fresh-token-${this.callCount}` }
  }

  async handleAuthError(error) {
    console.log('🔄 Handling auth error:', error.response?.status)
    if (this.callCount === 1) {
      // First error, refresh token
      this.tokenValid = true
      return true // retry
    }
    // Second error, give up
    return false
  }

  expireToken() {
    this.tokenValid = false
  }
}

const customAuth = new TestAuthProvider()

customAuth.getAuthHeaders().then(headers => {
  console.log('✅ Custom AuthProvider headers:', headers)
}).catch(err => {
  console.log('❌ Custom AuthProvider error:', err)
})

// Test 3: ApiClient with AuthProvider
console.log('\n3. Testing ApiClient with AuthProvider...')
const apiClient = new ApiClient('https://api.example.com', customAuth)

console.log('✅ ApiClient created with AuthProvider')

// Test 4: Backward compatibility
console.log('\n4. Testing backward compatibility...')
const legacyClient = new ApiClient('https://api.example.com', { 'X-API-Key': 'legacy-key' })

console.log('✅ ApiClient created with legacy headers')

console.log('\n🎉 All tests completed!')
