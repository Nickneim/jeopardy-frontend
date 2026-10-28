const ENDING_MS = 3000
const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface TimerProps {
  durationMs: number
  // Time left in the phase (useCountdown).
  leftMs: number
  // Trebek stopped the clock.
  paused?: boolean
  className?: string
}

// The phase's countdown: a ring that empties around the seconds left.
function Timer({
  durationMs,
  leftMs,
  paused = false,
  className,
}: TimerProps) {
  const seconds = Math.ceil(leftMs / 1000)
  const fraction = Math.min(1, Math.max(0, leftMs / durationMs))

  return (
    <div
      className={[
        'tv-timer',
        !paused && leftMs <= ENDING_MS && 'is-ending',
        paused && 'is-paused',
        className,
      ].filter(Boolean).join(' ')}
      role="timer"
      aria-label={`${seconds} seconds left`}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="tv-timer-track" cx="24" cy="24" r={RADIUS} />
        {/* Starts at the top and empties clockwise. */}
        <circle
          className="tv-timer-ring"
          cx="24"
          cy="24"
          r={RADIUS}
          transform="rotate(-90 24 24)"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <span className="tv-timer-seconds" aria-hidden="true">{seconds}</span>
    </div>
  )
}

export default Timer
