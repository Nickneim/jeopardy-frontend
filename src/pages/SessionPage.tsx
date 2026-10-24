import { useEffect, useState } from 'react'
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
} from 'react-router'
import {
  forgetPlayer,
  getStoredPlayer,
  type GameSession,
  type GameSessionState,
  type JoinedPlayer,
  type Player,
  type SessionCloseReason,
  type SessionLoaderData,
} from '../api/sessions'
import CluePanel from '../components/session/CluePanel'
import ConfirmButton from '../components/session/ConfirmButton'
import FinalJeopardyPanel from '../components/session/FinalJeopardyPanel'
import { finalRevealProgress } from '../components/session/revealProgress'
import GameResult from '../components/session/GameResult'
import { JoinIcon, LeaveIcon } from '../components/session/icons'
import JoinChoice from '../components/session/JoinChoice'
import ServerOffline from '../components/ServerOffline'
import Lobby from '../components/session/Lobby'
import { PODIUM_LIGHTS } from '../components/session/Podium'
import PodiumRow from '../components/session/PodiumRow'
import SessionBoard from '../components/session/SessionBoard'
import { sessionStatus } from '../components/session/sessionStatus'
import ShareLinkButton from '../components/session/ShareLinkButton'
import StatusBar from '../components/session/StatusBar'
import { ROUND_NAMES } from '../format'
import { useCountdown } from '../hooks/useCountdown'
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
])

// The lights on a podium count down these phases' time.
const LIT_STATES = new Set<GameSessionState>([
  'WAITING_FOR_DAILY_DOUBLE_WAGER',
  'WAITING_FOR_ANSWER',
])

