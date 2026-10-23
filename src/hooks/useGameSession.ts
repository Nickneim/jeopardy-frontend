import { Client } from '@stomp/stompjs'
import { useEffect, useRef, useState } from 'react'
import {
  getSession,
  type GameSession,
  type GameSessionError,
  type SessionTimers,
} from '../api/sessions'
import { ApiError, isServerOffline } from '../api/errors'

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'gone'
  // Neither the WebSocket nor the REST API can be reached.
  | 'offline'

export interface SessionSnapshot {
  session: GameSession
  // performance.now() when the snapshot arrived, to count down phaseRemainingMs.
  receivedAt: number
}

export interface SessionActions {
  start: () => void
  chooseClue: (clueId: number) => void
  buzz: () => void
  answer: (answer: string) => void
  placeDailyDoubleWager: (wager: number) => void
  placeFinalJeopardyWager: (wager: number) => void
  answerFinalJeopardy: (answer: string) => void
  updateTimers: (timers: Partial<SessionTimers>) => void
  updateSettings: (settings: { allowLateJoin: boolean }) => void
  kick: (playerId: number) => void
  // False if it couldn't be sent (not connected).
  leave: () => boolean
}

const ERROR_VISIBLE_MS = 5000

// The session in the URL routes the connection to the backend instance that
// holds it, so a connection is only ever used for that one session.
function brokerUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws?session=${encodeURIComponent(sessionId)}`
}

/**
 * Keeps a live, up-to-date copy of a game session over STOMP.
 *
 * The server sends full snapshots, so the latest one (highest `version`)
 * is the whole state. After every (re)connect the hook also fetches the
 * state over REST, to catch up on anything missed while disconnected.
 *
 * `initial` is only read on mount: remount (with a `key`) to start over
 * from new loader data, e.g. when the token changes.
 *
 * `onTokenRejected` gets the server's reason when the player was connected
 * and then left or was kicked, and `null` when the token was rejected on
 * CONNECT (e.g. the session was lost in a backend restart).
 *
 * When the WebSocket can't connect, the hook asks the REST API for the
 * session: if that can't be reached either, the server is switched off, so
 * it stops reconnecting and reports `offline`.
 */
export function useGameSession(
  initial: GameSession,
  token: string | null,
  onTokenRejected: (reason: string | null) => void,
) {
  const sessionId = initial.id

  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => ({
    session: initial,
    receivedAt: performance.now(),
  }))
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<GameSessionError | null>(null)

  const clientRef = useRef<Client | null>(null)
  const onTokenRejectedRef = useRef(onTokenRejected)
  const errorTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    onTokenRejectedRef.current = onTokenRejected
  })

  function accept(next: GameSession) {
    setSnapshot(current =>
      next.version > current.session.version
        ? { session: next, receivedAt: performance.now() }
        : current,
    )
  }

  function showError(next: GameSessionError) {
    setError(next)
    window.clearTimeout(errorTimerRef.current)
    errorTimerRef.current = window.setTimeout(
      () => setError(null),
      ERROR_VISIBLE_MS,
    )
  }

  useEffect(() => {
    let connected = false
    // Set once the client is shut down here, so it isn't checked on anymore.
    let stopped = false
    let checkingServer = false

    function stop() {
      stopped = true
      void client.deactivate()
    }

    // The WebSocket failed to connect: tell a stopped server from a
    // connection problem.
    function checkServer() {
      if (checkingServer) {
        return
      }

      checkingServer = true
      getSession(sessionId)
        .then(accept)
        .catch(fetchError => {
          if (stopped) {
            return
          }

          if (isServerOffline(fetchError)) {
            stop()
            setStatus('offline')
          } else if (fetchError instanceof ApiError && fetchError.status === 404) {
            stop()
            setStatus('gone')
          }
        })
        .finally(() => { checkingServer = false })
    }

    const client = new Client({
      brokerURL: brokerUrl(sessionId),
      connectHeaders: token ? { 'player-token': token } : {},
      reconnectDelay: 2000,

      onConnect: () => {
        connected = true
        setStatus('connected')

        // Subscribe before fetching, so no broadcast falls in between.
        client.subscribe(`/topic/sessions/${sessionId}`, frame => {
          accept(JSON.parse(frame.body) as GameSession)
        })

        if (token) {
          client.subscribe('/user/queue/errors', frame => {
            showError(JSON.parse(frame.body) as GameSessionError)
          })
        }

        getSession(sessionId)
          .then(accept)
          .catch(fetchError => {
            if (fetchError instanceof ApiError && fetchError.status === 404) {
              setStatus('gone')
              stop()
            }
          })
      },

      // The backend only sends ERROR when the token stops working: it
      // rejects it on CONNECT, or closes the connection after a leave or kick.
      onStompError: frame => {
        if (token) {
          stop()
          onTokenRejectedRef.current(
            connected ? frame.headers.message ?? null : null,
          )
        }
      },

      onWebSocketClose: () => {
        const wasConnected = connected
        connected = false

        if (stopped) {
          return
        }

        setStatus('reconnecting')

        if (!wasConnected) {
          checkServer()
        }
      },
    })

    clientRef.current = client
    client.activate()

    return () => {
      clientRef.current = null
      stop()
    }
  }, [sessionId, token])

  // A closed session sends nothing more, and would reject a reconnect.
  const isClosed = snapshot.session.state === 'CLOSED'

  useEffect(() => {
    if (isClosed) {
      void clientRef.current?.deactivate()
    }
  }, [isClosed])

  useEffect(() => () => window.clearTimeout(errorTimerRef.current), [])

  function send(action: string, body?: object): boolean {
    const client = clientRef.current

    if (!client?.connected) {
      showError({
        code: 'INVALID_STATE',
        message: 'Not connected to the game. Reconnecting…',
      })
      return false
    }

    client.publish({
      destination: `/app/sessions/${sessionId}/${action}`,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : '',
    })
    return true
  }

  const actions: SessionActions = {
    start: () => send('start'),
    chooseClue: clueId => send('choose-clue', { clueId }),
    buzz: () => send('buzz'),
    answer: answer => send('answer', { answer }),
    placeDailyDoubleWager: wager =>
      send('place-daily-double-wager', { wager }),
    placeFinalJeopardyWager: wager =>
      send('place-final-jeopardy-wager', { wager }),
    answerFinalJeopardy: answer =>
      send('answer-final-jeopardy', { answer }),
    updateTimers: timers => send('update-timers', timers),
    updateSettings: settings => send('update-settings', settings),
    kick: playerId => send('kick', { playerId }),
    leave: () => send('leave'),
  }

  return { ...snapshot, status, error, actions }
}
