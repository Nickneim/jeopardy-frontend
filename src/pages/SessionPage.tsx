import { useRef, useState } from 'react'
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
  isJoinable,
  isTrebek,
  leavingClosesSession,
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
import TitleCard from '../components/session/TitleCard'
import Timer from '../components/session/Timer'
import TrebekDesk from '../components/session/TrebekDesk'
import { ROUND_NAMES } from '../format'
import { useClueZoom } from '../hooks/useClueZoom'
import { useCountdown } from '../hooks/useCountdown'
import { useGameSession, type SessionEnd } from '../hooks/useGameSession'
import { PHONE_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { linkedJoinMode, type JoinMode } from '../navigation'

const CLUE_STATES = new Set<GameSessionState>([
  'CLUE_PICKED',
  'REVEALING_DAILY_DOUBLE',
  'WAITING_FOR_DAILY_DOUBLE_WAGER',
  'REVEALING_CLUE',
  'WAITING_FOR_BUZZER',
  'WAITING_FOR_ANSWER',
  'WAITING_FOR_RULING',
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

const CLOSE_MESSAGES: Record<SessionCloseReason, string> = {
  ABANDONED: 'Everyone left, so this game has ended.',
  IDLE: 'This game was closed because it never started.',
  FINISHED: 'This game has ended.',
  TREBEK_LEFT: 'Trebek left, so the game is over.',
}

// The closed session's last broadcast still has these games' scores.
const SCORED_CLOSES = new Set<SessionCloseReason>(['FINISHED', 'TREBEK_LEFT'])

const STATUS_MESSAGES = {
  connecting: 'Connecting…',
  reconnecting: 'Connection lost. Reconnecting…',
} as const

interface LiveSessionProps {
  initial: GameSession
  player: JoinedPlayer | null
  // How someone without a token starts out: choosing, joining or watching.
  joinMode: JoinMode
  onEnded: (ended: SessionEnd) => void
}

function LiveSession({
  initial,
  player,
  joinMode: initialJoinMode,
  onEnded,
}: LiveSessionProps) {
  const {
    session,
    trebekView,
    receivedAt,
    status,
    error,
    actions,
  } = useGameSession(initial, player, onEnded)
  const [joinMode, setJoinMode] = useState<JoinMode>(initialJoinMode)
  const leftMs = useCountdown(
    session.phaseRemainingMs,
    receivedAt,
    session.paused,
  )
  const isPhone = useMediaQuery(PHONE_QUERY)
  const screenRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  useClueZoom(
    screenRef,
    boardRef,
    CLUE_STATES.has(session.state) ? session.currentClue?.clueId ?? null : null,
    session.state === 'REVEALING_DAILY_DOUBLE',
  )

  const isClosed = session.state === 'CLOSED'

  if (status === 'offline') {
    return <ServerOffline />
  }

  if (isClosed) {
    return (
      <main className="live-session tv-stage">
        <h1 className="visually-hidden">Game over</h1>

        <div className="tv-screen">
          <p className="tv-waiting">
            {CLOSE_MESSAGES[session.closeReason ?? 'FINISHED']}
          </p>

          {session.closeReason && SCORED_CLOSES.has(session.closeReason) && (
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
  // Trebek runs the show from outside `players`.
  const amTrebek = isTrebek(session, player?.playerId)
  const isHost = (me !== null || amTrebek) &&
    session.hostPlayerId === player?.playerId
  const isMyChoice = me !== null && session.playerChoosingClue === me.id
  const hostName = session.trebek?.name ?? session.players
    .find(p => p.id === session.hostPlayerId)?.name ?? null

  const isPlaying = session.state !== 'WAITING_FOR_START' &&
    session.state !== 'FINISHED_GAME'
  const leaveQuestion = amTrebek
    ? isPlaying
      ? 'Leaving ends the game for everyone. Leave?'
      : leavingClosesSession(session, player?.playerId)
        ? "Nobody else is here, so leaving closes this game. Leave?"
        : null
    : leavingClosesSession(session, me?.id)
      ? "You're the only player left, so leaving closes this game. Leave?"
      : isPlaying
        ? 'Leave the game? Your score will be lost.'
        : null

  function kick(target: Player) {
    actions.kick(target.id)
  }

  const state = session.state
  const isConnected = status === 'connected'
  const reveal = finalRevealProgress(session)
  // From the Final Jeopardy reveal on the game is decided: players who
  // leave stay in the results, so Leave goes away. Joining closes earlier,
  // once Final Jeopardy's wagering is over.
  const isOver = state === 'FINAL_JEOPARDY_REVEALING' ||
    state === 'FINISHED_GAME'
  const canJoin = isJoinable(session)
  const hasDesk = amTrebek && state !== 'WAITING_FOR_START'
  const lockedOut = session.playersLockedOut
    .filter(id => id !== session.playerAnswering)
  const canBuzz = me !== null && state === 'WAITING_FOR_BUZZER' &&
    !session.playersLockedOut.includes(me.id)

  // Whose podium glows: choosing, answering, wagering or being revealed.
  const activeId = reveal
    ? reveal.order[reveal.index].playerId
    : state === 'WAITING_FOR_ANSWER' || state === 'WAITING_FOR_RULING'
      ? session.playerAnswering
      : state === 'CHOOSING_CLUE' || state === 'CLUE_PICKED' ||
        session.currentClue?.dailyDouble
        ? session.playerChoosingClue
        : null
  const lights = LIT_STATES.has(state) && leftMs !== null &&
    session.phaseDurationMs
    ? Math.ceil((PODIUM_LIGHTS * leftMs) / session.phaseDurationMs)
    : 0

  const hasTimer = leftMs !== null && Boolean(session.phaseDurationMs)
  // The clue in play's category, open on a phone's board behind the clue so
  // the clue grows out of its cell.
  const clueColumn = session.board.findIndex(category => category.slots
    .some(slot => slot.clueId === session.currentClue?.clueId))

  const statusBar = (
    <StatusBar
      round={state === 'WAITING_FOR_START' ? null : ROUND_NAMES[session.round]}
      status={sessionStatus(session, me, amTrebek)}
      durationMs={session.phaseDurationMs}
      // On a phone the timer is on the screen.
      leftMs={isPhone ? null : leftMs}
      paused={session.paused}
      transient={isPhone}
    />
  )

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

      {(status === 'connecting' || status === 'reconnecting') && (
        <p className="tv-strip connection-status" role="status">
          {STATUS_MESSAGES[status]}
        </p>
      )}

      {error && (error.code === 'TOO_LATE'
        ? <p className="tv-strip session-error is-late" role="status">{error.message}</p>
        : <p className="tv-strip session-error" role="alert">{error.message}</p>)}

      <div className={hasDesk ? 'tv-main has-desk' : 'tv-main'}>
        <div className="tv-screen-frame">
          {/* While a clue is in play, the board stays behind the screen that
              grew out of it (useClueZoom). */}
          {CLUE_STATES.has(state) && (
            <div className="tv-screen is-board tv-screen-behind" aria-hidden="true" inert>
              <div ref={boardRef} className="tv-screen-content">
                <SessionBoard
                  board={session.board}
                  canChoose={false}
                  onChoose={() => {}}
                  compact={isPhone}
                  openColumn={clueColumn < 0 ? null : clueColumn}
                />
              </div>
            </div>
          )}

          <div
            ref={screenRef}
            className={state === 'CHOOSING_CLUE' ? 'tv-screen is-board' : 'tv-screen'}
          >
            {/* Game actions go over the live connection: until it's up, a click
                would be lost, so every control on the screen waits for it. The
                fieldset only disables: Chrome doesn't stretch a fieldset's
                content, so the layout is on the div inside. */}
            <fieldset className="tv-screen-controls" disabled={!isConnected}>
              <div className="tv-screen-content">
                {state === 'WAITING_FOR_START' && (
                  <Lobby
                    code={session.id}
                    isHost={isHost}
                    hostName={hostName}
                    hostMode={session.hostMode}
                    playerCount={session.players.length}
                    timers={session.timers}
                    timerModes={session.timerModes}
                    allowLateJoin={session.allowLateJoin}
                    clueTypes={session.clueTypes}
                    onStart={actions.start}
                    onUpdateTimers={actions.updateTimers}
                    onUpdateSettings={actions.updateSettings}
                  />
                )}

                {/* Only the round's name: nothing can be played yet. */}
                {state === 'ROUND_INTRO' && (
                  <TitleCard key={session.round} title={ROUND_NAMES[session.round]} />
                )}

                {state === 'CHOOSING_CLUE' && (
                  <SessionBoard
                    board={session.board}
                    // Trebek can pick for the chooser, a clue they named out loud.
                    canChoose={isMyChoice || amTrebek}
                    onChoose={actions.chooseClue}
                    compact={isPhone}
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
              </div>
            </fieldset>

            {!me && !amTrebek && canJoin && joinMode !== 'watch' && (
              <div className="tv-overlay">
                <JoinChoice
                  canJoin={canJoin}
                  joinScore={session.joinScore}
                  mode={joinMode}
                  onModeChange={setJoinMode}
                />
              </div>
            )}

            {/* On a phone the countdown is at the top of the screen, and the
                status bar over its bottom for a moment after each change. */}
            {isPhone && hasTimer && (
              <Timer
                className="tv-screen-timer"
                durationMs={session.phaseDurationMs!}
                leftMs={leftMs!}
                paused={session.paused}
              />
            )}

            {isPhone && statusBar}
          </div>
        </div>

        {hasDesk && (
          <fieldset className="trebek-desk-frame" disabled={!isConnected}>
            <TrebekDesk session={session} view={trebekView} actions={actions} />
          </fieldset>
        )}
      </div>

      {!isPhone && statusBar}

      <PodiumRow
        players={session.players}
        me={me}
        trebek={session.trebek}
        activeId={activeId}
        lights={lights}
        lockedOut={lockedOut}
        badges={badges}
        leavingLabel={isOver ? 'Left' : 'Leaving'}
        isConnected={isConnected}
        canBuzz={canBuzz}
        onBuzz={actions.buzz}
        onKick={isHost ? kick : undefined}
        compact={isPhone}
        joining={!me && !amTrebek && !isOver &&
          (!canJoin || joinMode === 'watch') && (
          <>
            {/* Spectating is said here, by the buttons, not on the screen. */}
            <div className="podium-actions-note">
              <JoinChoice
                canJoin={canJoin}
                joinScore={session.joinScore}
                mode={joinMode}
                onModeChange={setJoinMode}
              />
            </div>

            {canJoin && (
              <button
                type="button"
                className="tv-action is-primary"
                onClick={() => setJoinMode('join')}
              >
                <JoinIcon />
                Join as player
              </button>
            )}
          </>
        )}
        actions={
          <>
            <ShareLinkButton />

            {/* Trebek can always leave: during the game it ends it. */}
            {((me && !isOver) || amTrebek) && (
              <ConfirmButton
                label="Leave"
                content={<><LeaveIcon /><span className="tv-action-label">Leave</span></>}
                question={leaveQuestion}
                confirmLabel="Yes, leave"
                className="tv-action"
                disabled={!isConnected}
                onConfirm={actions.leave}
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
  const navigate = useNavigate()
  // Why the player's token stopped working, e.g. "You left the session".
  const [notice, setNotice] = useState<string | null>(null)

  // The live connection ended for good, so its token no longer works. Every
  // tab sharing the token gets here: each forgets it (unless another tab
  // already joined again with a new one) and reloads to show what's next.
  function handleEnded(ended: SessionEnd) {
    if (getStoredPlayer(session.id)?.token === player?.token) {
      forgetPlayer(session.id)
    }

    switch (ended.reason) {
      // The page shows the closed session as it is.
      case 'closed':
        return
      // The session closes at once, so there's nothing left to watch.
      case 'abandoned':
        navigate('/sessions')
        return
      case 'left':
        setNotice('You left the game.')
        break
      case 'removed':
        setNotice(ended.message)
        break
      // "Unknown player token" means nothing to the player: just offer to
      // join again.
      case 'rejected':
        setNotice(null)
        break
      // Reloading finds no session, so the error page says the game ended.
      case 'gone':
        break
    }

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
        onEnded={handleEnded}
      />
    </>
  )
}

export default SessionPage
