import { describe, expect, test, vi } from 'vitest'
import { randomUuid } from './uuid'

describe('randomUuid', () => {
  test('is a version 4 UUID', () => {
    expect(randomUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test('is different every time', () => {
    expect(randomUuid()).not.toBe(randomUuid())
  })

  test('does not need crypto.randomUUID, which plain-HTTP pages lack', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('not a secure context')
    })

    expect(randomUuid()).toHaveLength(36)

    vi.restoreAllMocks()
  })
})
