import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getSession, type GameSession } from '../api/sessions'
import { ApiError } from '../api/errors'
import { makePlayer, makeSession, SESSION_ID } from '../test/fixtures'
import { useGameSession } from './useGameSession'

// A stand-in for @stomp/stompjs's Client: tests drive its callbacks.
interface FakeClient {
  config: {
    brokerURL: string
    connectHeaders: Record<string, string>
    heartbeatStrategy: string
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
  TickerStrategy: { Interval: 'interval', Worker: 'worker' },
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
const PLAYER = { playerId: 2, token: 'secret' }

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
    renderHook(() => useGameSession(makeSession(), PLAYER, () => {}))
    expect(lastClient().config.connectHeaders).toEqual({ 'player-token': 'secret' })

    renderHook(() => useGameSession(makeSession(), null, () => {}))
    expect(lastClient().config.connectHeaders).toEqual({})
  })

  test('connects to /ws with the session in the URL, for routing', () => {
    renderHook(() => useGameSession(makeSession(), null, () => {}))
    expect(lastClient().config.brokerURL)
      .toBe(`ws://${window.location.host}/ws?session=${SESSION_ID}`)
  })

  test('sends heartbeats from a Web Worker, which a hidden tab keeps running', () => {
    renderHook(() => useGameSession(makeSession(), PLAYER, () => {}))
    expect(lastClient().config.heartbeatStrategy).toBe('worker')
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

  test('a session that no longer exists ends it as gone', async () => {
    vi.mocked(getSession).mockRejectedValue(
      new ApiError(404, 'Game session not found', 'SESSION_NOT_FOUND'))
    const onEnded = vi.fn()

    const { result } = renderHook(() =>
      useGameSession(makeSession(), PLAYER, onEnded))

    connect()

    await waitFor(() => expect(result.current.status).toBe('ended'))
    expect(onEnded).toHaveBeenCalledExactlyOnceWith({ reason: 'gone' })
    expect(lastClient().deactivated).toBe(true)
  })

  test('a session missing while reconnecting ends it as gone', async () => {
    vi.mocked(getSession).mockRejectedValue(
      new ApiError(404, 'Game session not found', 'SESSION_NOT_FOUND'))
    const onEnded = vi.fn()

    renderHook(() => useGameSession(makeSession(), PLAYER, onEnded))
    act(() => lastClient().config.onWebSocketClose())

    await waitFor(() =>
      expect(onEnded).toHaveBeenCalledExactlyOnceWith({ reason: 'gone' }))
  })

  test('a 404 without SESSION_NOT_FOUND (a proxy, say) keeps the session', async () => {
    vi.mocked(getSession).mockRejectedValue(new ApiError(404, 'Not found'))
    const onEnded = vi.fn()

    const { result } = renderHook(() =>
      useGameSession(makeSession(), PLAYER, onEnded))

    connect()

    await waitFor(() => expect(getSession).toHaveBeenCalled())
    expect(onEnded).not.toHaveBeenCalled()
    expect(result.current.status).toBe('connected')
  })

  test('keeps the same actions across renders', () => {
    const { result, rerender } = renderHook(() =>
      useGameSession(makeSession(), PLAYER, () => {}))

    const first = result.current.actions
    connect()
    broadcast(makeSession({ version: 2 }))
    rerender()

    expect(result.current.actions).toBe(first)
  })

  test('leave reads the latest snapshot to tell the last player', () => {
    const onEnded = vi.fn()
    const players = [makePlayer({ id: 1 }), makePlayer({ id: 2, name: 'Bob' })]
    const { result } = renderHook(() =>
      useGameSession(makeSession({ version: 1, players }), PLAYER, onEnded))

    connect()
    // Player 1 has left since the first snapshot.
    broadcast(makeSession({
      version: 2,
      players: [makePlayer({ id: 1, leaving: true }), players[1]],
    }))
    act(() => { result.current.actions.leave() })

    expect(onEnded).toHaveBeenCalledExactlyOnceWith({ reason: 'abandoned' })
  })

  test('reports the server offline when neither the WebSocket nor the API answers', async () => {
    vi.mocked(getSession).mockRejectedValue(new ApiError(504, 'Request failed'))

    const { result } = renderHook(() =>
      useGameSession(makeSession(), null, () => {}))

    act(() => lastClient().config.onWebSocketClose())

    await waitFor(() => expect(result.current.status).toBe('offline'))
    expect(getSession).toHaveBeenCalledWith(SESSION_ID)
    expect(lastClient().deactivated).toBe(true)
  })

  test('keeps reconnecting when the WebSocket fails but the API answers', async () => {
    vi.mocked(getSession).mockRejectedValue(new ApiError(500, 'Oops'))

    const { result } = renderHook(() =>
      useGameSession(makeSession(), null, () => {}))

    act(() => lastClient().config.onWebSocketClose())

    await waitFor(() => expect(getSession).toHaveBeenCalled())
    expect(result.current.status).toBe('reconnecting')
    expect(lastClient().deactivated).toBe(false)
  })

  test('a dropped connection reconnects before checking on the server', () => {
    const { result } = renderHook(() =>
      useGameSession(makeSession(), null, () => {}))

    connect()
    vi.mocked(getSession).mockClear()
    act(() => lastClient().config.onWebSocketClose())

    expect(result.current.status).toBe('reconnecting')
    expect(getSession).not.toHaveBeenCalled()
  })

  test('a token rejected on CONNECT ends the session as rejected', () => {
    const onEnded = vi.fn()
    const { result } = renderHook(() =>
      useGameSession(makeSession(), PLAYER, onEnded))

    act(() => lastClient().config.onStompError({
      headers: { message: 'Unknown player token' },
    }))

    expect(onEnded).toHaveBeenCalledExactlyOnceWith({
      reason: 'rejected',
      message: 'Unknown player token',
    })
    expect(lastClient().deactivated).toBe(true)
    expect(result.current.status).toBe('ended')
  })

  test('an ERROR after connecting (left or kicked) ends it with its reason', () => {
    const onEnded = vi.fn()
    const { result } = renderHook(() =>
      useGameSession(makeSession(), PLAYER, onEnded))

    connect()
    act(() => lastClient().config.onStompError({
      headers: { message: 'You were removed from the session by the host' },
    }))
    // The WebSocket closes right after the ERROR frame.
    act(() => lastClient().config.onWebSocketClose())

    expect(onEnded).toHaveBeenCalledExactlyOnceWith({
      reason: 'removed',
      message: 'You were removed from the session by the host',
    })
    expect(lastClient().deactivated).toBe(true)
    expect(result.current.status).toBe('ended')
  })

  test('ignores ERROR frames on a watcher connection', () => {
    const onEnded = vi.fn()
    renderHook(() => useGameSession(makeSession(), null, onEnded))

    act(() => lastClient().config.onStompError({ headers: {} }))

    expect(onEnded).not.toHaveBeenCalled()
  })

  test('stops reconnecting once the session is closed, and says so once', () => {
    const onEnded = vi.fn()
    const { result } = renderHook(() =>
      useGameSession(makeSession(), PLAYER, onEnded))

    connect()
    broadcast(makeSession({ version: 1, state: 'CLOSED', closeReason: 'ABANDONED' }))
    broadcast(makeSession({ version: 2, state: 'CLOSED', closeReason: 'ABANDONED' }))

    expect(lastClient().deactivated).toBe(true)
    expect(onEnded).toHaveBeenCalledExactlyOnceWith({ reason: 'closed' })
    expect(result.current.status).toBe('ended')
  })

  test('leaving ends it at once, and the ERROR that follows is ignored', () => {
    const onEnded = vi.fn()
    const players = [makePlayer({ id: 1 }), makePlayer({ id: 2, name: 'Bob' })]
    const { result } = renderHook(() =>
      useGameSession(makeSession({ players }), PLAYER, onEnded))

    connect()
    act(() => { result.current.actions.leave() })
    act(() => lastClient().config.onStompError({
      headers: { message: 'You left the session' },
    }))

    expect(onEnded).toHaveBeenCalledExactlyOnceWith({ reason: 'left' })
    expect(lastClient().deactivated).toBe(true)
    expect(result.current.status).toBe('ended')
  })

  test('the last player leaving abandons the session', () => {
    const onEnded = vi.fn()
    const players = [
      makePlayer({ id: 1, leaving: true }),
      makePlayer({ id: 2, name: 'Bob' }),
    ]
    const { result } = renderHook(() =>
      useGameSession(makeSession({ players }), PLAYER, onEnded))

    connect()
    act(() => { result.current.actions.leave() })

    expect(onEnded).toHaveBeenCalledExactlyOnceWith({ reason: 'abandoned' })
  })

  test('sends actions to the session, and leave says whether it was sent', () => {
    const { result } = renderHook(() =>
      useGameSession(makeSession(), PLAYER, () => {}))

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

  test("keeps Trebek's private view that goes with the snapshot", () => {
    const { result } = renderHook(() =>
      useGameSession(makeSession({ version: 1 }), PLAYER, () => {}))

    connect()
    const view = (version: number) => ({
      version,
      clue: null,
      pendingAnswer: null,
      finalJeopardy: null,
    })
    const sendView = (version: number) => act(() => {
      lastClient().subscriptions.get('/user/queue/trebek')?.({
        body: JSON.stringify(view(version)),
      })
    })

    // The view can arrive before its snapshot: it waits for it.
    sendView(2)
    expect(result.current.trebekView).toBeNull()

    broadcast(makeSession({ version: 2 }))
    expect(result.current.trebekView?.version).toBe(2)

    // A newer snapshot keeps the last matching view until its own arrives.
    broadcast(makeSession({ version: 3 }))
    expect(result.current.trebekView?.version).toBe(2)
    sendView(3)
    expect(result.current.trebekView?.version).toBe(3)
  })

  test("a watcher doesn't subscribe to Trebek's view", () => {
    renderHook(() => useGameSession(makeSession(), null, () => {}))
    connect()

    expect(lastClient().subscriptions.has('/user/queue/trebek')).toBe(false)
  })

  test("sends Trebek's actions", () => {
    const { result } = renderHook(() =>
      useGameSession(makeSession(), PLAYER, () => {}))

    connect()
    act(() => {
      result.current.actions.advance()
      result.current.actions.rule(true)
      result.current.actions.ruleFinal(3, false)
      result.current.actions.adjustScore(3, -400)
      result.current.actions.updateSettings({ hostMode: 'TREBEK' })
    })

    expect(lastClient().published.map(frame => [frame.destination, frame.body]))
      .toEqual([
        [`/app/sessions/${SESSION_ID}/advance`, ''],
        [`/app/sessions/${SESSION_ID}/rule`, JSON.stringify({ correct: true })],
        [`/app/sessions/${SESSION_ID}/rule-final`, JSON.stringify({ playerId: 3, correct: false })],
        [`/app/sessions/${SESSION_ID}/adjust-score`, JSON.stringify({ playerId: 3, amount: -400 })],
        [`/app/sessions/${SESSION_ID}/update-settings`, JSON.stringify({ hostMode: 'TREBEK' })],
      ])
  })

  test('Trebek leaving during the game ends it as abandoned, at once', () => {
    const onEnded = vi.fn()
    const session = makeSession({
      state: 'CHOOSING_CLUE',
      hostMode: 'TREBEK',
      trebek: { id: 2, name: 'Alex', away: false },
      hostPlayerId: 2,
      players: [makePlayer({ id: 1 }), makePlayer({ id: 3 })],
    })
    const { result } = renderHook(() =>
      useGameSession(session, PLAYER, onEnded))

    connect()
    act(() => { result.current.actions.leave() })

    expect(onEnded).toHaveBeenCalledWith({ reason: 'abandoned' })
  })
})
