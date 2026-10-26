import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makePlayer, makeSession, SESSION_ID } from '../test/fixtures'
import { randomSessionCode } from '../sessionCode'
import { get, post, put } from './client'
import { ApiError } from './errors'
import {
  clueAnswersRound,
  getRememberedPlayerName,
  getStoredPlayer,
  isJoinable,
  isLastPlayer,
  joinSessionAction,
  sessionLoader,
  sessionsAction,
  sessionsLoader,
} from './sessions'

vi.mock('./client', () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('../sessionCode', async importOriginal => ({
  ...await importOriginal<typeof import('../sessionCode')>(),
  randomSessionCode: vi.fn(),
}))

// Loaders and actions only use `request` and `params`.
function args(
  url: string,
  params: Record<string, string> = {},
  form?: Record<string, string>,
): LoaderFunctionArgs & ActionFunctionArgs {
  const request = form
    ? new Request(url, { method: 'POST', body: new URLSearchParams(form) })
    : new Request(url)

  return { request, params } as unknown as LoaderFunctionArgs & ActionFunctionArgs
}

// Loaders and actions throw Responses for bad input and redirects.
async function thrown(promise: Promise<unknown>): Promise<Response> {
  try {
    await promise
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    throw error
  }
  throw new Error('Expected a thrown Response')
}

function page(totalPages: number, pageNumber = 0) {
  return { content: [], page: pageNumber, size: 20, totalElements: 0, totalPages }
}

beforeEach(() => {
  vi.mocked(get).mockReset()
  vi.mocked(post).mockReset()
  vi.mocked(put).mockReset()
  vi.mocked(randomSessionCode).mockReset().mockReturnValue(SESSION_ID)
})

describe('sessionsLoader', () => {
  test('fetches the requested page', async () => {
    vi.mocked(get).mockResolvedValue(page(3, 1))

    await sessionsLoader(args('http://localhost/sessions?page=1'))

    expect(get).toHaveBeenCalledWith('/game-sessions', { page: 1, size: 20 })
  })

  test('asks for finished games too with finished=true', async () => {
    vi.mocked(get).mockResolvedValue(page(1))

    await sessionsLoader(args('http://localhost/sessions?finished=true'))

    expect(get).toHaveBeenCalledWith('/game-sessions', {
      page: 0,
      size: 20,
      includeFinished: 'true',
    })
  })

  test.each(['-1', '1.5', 'abc'])('rejects page=%s with a 400', async value => {
    const response = await thrown(
      sessionsLoader(args(`http://localhost/sessions?page=${value}`)),
    )

    expect(response.status).toBe(400)
    expect(get).not.toHaveBeenCalled()
  })

  test('redirects past the last page to the last page', async () => {
    vi.mocked(get).mockResolvedValue(page(2, 5))

    const response = await thrown(
      sessionsLoader(args('http://localhost/sessions?page=5')),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/sessions?page=1')
  })
})

describe('sessionLoader', () => {
  test.each(['123', '7KQ2U', '7KQ2MX'])(
    'rejects %j, which is not a session code, with a 400',
    async id => {
      const response = await thrown(
        sessionLoader(args(`http://localhost/sessions/${id}`, { id })),
      )

      expect(response.status).toBe(400)
      expect(get).not.toHaveBeenCalled()
    },
  )

  test('redirects a code typed another way to its normalized form', async () => {
    const response = await thrown(sessionLoader(
      args('http://localhost/sessions/7kq2m?x=1', { id: '7kq2m' }),
    ))

    expect(response.headers.get('Location')).toBe(`/sessions/${SESSION_ID}?x=1`)
    expect(get).not.toHaveBeenCalled()
  })

  test('returns the session and the player stored for it', async () => {
    const session = makeSession()
    vi.mocked(get).mockResolvedValue(session)
    localStorage.setItem(
      `jeopardy.session.${SESSION_ID}`,
      JSON.stringify({ playerId: 2, token: 'secret' }),
    )

    const data = await sessionLoader(
      args(`http://localhost/sessions/${SESSION_ID}`, { id: SESSION_ID }),
    )

    expect(get).toHaveBeenCalledWith(
      `/game-sessions/${SESSION_ID}`,
      { session: SESSION_ID },
    )
    expect(data).toEqual({ session, player: { playerId: 2, token: 'secret' } })
  })
})

describe('sessionsAction: hosting', () => {
  test('creates the session under a new code, joins it as the host and redirects to it', async () => {
    vi.mocked(put).mockResolvedValue({ id: SESSION_ID })
    vi.mocked(post).mockResolvedValue({ playerId: 1, token: 'secret' })

    const response = await sessionsAction(
      args('http://localhost/sessions', {}, { gameId: '735', playerName: ' Alice ' }),
    )

    // Both requests carry the session id for the load balancer to route by.
    expect(put).toHaveBeenCalledWith(
      `/game-sessions/${SESSION_ID}`,
      { gameId: 735 },
      { session: SESSION_ID },
    )
    expect(post).toHaveBeenCalledWith(
      `/game-sessions/${SESSION_ID}/players`,
      { playerName: 'Alice' },
      { session: SESSION_ID },
    )
    expect(getStoredPlayer(SESSION_ID)).toEqual({ playerId: 1, token: 'secret' })
    expect(getRememberedPlayerName()).toBe('Alice')
    expect((response as Response).headers.get('Location'))
      .toBe(`/sessions/${SESSION_ID}`)
  })

  test('asks for a name without creating a session', async () => {
    const result = await sessionsAction(
      args('http://localhost/sessions', {}, { gameId: '735', playerName: ' ' }),
    )

    expect(result).toEqual({ error: 'Enter your name to host.' })
    expect(put).not.toHaveBeenCalled()
  })

  test('shows a name the backend rejects on the form', async () => {
    vi.mocked(put).mockResolvedValue({ id: SESSION_ID })
    vi.mocked(post).mockRejectedValue(new ApiError(400, 'Name too long', 'INVALID_REQUEST'))

    const result = await sessionsAction(
      args('http://localhost/sessions', {}, { gameId: '735', playerName: 'Alice' }),
    )

    expect(result).toEqual({ error: 'Name too long' })
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('picks another code when the first one is taken', async () => {
    vi.mocked(randomSessionCode)
      .mockReturnValueOnce('AAAAA')
      .mockReturnValueOnce(SESSION_ID)
    vi.mocked(put)
      .mockRejectedValueOnce(new ApiError(409, 'Game session already exists: AAAAA', 'SESSION_ALREADY_EXISTS'))
      .mockResolvedValueOnce({ id: SESSION_ID })
    vi.mocked(post).mockResolvedValue({ playerId: 1, token: 'secret' })

    const response = await sessionsAction(
      args('http://localhost/sessions', {}, { gameId: '735', playerName: 'Alice' }),
    )

    expect(put).toHaveBeenNthCalledWith(
      2,
      `/game-sessions/${SESSION_ID}`,
      { gameId: 735 },
      { session: SESSION_ID },
    )
    expect((response as Response).headers.get('Location'))
      .toBe(`/sessions/${SESSION_ID}`)
  })

  test('gives up after 5 taken codes', async () => {
    vi.mocked(put).mockRejectedValue(new ApiError(409, 'Game session already exists', 'SESSION_ALREADY_EXISTS'))

    await expect(sessionsAction(
      args('http://localhost/sessions', {}, { gameId: '735', playerName: 'Alice' }),
    )).rejects.toThrow('Game session already exists')
    expect(put).toHaveBeenCalledTimes(5)
  })

  test("says on the form why a game can't be played", async () => {
    vi.mocked(put).mockRejectedValue(new ApiError(
      422,
      "Game 725 can't be played: the board has no clues",
      'UNPLAYABLE_GAME',
    ))

    const result = await sessionsAction(
      args('http://localhost/sessions', {}, { gameId: '725', playerName: 'Alice' }),
    )

    expect(result).toEqual({ error: "Game 725 can't be played: the board has no clues" })
    expect(post).not.toHaveBeenCalled()
  })

  test('rejects a name over 30 characters, counting emoji as one', async () => {
    const result = await sessionsAction(args(
      'http://localhost/sessions', {}, { gameId: '735', playerName: '😀'.repeat(31) },
    ))

    expect(result).toEqual({ error: 'Names can be at most 30 characters.' })
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects an invalid game id with a 400', async () => {
    const response = await thrown(
      sessionsAction(args('http://localhost/sessions', {}, { gameId: 'x' })),
    )

    expect(response.status).toBe(400)
    expect(put).not.toHaveBeenCalled()
  })
})

describe('sessionsAction: join with a code', () => {
  const url = 'http://localhost/sessions'

  test('opens the session under the normalized code', async () => {
    vi.mocked(get).mockResolvedValue(makeSession())

    const response = await sessionsAction(args(url, {}, { code: ' 7kq2m ' }))

    expect(get).toHaveBeenCalledWith(
      `/game-sessions/${SESSION_ID}`,
      { session: SESSION_ID },
    )
    expect((response as Response).headers.get('Location'))
      .toBe(`/sessions/${SESSION_ID}`)
  })

  test.each([
    ['', "Enter the game's code."],
    ['7KQ', 'A game code is 5 letters and digits, such as 7KQ2M.'],
  ])('explains on the form what is wrong with %j', async (code, error) => {
    expect(await sessionsAction(args(url, {}, { code }))).toEqual({ error })
    expect(get).not.toHaveBeenCalled()
  })

  test('says when no game has the code', async () => {
    vi.mocked(get).mockRejectedValue(new ApiError(404, 'Game session not found', 'SESSION_NOT_FOUND'))

    expect(await sessionsAction(args(url, {}, { code: '7KQ2M' })))
      .toEqual({ error: "There's no live game with the code 7KQ2M." })
  })
})

describe('joinSessionAction', () => {
  const url = `http://localhost/sessions/${SESSION_ID}`
  const params = { id: SESSION_ID }

  test('stores the player and redirects back to the session', async () => {
    vi.mocked(post).mockResolvedValue({ playerId: 3, token: 'secret' })

    const response = await joinSessionAction(
      args(url, params, { playerName: '  Bob  ' }),
    )

    expect(post).toHaveBeenCalledWith(
      `/game-sessions/${SESSION_ID}/players`,
      { playerName: 'Bob' },
      { session: SESSION_ID },
    )
    expect(getStoredPlayer(SESSION_ID)).toEqual({ playerId: 3, token: 'secret' })
    expect((response as Response).headers.get('Location'))
      .toBe(`/sessions/${SESSION_ID}`)
  })

  test('asks for a name without calling the backend', async () => {
    const result = await joinSessionAction(args(url, params, { playerName: ' ' }))

    expect(result).toEqual({ error: 'Enter a name to join.' })
    expect(post).not.toHaveBeenCalled()
  })

  test.each([
    [400, 'INVALID_REQUEST'],
    [409, 'SESSION_NOT_JOINABLE'],
  ] as const)('shows a %i %s from the backend on the form', async (status, code) => {
    vi.mocked(post).mockRejectedValue(new ApiError(status, 'Nope', code))

    const result = await joinSessionAction(args(url, params, { playerName: 'Bob' }))

    expect(result).toEqual({ error: 'Nope' })
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('lets other errors through to the error page', async () => {
    vi.mocked(post).mockRejectedValue(new ApiError(404, 'Game session not found', 'SESSION_NOT_FOUND'))

    await expect(joinSessionAction(args(url, params, { playerName: 'Bob' })))
      .rejects.toThrow('Game session not found')
  })
})

describe('isJoinable', () => {
  test("follows allowLateJoin during the game, until Final Jeopardy's wagering ends", () => {
    expect(isJoinable(makeSession({ allowLateJoin: false }))).toBe(true)
    expect(isJoinable(makeSession({ state: 'CHOOSING_CLUE' }))).toBe(true)
    expect(isJoinable(makeSession({ state: 'CHOOSING_CLUE', allowLateJoin: false })))
      .toBe(false)
    expect(isJoinable(makeSession({ state: 'FINAL_JEOPARDY_WAGERING' }))).toBe(true)
    expect(isJoinable(makeSession({ state: 'FINAL_JEOPARDY_ANSWERING' }))).toBe(false)
    expect(isJoinable(makeSession({ state: 'FINISHED_GAME' }))).toBe(false)
  })
})

describe('isLastPlayer', () => {
  const players = [makePlayer({ id: 1 }), makePlayer({ id: 2, leaving: true })]

  test('is true when everyone else has left', () => {
    expect(isLastPlayer(makeSession({ state: 'CHOOSING_CLUE', players }), 1)).toBe(true)
  })

  test('is never true once the game has finished, whose results stay', () => {
    expect(isLastPlayer(makeSession({ state: 'FINISHED_GAME', players }), 1)).toBe(false)
  })
})

describe('clueAnswersRound', () => {
  function board(status: 'AVAILABLE' | 'PLAYED') {
    return [{
      name: 'POTPOURRI',
      comments: null,
      slots: [{ row: 1, clueId: 7, value: 400, status }],
    }]
  }

  test('is the current round once a clue of it has been chosen', () => {
    expect(clueAnswersRound(makeSession({ round: 'JEOPARDY', board: board('PLAYED') })))
      .toBe('JEOPARDY')
    expect(clueAnswersRound(makeSession({ round: 'DOUBLE_JEOPARDY', board: board('PLAYED') })))
      .toBe('DOUBLE_JEOPARDY')
  })

  test('is still the Jeopardy round before the first Double Jeopardy clue', () => {
    expect(clueAnswersRound(makeSession({
      round: 'DOUBLE_JEOPARDY',
      state: 'CHOOSING_CLUE',
      board: board('AVAILABLE'),
    }))).toBe('JEOPARDY')
  })
})
