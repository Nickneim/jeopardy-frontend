import { Link } from 'react-router'
import type { SessionStatus } from './sessionStatus'

const ENDING_MS = 3000

interface StatusBarProps {
  // The round's name, or null before the game starts.
  round: string | null
  status: SessionStatus
  durationMs: number | null
  // Time left in the phase (useCountdown), or null without a timer.
  leftMs: number | null
  // Trebek stopped the clock.
  paused?: boolean
}

// Between the main screen and the podiums: a link home, the round, whose
// turn it is and the phase's countdown.
function StatusBar({
  round,
  status,
  durationMs,
  leftMs,
  paused = false,
}: StatusBarProps) {
  const hasTimer = leftMs !== null && Boolean(durationMs)
  const seconds = Math.ceil((leftMs ?? 0) / 1000)

  return (
    <div className="tv-status">
      {/* A new tab, so the game carries on here: leaving it is Leave. */}
      <Link
        to="/"
        target="_blank"
        rel="noopener noreferrer"
        className="tv-home"
        aria-label="Jeopardy! home (opens in a new tab)"
        title="Jeopardy! home (opens in a new tab)"
      >
        J!
      </Link>

      <p className="tv-status-message" role="status">
        {round && <span className="tv-status-round">{round}</span>}
        {status.who && <span className="tv-hand">{status.who}</span>}
        {status.who && ' '}
        <span>{status.message}</span>
      </p>

      {paused && <span className="tv-paused">Paused</span>}

      {hasTimer && (
        <div
          className={[
            'tv-timer',
            !paused && leftMs! <= ENDING_MS && 'is-ending',
            paused && 'is-paused',
          ].filter(Boolean).join(' ')}
          role="timer"
          aria-label={`${seconds} seconds left`}
        >
          <div className="tv-timer-track" aria-hidden="true">
            <div
              className="tv-timer-bar"
              style={{ width: `${(leftMs! / durationMs!) * 100}%` }}
            />
          </div>
          <span className="tv-timer-seconds" aria-hidden="true">
            {seconds}s
          </span>
        </div>
      )}
    </div>
  )
}

export default StatusBar
