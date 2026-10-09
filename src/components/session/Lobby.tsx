import { useState } from 'react'
import type { SessionTimers } from '../../api/sessions'
import TimerSettings from './TimerSettings'

interface LobbyProps {
  isHost: boolean
  hostName: string | null
  timers: SessionTimers
  allowLateJoin: boolean
  onStart: () => void
  onUpdateTimers: (timers: SessionTimers) => void
  onUpdateSettings: (settings: { allowLateJoin: boolean }) => void
}

function Lobby({
  isHost,
  hostName,
  timers,
  allowLateJoin,
  onStart,
  onUpdateTimers,
  onUpdateSettings,
}: LobbyProps) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="lobby">
      <p>
        Invite players by sharing this page's link.{' '}
        <button type="button" onClick={copyLink}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
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
