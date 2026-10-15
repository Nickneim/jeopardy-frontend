import { describe, expect, test } from 'vitest'
import { formatCorrectResponse, formatMoney } from './format'

describe('formatMoney', () => {
  test('formats with a dollar sign and thousands separators', () => {
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(400)).toBe('$400')
    expect(formatMoney(12000)).toBe('$12,000')
  })

  test('puts the minus sign before the dollar sign', () => {
    expect(formatMoney(-400)).toBe('-$400')
    expect(formatMoney(-1200)).toBe('-$1,200')
  })
})

describe('formatCorrectResponse', () => {
  test('leaves an answer without alternatives as it is', () => {
    expect(formatCorrectResponse('(Abraham) Lincoln')).toBe('(Abraham) Lincoln')
    expect(formatCorrectResponse('bear/bare')).toBe('bear/bare')
  })

  test('joins the options of a "1 of" list with "or"', () => {
    expect(formatCorrectResponse('(1 of) Myanmar | Burma')).toBe('Myanmar or Burma')
    expect(formatCorrectResponse('(1 of) 7 | 11 | 13')).toBe('7, 11 or 13')
  })

  test('joins a list that needs every option with "and"', () => {
    expect(formatCorrectResponse('(3 of) gold | frankincense | myrrh'))
      .toBe('gold, frankincense and myrrh')
  })

  test('says how many options a partial list needs', () => {
    expect(formatCorrectResponse('(2 of) gold | frankincense | myrrh'))
      .toBe('Any 2 of: gold, frankincense, myrrh')
  })
})
