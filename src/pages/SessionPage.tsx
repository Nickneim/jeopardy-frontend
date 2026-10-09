import { Link, useLoaderData, useRevalidator } from 'react-router'
import {
  forgetPlayer,
  type GameRound,
  type GameSession,
  type GameSessionState,
  type JoinedPlayer,
  type SessionLoaderData,
} from '../api/sessions'
import ClueAnswers from '../components/session/ClueAnswers'
import CluePanel from '../components/session/CluePanel'
import Countdown from '../components/session/Countdown'
import FinalJeopardyPanel from '../components/session/FinalJeopardyPanel'
import GameResult from '../components/session/GameResult'
import JoinForm from '../components/session/JoinForm'
import Lobby from '../components/session/Lobby'
import Scoreboard from '../components/session/Scoreboard'
import SessionBoard from '../components/session/SessionBoard'
import { useGameSession } from '../hooks/useGameSession'

const CLUE_STATES = new Set<GameSessionState>([
  'WAITING_FOR_DAILY_DOUBLE_WAGER',
  'REVEALING_CLUE',
  'WAITING_FOR_BUZZER',
  'WAITING_FOR_ANSWER',
  'REVEALING_ANSWER',
])

const FINAL_JEOPARDY_STATES = new Set<GameSessionState>([
  'FINAL_JEOPARDY_WAGERING',
  'FINAL_JEOPARDY_ANSWERING',
  'FINAL_JEOPARDY_REVEALING',
  'FINISHED_GAME',
])

const ROUND_NAMES: Record<GameRound, string> = {
  JEOPARDY: 'Jeopardy!',
  DOUBLE_JEOPARDY: 'Double Jeopardy!',
  FINAL_JEOPARDY: 'Final Jeopardy!',
}

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
  const { session, receivedAt, status, error, actions } = useGameSession(
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
  const isMyChoice = me !== null && session.playerChoosingClue === me.id
  const chooserName = session.players
    .find(p => p.id === session.playerChoosingClue)?.name

  return (
    <main className="live-session">
      <h1>
        {session.state === 'WAITING_FOR_START'
          ? 'Live game'
          : ROUND_NAMES[session.round]}
      </h1>

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

      <Countdown
        durationMs={session.phaseDurationMs}
        remainingMs={session.phaseRemainingMs}
        receivedAt={receivedAt}
      />

      {session.state === 'WAITING_FOR_START' && (
        <Lobby
          playerCount={session.players.length}
          canStart={me !== null}
          onStart={actions.start}
        />
      )}

      {session.state === 'CHOOSING_CLUE' && (
        <>
          <ClueAnswers
            answers={session.clueAnswers}
            players={session.players}
          />

          <p>
            {isMyChoice
              ? 'Your turn: choose a clue.'
              : `${chooserName ?? 'Someone'} is choosing a clue…`}
          </p>

          <SessionBoard
            board={session.board}
            canChoose={isMyChoice}
            onChoose={actions.chooseClue}
          />
        </>
      )}

      {CLUE_STATES.has(session.state) && (
        <CluePanel session={session} me={me} actions={actions} />
      )}

      {session.state === 'FINISHED_GAME' && (
        <GameResult players={session.players} />
      )}

      {FINAL_JEOPARDY_STATES.has(session.state) && (
        <FinalJeopardyPanel session={session} me={me} actions={actions} />
      )}

      {session.state === 'FINISHED_GAME' && (
        <Link to="/games">Play another game</Link>
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
