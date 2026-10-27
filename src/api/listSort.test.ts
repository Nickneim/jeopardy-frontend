import { describe, expect, test } from 'vitest'
import { sortParams } from './listSort'

const COLUMNS = ['title', 'season', 'gameDate'] as const
const FALLBACK = { sort: 'gameDate', direction: 'desc' } as const

describe('sortParams', () => {
  test('falls back to the default sort', () => {
    expect(sortParams(new URL('http://localhost/games'), COLUMNS, FALLBACK))
      .toEqual(FALLBACK)
  })

  test('sorts another column ascending unless told otherwise', () => {
    const url = new URL('http://localhost/games?sort=title')

    expect(sortParams(url, COLUMNS, FALLBACK))
      .toEqual({ sort: 'title', direction: 'asc' })
  })

  test.each(['sort=clues', 'direction=down'])('rejects %s with a 400', query => {
    const url = new URL(`http://localhost/games?${query}`)

    expect(() => sortParams(url, COLUMNS, FALLBACK)).toThrow(Response)
  })
})
