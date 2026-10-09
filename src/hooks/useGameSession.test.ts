import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getSession, type GameSession } from '../api/sessions'
import { ApiError } from '../api/errors'
import { makeSession, SESSION_ID } from '../test/fixtures'
import { useGameSession } from './useGameSession'

// A stand-in for @stomp/stompjs's Client: tests drive its callbacks.
interface FakeClient {
  config: {
    connectHeaders: Record<string, string>
    onConnect: () => void
    onStompError: (frame: { headers: Record<string, string> }) => void
    onWebSocketClose: () => void
  }
  connected: boolean
  deactivated: boolean
  subscriptions: Map<string, (frame: { body: string }) => void>
  published: { destination: string, body: string }[]
}

const { clients } = vi.hoisted(() => ({ clients: [] as FakeClient[] }))

vi.mock('@stomp/stompjs', () => ({
  Client: class {
    config: FakeClient['config']
    connected = false
    deactivated = false
    subscriptions = new Map()
    published: FakeClient['published'] = []

    constructor(config: FakeClient['config']) {
      this.config = config
      clients.push(this as unknown as FakeClient)
    }

    activate() {}

    deactivate() {
      this.deactivated = true
      return Promise.resolve()
    }

    subscribe(destination: string, callback: (frame: { body: string }) => void) {
      this.subscriptions.set(destination, callback)
    }

    publish(frame: { destination: string, body: string }) {
      this.published.push(frame)
    }
  },
}))

vi.mock('../api/sessions', async importOriginal => ({
  ...await importOriginal<typeof import('../api/sessions')>(),
  getSession: vi.fn(),
}))

const TOPIC = `/topic/sessions/${SESSION_ID}`

function lastClient(): FakeClient {
  return clients[clients.length - 1]
}

function connect(client = lastClient()) {
  act(() => {
    client.connected = true
    client.config.onConnect()
  })
}

function broadcast(session: GameSession, client = lastClient()) {
  act(() => {
    client.subscriptions.get(TOPIC)?.({ body: JSON.stringify(session) })
  })
}

beforeEach(() => {
  clients.length = 0
  // By default the catch-up fetch never answers, so it can't interfere.
  vi.mocked(getSession).mockReset().mockReturnValue(new Promise(() => {}))
})

describe('useGameSession', () => {
  test('connects with the token in the CONNECT header, and none to watch', () => {
    renderHook(() => useGameSession(makeSession(), 'secret', () => {}))
    expect(lastClient().config.connectHeaders).toEqual({ 'player-token': 'secret' })

    renderHook(() => useGameSession(makeSession(), null, () => {}))
    expect(lastClient().config.connectHeaders).toEqual({})
  })

  test('keeps the snapshot with the highest version', () => {
    const { result } = renderHook(() =>
      useGameSession(makeSession({ version: 1 }), null, () => {}))

    connect()
    broadcast(makeSession({ version: 3, state: 'CHOOSING_CLUE' }))
    broadcast(makeSession({ version: 2, state: 'WAITING_FOR_START' }))

    expect(result.current.session.version).toBe(3)
    expect(result.current.session.state).toBe('CHOOSING_CLUE')
  })

  test('catches up over REST after connecting, unless a broadcast is newer', async () => {
    let resolveFetch: (session: GameSession) => void = () => {}
    vi.mocked(getSession).mockReturnValue(
      new Promise(resolve => { resolveFetch = resolve }),
    )

    const { result } = renderHook(() =>
      useGameSession(makeSession({ version: 1 }), null, () => {}))

    connect()
    broadcast(makeSession({ version: 5 }))
    await act(async () => resolveFetch(makeSession({ version: 4 })))

    expect(getSession).toHaveBeenCalledWith(SESSION_ID)
    expect(result.current.session.version).toBe(5)
  })

  test('reports a session that no longer exists as gone', async () => {
    vi.mocked(getSession).mockRejectedValue(new ApiError(404, 'Not found'))

    const { result } = renderHook(() =>
      useGameSession(makeSession(), null, () => {}))

    connect()

    await waitFor(() => expect(result.current.status).toBe('gone'))
    expect(lastClient().deactivated).toBe(true)
  })

  test('a token rejected on CONNECT is reported without a reason', () => {
    const onTokenRejected = vi.fn()
    renderHook(() => useGameSession(makeSession(), 'secret', onTokenRejected))

    act(() => lastClient().config.onStompError({
      headers: { message: 'Unknown player token' },
    }))

    expect(onTokenRejected).toHaveBeenCalledWith(null)
    expect(lastClient().deactivated).toBe(true)
  })

  test('an ERROR after connecting (left or kicked) passes on its reason', () => {
    const onTokenRejected = vi.fn()
    renderHook(() => useGameSession(makeSession(), 'secret', onTokenRejected))

    connect()
    act(() => lastClient().config.onStompError({
      headers: { message: 'You were removed from the session by the host' },
    }))

    expect(onTokenRejected)
      .toHaveBeenCalledWith('You were removed from the session by the host')
  })

  test('ignores ERROR frames on a watcher connection', () => {
    const onTokenRejected = vi.fn()
    renderHook(() => useGameSession(makeSession(), null, onTokenRejected))

    act(() => lastClient().config.onStompError({ headers: {} }))

    expect(onTokenRejected).not.toHaveBeenCalled()
  })

  test('stops reconnecting once the session is closed', () => {
    renderHook(() => useGameSession(makeSession(), 'secret', () => {}))

    connect()
    broadcast(makeSession({ version: 1, state: 'CLOSED', closeReason: 'ABANDONED' }))

    expect(lastClient().deactivated).toBe(true)
  })

  test('sends actions to the session, and leave says whether it was sent', () => {
    const { result } = renderHook(() =>
      useGameSession(makeSession(), 'secret', () => {}))

    let sent: boolean | undefined
    act(() => { sent = result.current.actions.leave() })
    expect(sent).toBe(false)
    expect(result.current.error?.message).toMatch(/Not connected/)

    connect()
    act(() => { sent = result.current.actions.leave() })
    act(() => result.current.actions.kick(2))

    expect(sent).toBe(true)
    expect(lastClient().published).toEqual([
      expect.objectContaining({
        destination: `/app/sessions/${SESSION_ID}/leave`,
        body: '',
      }),
      expect.objectContaining({
        destination: `/app/sessions/${SESSION_ID}/kick`,
        body: JSON.stringify({ playerId: 2 }),
      }),
    ])
  })
})