const NO_SCORES = new Map<number, number>()

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
  joinMode: initialJoinMode,
  onTokenRejected,
}: LiveSessionProps) {
  const { session, receivedAt, status, error, actions } = useGameSession(
    initial,
    player?.token ?? null,
    onTokenRejected,
  )
  const navigate = useNavigate()
  const [joinMode, setJoinMode] = useState<JoinMode>(initialJoinMode)
  const leftMs = useCountdown(session.phaseRemainingMs, receivedAt)

  const isClosed = session.state === 'CLOSED'

  // A closed session's tokens no longer work.
  useEffect(() => {
    if (isClosed) {
      forgetPlayer(session.id)
    }
  }, [isClosed, session.id])

  if (status === 'offline') {
    return <ServerOffline />
  }

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
      <main className="live-session tv-stage">
        <h1 className="visually-hidden">Game over</h1>

        <div className="tv-screen">
          <p className="tv-waiting">
            {CLOSE_MESSAGES[session.closeReason ?? 'FINISHED']}
          </p>

          {session.closeReason === 'FINISHED' && (
            <GameResult players={session.players} myPlayerId={player?.playerId} />
          )}

          <div className="tv-links">
            <Link to="/sessions">See other live games</Link>
          </div>
        </div>
      </main>
    )
  }

  const me = session.players.find(p => p.id === player?.playerId) ?? null
  const isHost = me !== null && session.hostPlayerId === me.id
  const isMyChoice = me !== null && session.playerChoosingClue === me.id
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

  const state = session.state
  const isConnected = status === 'connected'
  const reveal = finalRevealProgress(session, leftMs)
  // From the Final Jeopardy reveal on the game is decided: nobody joins or
  // leaves any more.
  const isOver = state === 'FINAL_JEOPARDY_REVEALING' ||
    state === 'FINISHED_GAME'
  const canJoin = !isOver &&
    (state === 'WAITING_FOR_START' || session.allowLateJoin)
  const lockedOut = session.playersLockedOut
    .filter(id => id !== session.playerAnswering)
  const canBuzz = me !== null && state === 'WAITING_FOR_BUZZER' &&
    !session.playersLockedOut.includes(me.id)

  // Whose podium glows: choosing, answering, wagering or being revealed.
  const activeId = reveal
    ? reveal.order[reveal.index].playerId
    : state === 'WAITING_FOR_ANSWER'
      ? session.playerAnswering
      : state === 'CHOOSING_CLUE' || session.currentClue?.dailyDouble
        ? session.playerChoosingClue
        : null
  const lights = LIT_STATES.has(state) && leftMs !== null &&
    session.phaseDurationMs
    ? Math.ceil((PODIUM_LIGHTS * leftMs) / session.phaseDurationMs)
    : 0

  // Who has wagered or answered in Final Jeopardy is public; what isn't.
  const badges = new Map<number, string>()
  for (const result of session.finalJeopardy?.players ?? []) {
    if (state === 'FINAL_JEOPARDY_WAGERING' && result.hasWagered) {
      badges.set(result.playerId, 'Wagered')
    } else if (state === 'FINAL_JEOPARDY_ANSWERING' && result.hasAnswered) {
      badges.set(result.playerId, 'Answered')
    }
  }

  return (
    <main className="live-session tv-stage">
      <h1 className="visually-hidden">
        {state === 'WAITING_FOR_START' ? 'Live game' : ROUND_NAMES[session.round]}
      </h1>

      {status !== 'connected' && (
        <p className="tv-strip connection-status" role="status">
          {STATUS_MESSAGES[status]}
        </p>
      )}

      {error && (
        <p className="tv-strip session-error" role="alert">{error.message}</p>
      )}

      <div className={state === 'CHOOSING_CLUE' ? 'tv-screen is-board' : 'tv-screen'}>
        {/* Game actions go over the live connection: until it's up, a click
            would be lost, so every control on the screen waits for it. */}
        <fieldset className="tv-screen-content" disabled={!isConnected}>
          {state === 'WAITING_FOR_START' && (
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

          {state === 'CHOOSING_CLUE' && (
            <SessionBoard
              board={session.board}
              canChoose={isMyChoice}
              onChoose={actions.chooseClue}
            />
          )}

          {CLUE_STATES.has(state) && (
            <CluePanel session={session} me={me} actions={actions} />
          )}

          {FINAL_JEOPARDY_STATES.has(state) && (
            <FinalJeopardyPanel
              session={session}
              me={me}
              actions={actions}
              reveal={reveal}
            />
          )}

          {state === 'FINISHED_GAME' && (
            <>
              <GameResult
                players={session.players}
                final={session.finalJeopardy}
                myPlayerId={me?.id}
              />

              <div className="tv-links">
                <Link to="/sessions">Back to live games</Link>
                <Link to="/games">Play another game</Link>
              </div>
            </>
          )}
        </fieldset>

        {!me && canJoin && joinMode !== 'watch' && (
          <div className="tv-overlay">
            <JoinChoice
              canJoin={canJoin}
              joinScore={session.joinScore}
              mode={joinMode}
              onModeChange={setJoinMode}
            />
          </div>
        )}
      </div>

      <StatusBar
        round={state === 'WAITING_FOR_START' ? null : ROUND_NAMES[session.round]}
        status={sessionStatus(session, me)}
        durationMs={session.phaseDurationMs}
        leftMs={leftMs}
      />

      <PodiumRow
        players={session.players}
        me={me}
        activeId={activeId}
        lights={lights}
        lockedOut={lockedOut}
        badges={badges}
        scores={reveal?.scores ?? NO_SCORES}
        isConnected={isConnected}
        canBuzz={canBuzz}
        onBuzz={actions.buzz}
        onKick={isHost ? kick : undefined}
        actions={
          <>
            {/* Spectating is said here, by the buttons, not on the screen. */}
            {!me && !isOver && (!canJoin || joinMode === 'watch') && (
              <div className="podium-actions-note">
                <JoinChoice
                  canJoin={canJoin}
                  joinScore={session.joinScore}
                  mode={joinMode}
                  onModeChange={setJoinMode}
                />
              </div>
            )}

            {!me && canJoin && joinMode === 'watch' && (
              <button
                type="button"
                className="tv-action is-primary"
                onClick={() => setJoinMode('join')}
              >
                <JoinIcon />
                Join as player
              </button>
            )}

            <ShareLinkButton />

            {me && !isOver && (
              <ConfirmButton
                label="Leave"
                content={<><LeaveIcon />Leave</>}
                question={leaveQuestion}
                confirmLabel="Yes, leave"
                className="tv-action"
                disabled={!isConnected}
                onConfirm={leave}
              />
            )}
          </>
        }
      />
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
