/**
 * Tests for the centralised API client (src/api/client.ts)
 *
 * Verifies:
 * - Base URL defaults to /api/v1
 * - JWT is attached to every request via Authorization: Bearer
 * - 401 responses clear the session and redirect to /login
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

// We need access to the raw interceptors. The simplest approach is to mock
// localStorage and window.location, then import the already-instantiated
// apiClient which registers interceptors at module load time.
// Vitest resets module registry between test files so we can import freshly.

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Capture window.location.href assignments
let locationHref = ''
Object.defineProperty(globalThis, 'window', {
  value: {
    location: {
      get href() { return locationHref },
      set href(url: string) { locationHref = url },
    },
  },
  writable: true,
})

describe('apiClient', () => {
  beforeEach(() => {
    localStorageMock.clear()
    locationHref = ''
  })

  it('has /api/v1 as base URL', async () => {
    const { default: apiClient } = await import('../src/api/client')
    expect(apiClient.defaults.baseURL).toBe('/api/v1')
  })

  it('sends Authorization Bearer header when access_token is present', async () => {
    localStorageMock.setItem('access_token', 'test-jwt-token')

    // Build a fake request config and run it through the request interceptor
    const { default: apiClient } = await import('../src/api/client')

    // Access the request interceptor handlers array
    // axios stores handlers at interceptors.request.handlers
    const requestInterceptors = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: object) => object } | null>
    }).handlers.filter(Boolean)

    expect(requestInterceptors.length).toBeGreaterThan(0)

    const fakeConfig = { headers: {} as Record<string, string> }
    const result = requestInterceptors[0]!.fulfilled(fakeConfig) as {
      headers: Record<string, string>
    }

    expect(result.headers.Authorization).toBe('Bearer test-jwt-token')
  })

  it('does not send Authorization header when no token is stored', async () => {
    const { default: apiClient } = await import('../src/api/client')

    const requestInterceptors = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: object) => object } | null>
    }).handlers.filter(Boolean)

    const fakeConfig = { headers: {} as Record<string, string> }
    const result = requestInterceptors[0]!.fulfilled(fakeConfig) as {
      headers: Record<string, string>
    }

    expect(result.headers.Authorization).toBeUndefined()
  })

  it('clears session and redirects to /login on 401 response', async () => {
    localStorageMock.setItem('access_token', 'old-token')
    localStorageMock.setItem('refresh_token', 'old-refresh')
    localStorageMock.setItem('user', '{"id":"1"}')

    const { default: apiClient } = await import('../src/api/client')

    const responseInterceptors = (apiClient.interceptors.response as unknown as {
      handlers: Array<{
        fulfilled: (r: unknown) => unknown
        rejected: (err: unknown) => unknown
      } | null>
    }).handlers.filter(Boolean)

    expect(responseInterceptors.length).toBeGreaterThan(0)

    // Simulate a 401 error
    const fakeError = { response: { status: 401 } }
    try {
      await responseInterceptors[0]!.rejected(fakeError)
    } catch {
      // Expected to reject
    }

    expect(localStorageMock.getItem('access_token')).toBeNull()
    expect(localStorageMock.getItem('refresh_token')).toBeNull()
    expect(localStorageMock.getItem('user')).toBeNull()
    expect(locationHref).toBe('/login')
  })
})
