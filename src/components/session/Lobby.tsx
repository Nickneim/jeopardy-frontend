import type { SessionTimers } from '../../api/sessions'
import TimerSettings from './TimerSettings'

interface LobbyProps {
  // The session code, for players to type on the live games page.
  code: string
  isHost: boolean
  hostName: string | null
  timers: SessionTimers
  allowLateJoin: boolean
  onStart: () => void
  onUpdateTimers: (timers: Partial<SessionTimers>) => void
  onUpdateSettings: (settings: { allowLateJoin: boolean }) => void
}

function Lobby({
  code,
  isHost,
  hostName,
  timers,
  allowLateJoin,
  onStart,
  onUpdateTimers,
  onUpdateSettings,
}: LobbyProps) {
  return (
    <section className="lobby">
      <p>
        Invite players with the game code{' '}
        <strong className="session-code">{code}</strong>{' '}
        or the Share link button.
      </p>

      {isHost
        ? (
          <button
            type="button"
            className="primary-button"
            onClick={onStart}
          >
            Start game
          </button>
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

      <TimerSettings
        timers={timers}
        canEdit={isHost}
        onSave={onUpdateTimers}
      />
    </section>
  )
}

export default Lobby
