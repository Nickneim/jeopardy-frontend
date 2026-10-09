import { Link, useLoaderData, useRevalidator } from 'react-router'
import {
  forgetPlayer,
  type GameSession,
  type JoinedPlayer,
  type SessionLoaderData,
} from '../api/sessions'
import JoinForm from '../components/session/JoinForm'
import Lobby from '../components/session/Lobby'
import Scoreboard from '../components/session/Scoreboard'
import { useGameSession } from '../hooks/useGameSession'

const STATUS_MESSAGES = {
  connecting: 'Connecting…',
  reconnecting: 'Connection lost. Reconnecting…',
} as const

interface LiveSessionProps {
  initial: GameSession
  player: JoinedPlayer | null
  onTokenRejected: () => void
}

function LiveSession({
  initial,
  player,
  onTokenRejected,
}: LiveSessionProps) {
  const { session, status, error, actions } = useGameSession(
    initial,
    player?.token ?? null,
    onTokenRejected,
  )

  if (status === 'gone') {
    return (
      <main>
        <h1>Game over</h1>
        <p>This game session no longer exists.</p>
        <Link to="/games">Browse games</Link>
      </main>
    )
  }

  const me = session.players.find(p => p.id === player?.playerId) ?? null

  return (
    <main className="live-session">
      <h1>Live game</h1>

      {status !== 'connected' && (
        <p className="connection-status" role="status">
          {STATUS_MESSAGES[status]}
        </p>
      )}

      {error && (
        <p className="session-error" role="alert">{error.message}</p>
      )}

      {me
        ? <p>Playing as <strong>{me.name}</strong></p>
        : <JoinForm />}

      <Scoreboard session={session} myPlayerId={me?.id ?? null} />

      {session.state === 'WAITING_FOR_START' && (
        <Lobby
          playerCount={session.players.length}
          canStart={me !== null}
          onStart={actions.start}
        />
      )}
    </main>
  )
}

function SessionPage() {
  const { session, player } = useLoaderData() as SessionLoaderData
  const revalidator = useRevalidator()

  function handleTokenRejected() {
    forgetPlayer(session.id)
    void revalidator.revalidate()
  }

  // Remount when the player changes (joining, or a rejected token) so the
  // connection restarts with the new token from fresh loader data.
  return (
    <LiveSession
      key={`${session.id}:${player?.token ?? 'watcher'}`}
      initial={session}
      player={player}
      onTokenRejected={handleTokenRejected}
    />
  )
}

export default SessionPage
