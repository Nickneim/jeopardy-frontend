import type {
  ClueTypeSetting,
  HostMode,
  SessionTimerModes,
  SessionTimers,
  UpdateSettingsRequest,
} from '../../api/sessions'
import ClueTypeSettings from './ClueTypeSettings'
import TimerSettings from './TimerSettings'

const HOST_MODES: { mode: HostMode, kicker: string, title: string, about: string }[] = [
  {
    mode: 'CONTESTANT',
    kicker: 'Classic',
    title: 'Play along',
    about: "You're a contestant. The board runs itself: every timer is automatic and answers are checked for you.",
  },
  {
    mode: 'TREBEK',
    kicker: 'Host the show',
    title: 'Be Trebek',
    about: "You run it and don't play. You show each clue, open the buzzers, rule on every answer and can change any score.",
  },
]

interface LobbyProps {
  // The session code, for players to type on the live games page.
  code: string
  isHost: boolean
  hostName: string | null
  hostMode: HostMode
  // Players besides Trebek: a Trebek game needs one to start.
  playerCount: number
  timers: SessionTimers
  timerModes: SessionTimerModes
  allowLateJoin: boolean
  clueTypes: ClueTypeSetting[]
  onStart: () => void
  onUpdateTimers: (timers: Partial<SessionTimers>) => void
  onUpdateSettings: (settings: UpdateSettingsRequest) => void
}

function Lobby({
  code,
  isHost,
  hostName,
  hostMode,
  playerCount,
  timers,
  timerModes,
  allowLateJoin,
  clueTypes,
  onStart,
  onUpdateTimers,
  onUpdateSettings,
}: LobbyProps) {
  const isTrebekGame = hostMode === 'TREBEK'
  const nobodyPlays = isTrebekGame && playerCount === 0

  return (
    <section className="lobby">
      <p>
        Invite players with the game code{' '}
        <strong className="session-code">{code}</strong>{' '}
        or the Share link button.
      </p>

      {isHost && (
        <fieldset className="host-modes">
          <legend>How will you host?</legend>

          {HOST_MODES.map(({ mode, kicker, title, about }) => (
            <label
              key={mode}
              className={mode === hostMode ? 'host-mode is-selected' : 'host-mode'}
            >
              <input
                type="radio"
                name="hostMode"
                value={mode}
                checked={mode === hostMode}
                onChange={() => onUpdateSettings({ hostMode: mode })}
              />
              <span className="tv-kicker">{kicker}</span>
              <strong>{title}</strong>
              <span className="host-mode-about">{about}</span>
            </label>
          ))}
        </fieldset>
      )}

      {!isHost && isTrebekGame && hostName && (
        <p>
          <span className="tv-hand host-name">{hostName}</span>{' '}
          is hosting as Trebek: they show each clue and rule on every answer.
        </p>
      )}

      {isHost
        ? (
          <>
            <button
              type="button"
              className="primary-button"
              disabled={nobodyPlays}
              onClick={onStart}
            >
              Start game
            </button>

            {nobodyPlays && (
              <p className="lobby-note">
                As Trebek you don't play: wait for at least one player.
              </p>
            )}
          </>
        )
        : (
          <p>
            {hostName
              ? `Waiting for ${hostName} to start the game…`
              : 'Waiting for a player to join…'}
          </p>
        )}

      {isHost
        ? (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allowLateJoin}
              onChange={event => onUpdateSettings({
                allowLateJoin: event.target.checked,
              })}
            />
            Let players join after the game starts
          </label>
        )
        : (
          <p>
            {allowLateJoin
              ? 'Players can join after the game starts.'
              : 'Nobody can join after the game starts.'}
          </p>
        )}

      <ClueTypeSettings
        clueTypes={clueTypes}
        canEdit={isHost}
        onSave={disabledClueTypes => onUpdateSettings({ disabledClueTypes })}
      />

      <TimerSettings
        timers={timers}
        modes={isTrebekGame ? timerModes : null}
        canEdit={isHost}
        onSave={onUpdateTimers}
        onSaveModes={timerModes => onUpdateSettings({ timerModes })}
      />
    </section>
  )
}

export default Lobby
