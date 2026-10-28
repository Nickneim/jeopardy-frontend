import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { SessionStatus } from './sessionStatus'
import Timer from './Timer'

// How long a transient status bar stays after a change.
const SHOWN_MS = 3500

interface StatusBarProps {
  // The round's name, or null before the game starts.
  round: string | null
  status: SessionStatus
  durationMs: number | null
  // Time left in the phase (useCountdown), or null without a timer (or when
  // it's shown elsewhere).
  leftMs: number | null
  // Trebek stopped the clock.
  paused?: boolean
  // On a phone: over the bottom of the screen, only for a moment after
  // something changes.
  transient?: boolean
}

// Between the main screen and the podiums: a link home, the round, whose
// turn it is and the phase's countdown.
function StatusBar({
  round,
  status,
  durationMs,
  leftMs,
  paused = false,
  transient = false,
}: StatusBarProps) {
  const said = [round, status.who, status.message, paused].join('|')
  // What was said when the bar last went away.
  const [hiddenAt, setHiddenAt] = useState<string | null>(null)

  useEffect(() => {
    if (!transient) {
      return
    }

    const timer = window.setTimeout(() => setHiddenAt(said), SHOWN_MS)

    return () => window.clearTimeout(timer)
  }, [transient, said])

  const classNames = [
    'tv-status',
    transient && 'is-transient',
    transient && hiddenAt === said && 'is-hidden',
  ].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      {/* A new tab, so the game carries on here: leaving it is Leave. */}
      {!transient && (
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
      )}

      <p className="tv-status-message" role="status">
        {round && <span className="tv-status-round">{round}</span>}
        {status.who && <span className="tv-hand">{status.who}</span>}
        {status.who && ' '}
        <span>{status.message}</span>
      </p>

      {paused && <span className="tv-paused">Paused</span>}

      {leftMs !== null && Boolean(durationMs) && (
        <Timer durationMs={durationMs!} leftMs={leftMs} paused={paused} />
      )}
    </div>
  )
}

export default StatusBar
