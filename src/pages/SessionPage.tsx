import { useEffect, useState } from 'react'
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
} from 'react-router'
import {
  clueAnswersRound,
  forgetPlayer,
  getStoredPlayer,
  type GameSession,
  type GameSessionState,
  type JoinedPlayer,
  type Player,
  type SessionCloseReason,
  type SessionLoaderData,
} from '../api/sessions'
import ClueAnswers from '../components/session/ClueAnswers'
import CluePanel from '../components/session/CluePanel'
import ConfirmButton from '../components/session/ConfirmButton'
import Countdown from '../components/session/Countdown'
import FinalJeopardyPanel from '../components/session/FinalJeopardyPanel'
import GameResult from '../components/session/GameResult'
import JoinChoice from '../components/session/JoinChoice'
import Lobby from '../components/session/Lobby'
import Scoreboard from '../components/session/Scoreboard'
import SessionBoard from '../components/session/SessionBoard'
import { ROUND_NAMES } from '../format'
import { useGameSession } from '../hooks/useGameSession'
import { linkedJoinMode, type JoinMode } from '../navigation'

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

const CLOSE_MESSAGES: Record<SessionCloseReason, string> = {
  ABANDONED: 'Everyone left, so this game has ended.',
  IDLE: 'This game was closed because it never started.',
  FINISHED: 'This game has ended.',
}

const STATUS_MESSAGES = {
  connecting: 'Connecting…',
  reconnecting: 'Connection lost. Reconnecting…',
} as const

interface LiveSessionProps {
  initial: GameSession
  player: JoinedPlayer | null
  // How someone without a token starts out: choosing, joining or watching.
  joinMode: JoinMode
  onTokenRejected: (reason: string | null) => void
}

function LiveSession({
  initial,
  player,
  joinMode,
  onTokenRejected,
}: LiveSessionProps) {
  const { session, receivedAt, status, error, actions } = useGameSession(
    initial,
    player?.token ?? null,
    onTokenRejected,
  )
  const navigate = useNavigate()

  const isClosed = session.state === 'CLOSED'

  // A closed session's tokens no longer work.
  useEffect(() => {
    if (isClosed) {
      forgetPlayer(session.id)
    }
  }, [isClosed, session.id])

  if (status === 'gone') {
    return (
      <main>
        <h1>Game over</h1>
        <p>This game session no longer exists.</p>
        <Link to="/games">Browse games</Link>
      </main>
    )
  }

  if (isClosed) {
    return (
      <main className="live-session">
        <h1>Game over</h1>
        <p>{CLOSE_MESSAGES[session.closeReason ?? 'FINISHED']}</p>

        {session.closeReason === 'FINISHED' && (
          <GameResult players={session.players} />
        )}

        <Scoreboard session={session} myPlayerId={null} />

        <Link to="/sessions">See other live games</Link>
      </main>
    )
  }

  const me = session.players.find(p => p.id === player?.playerId) ?? null
  const isHost = me !== null && session.hostPlayerId === me.id
  const isMyChoice = me !== null && session.playerChoosingClue === me.id
  const chooserName = session.players
    .find(p => p.id === session.playerChoosingClue)?.name
  const hostName = session.players
    .find(p => p.id === session.hostPlayerId)?.name ?? null

  const isLastPlayer = !session.players
    .some(p => p.id !== me?.id && !p.leaving)
  const isPlaying = session.state !== 'WAITING_FOR_START' &&
    session.state !== 'FINISHED_GAME'
  const leaveQuestion = isLastPlayer
    ? "You're the only player left, so leaving closes this game. Leave?"
    : isPlaying
      ? 'Leave the game? Your score will be lost.'
      : null

  function leave() {
    if (!actions.leave()) {
      return
    }

    // The session closes at once, so there's nothing left to watch.
    if (isLastPlayer) {
      forgetPlayer(session.id)
      navigate('/sessions')
      return
    }

    // No need to wait for the server's ERROR frame to say so.
    onTokenRejected('You left the game.')
  }

  function kick(target: Player) {
    actions.kick(target.id)
  }

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
        ? (
          <p>
            Playing as <strong>{me.name}</strong>
            {isHost && ' (host)'}{' '}
            <ConfirmButton
              label="Leave game"
              question={leaveQuestion}
              confirmLabel="Yes, leave"
              onConfirm={leave}
            />
          </p>
        )
        : (
          <JoinChoice
            canJoin={session.state === 'WAITING_FOR_START' ||
              session.allowLateJoin}
            joinScore={session.joinScore}
            defaultMode={joinMode}
          />
        )}

      <Scoreboard
        session={session}
        myPlayerId={me?.id ?? null}
        onKick={isHost ? kick : undefined}
      />

      <Countdown
        durationMs={session.phaseDurationMs}
        remainingMs={session.phaseRemainingMs}
        receivedAt={receivedAt}
      />

      {session.state === 'WAITING_FOR_START' && (
        <Lobby
          code={session.id}
          isHost={isHost}
          hostName={hostName}
          timers={session.timers}
          allowLateJoin={session.allowLateJoin}
          onStart={actions.start}
          onUpdateTimers={actions.updateTimers}
          onUpdateSettings={actions.updateSettings}
        />
      )}

      {session.state === 'CHOOSING_CLUE' && (
        <>
          <ClueAnswers
            answers={session.clueAnswers}
            players={session.players}
            round={clueAnswersRound(session)}
            me={me}
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
  const location = useLocation()
  // Why the player's token stopped working, e.g. "You left the session".
  const [notice, setNotice] = useState<string | null>(null)

  function handleTokenRejected(reason: string | null) {
    // Already handled: e.g. after a leave, the old connection's reconnect is
    // rejected too, and mustn't replace the notice with nothing.
    if (!getStoredPlayer(session.id)) {
      return
    }

    forgetPlayer(session.id)
    setNotice(reason)
    void revalidator.revalidate()
  }

  // Someone who just left or was kicked stays on as a spectator. Nobody has
  // joined a brand new session yet, so whoever opens it (normally the host,
  // right after creating it) most likely wants to play.
  const joinMode: JoinMode = notice
    ? 'watch'
    : linkedJoinMode(location.state) ??
      (session.players.length === 0 ? 'join' : 'choose')

  // Remount when the player changes (joining, leaving, a kick or a rejected
  // token) so the connection restarts with the new token from fresh loader
  // data.
  return (
    <>
      {notice && !player && (
        <p className="session-notice" role="status">{notice}</p>
      )}

        <LiveSession
        key={`${session.id}:${player?.token ?? 'watcher'}`}
        initial={session}
        player={player}
        joinMode={joinMode}
        onTokenRejected={handleTokenRejected}
      />
    </>
  )
}

export default SessionPage
