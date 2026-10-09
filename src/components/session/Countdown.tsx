import { useCountdown } from '../../hooks/useCountdown'

interface CountdownProps {
  durationMs: number | null
  remainingMs: number | null
  receivedAt: number
}

function Countdown({
  durationMs,
  remainingMs,
  receivedAt,
}: CountdownProps) {
  const left = useCountdown(remainingMs, receivedAt)

  if (left === null || !durationMs) {
    return null
  }

  return (
    <div
      className="countdown"
      role="timer"
      aria-label={`${Math.ceil(left / 1000)} seconds left`}
    >
      <div
        className="countdown-bar"
        style={{ width: `${(left / durationMs) * 100}%` }}
      />
      <span className="countdown-seconds">
        {Math.ceil(left / 1000)}s
      </span>
    </div>
  )
}

export default Countdown
