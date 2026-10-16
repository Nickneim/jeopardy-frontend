import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeSession, SESSION_ID } from '../test/fixtures'
import { get, post } from './client'
import { ApiError } from './errors'
import {
  clueAnswersRound,
  createSessionAction,
  getRememberedPlayerName,
  getStoredPlayer,
  joinSessionAction,
  sessionLoader,
  sessionsLoader,
} from './sessions'

vi.mock('./client', () => ({ get: vi.fn(), post: vi.fn() }))

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
  test('rejects an id that is not a UUID with a 400', async () => {
    const response = await thrown(
      sessionLoader(args('http://localhost/sessions/123', { id: '123' })),
    )

    expect(response.status).toBe(400)
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

    expect(data).toEqual({ session, player: { playerId: 2, token: 'secret' } })
  })
})

describe('createSessionAction', () => {
  test('creates the session, joins it as the host and redirects to it', async () => {
    vi.mocked(post)
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockResolvedValueOnce({ playerId: 1, token: 'secret' })

    const response = await createSessionAction(
      args('http://localhost/sessions', {}, { gameId: '735', playerName: ' Alice ' }),
    )

    expect(post).toHaveBeenNthCalledWith(1, '/game-sessions', { gameId: 735 })
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/game-sessions/${SESSION_ID}/players`,
      { playerName: 'Alice' },
    )
    expect(getStoredPlayer(SESSION_ID)).toEqual({ playerId: 1, token: 'secret' })
    expect(getRememberedPlayerName()).toBe('Alice')
    expect((response as Response).headers.get('Location'))
      .toBe(`/sessions/${SESSION_ID}`)
  })

  test('asks for a name without creating a session', async () => {
    const result = await createSessionAction(
      args('http://localhost/sessions', {}, { gameId: '735', playerName: ' ' }),
    )

    expect(result).toEqual({ error: 'Enter your name to host.' })
    expect(post).not.toHaveBeenCalled()
  })

  test('shows a name the backend rejects on the form', async () => {
    vi.mocked(post)
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockRejectedValueOnce(new ApiError(400, 'Name too long'))

    const result = await createSessionAction(
      args('http://localhost/sessions', {}, { gameId: '735', playerName: 'Alice' }),
    )

    expect(result).toEqual({ error: 'Name too long' })
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('rejects an invalid game id with a 400', async () => {
    const response = await thrown(
      createSessionAction(args('http://localhost/sessions', {}, { gameId: 'x' })),
    )

    expect(response.status).toBe(400)
    expect(post).not.toHaveBeenCalled()
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

  test.each([400, 409])('shows a %i from the backend on the form', async status => {
    vi.mocked(post).mockRejectedValue(new ApiError(status, 'Nope'))

    const result = await joinSessionAction(args(url, params, { playerName: 'Bob' }))

    expect(result).toEqual({ error: 'Nope' })
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('lets other errors through to the error page', async () => {
    vi.mocked(post).mockRejectedValue(new ApiError(404, 'Game session not found'))

    await expect(joinSessionAction(args(url, params, { playerName: 'Bob' })))
      .rejects.toThrow('Game session not found')
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
