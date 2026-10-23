import { describe, expect, test } from 'vitest'
import { ApiError, isServerOffline } from './errors'

describe('isServerOffline', () => {
  test.each([0, 502, 503, 504])('is true for status %i', status => {
    expect(isServerOffline(new ApiError(status, 'Request failed'))).toBe(true)
  })

  test.each([400, 401, 403, 404, 409, 500])('is false for status %i', status => {
    expect(isServerOffline(new ApiError(status, 'Request failed'))).toBe(false)
  })

  test('is false for anything that is not an ApiError', () => {
    expect(isServerOffline(new Error('Network Error'))).toBe(false)
    expect(isServerOffline(new Response('Not found', { status: 502 }))).toBe(false)
    expect(isServerOffline(null)).toBe(false)
  })
})
