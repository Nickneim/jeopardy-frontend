import { Client } from '@stomp/stompjs'
import { useEffect, useRef, useState } from 'react'
import {
  getSession,
  type GameSession,
  type GameSessionError,
} from '../api/sessions'
import { ApiError } from '../api/errors'

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'gone'

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
}

const ERROR_VISIBLE_MS = 5000

function brokerUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws`
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
 */
export function useGameSession(
  initial: GameSession,
  token: string | null,
  onTokenRejected: () => void,
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

    const client = new Client({
      brokerURL: brokerUrl(),
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
              void client.deactivate()
            }
          })
      },

      // The backend only sends ERROR when it rejects the token on CONNECT
      // (e.g. the session was lost in a backend restart).
      onStompError: () => {
        if (token && !connected) {
          void client.deactivate()
          onTokenRejectedRef.current()
        }
      },

      onWebSocketClose: () => {
        connected = false
        setStatus(current => current === 'gone' ? current : 'reconnecting')
      },
    })

    clientRef.current = client
    client.activate()

    return () => {
      clientRef.current = null
      void client.deactivate()
    }
  }, [sessionId, token])

  useEffect(() => () => window.clearTimeout(errorTimerRef.current), [])

  function send(action: string, body?: object) {
    const client = clientRef.current

    if (!client?.connected) {
      showError({
        code: 'INVALID_STATE',
        message: 'Not connected to the game. Reconnecting…',
      })
      return
    }

    client.publish({
      destination: `/app/sessions/${sessionId}/${action}`,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : '',
    })
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
  }

  return { ...snapshot, status, error, actions }
}
