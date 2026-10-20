import { describe, expect, test, vi } from 'vitest'
import {
  normalizeSessionCode,
  randomSessionCode,
  SESSION_CODE_ALPHABET,
} from './sessionCode'

describe('randomSessionCode', () => {
  test('is 5 characters of the alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = randomSessionCode()

      expect(code).toHaveLength(5)
      expect([...code].every(c => SESSION_CODE_ALPHABET.includes(c))).toBe(true)
    }
  })

  test('maps random bytes onto the whole alphabet', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
      (array as Uint8Array).set([0, 9, 10, 31, 255])
      return array
    })

    expect(randomSessionCode()).toBe('09AZZ')

    vi.restoreAllMocks()
  })
})

describe('normalizeSessionCode', () => {
  test('keeps a valid code', () => {
    expect(normalizeSessionCode('7KQ2M')).toBe('7KQ2M')
  })

  test('accepts what people type: any case, spaces around, O, I and L', () => {
    expect(normalizeSessionCode(' 7kq2m ')).toBe('7KQ2M')
    expect(normalizeSessionCode('oilOI')).toBe('01101')
  })

  test.each(['', '7KQ2', '7KQ2MX', '7KQ2U', '7K-2M', '7K Q2M'])(
    'rejects %j',
    input => expect(normalizeSessionCode(input)).toBeNull(),
  )
})
