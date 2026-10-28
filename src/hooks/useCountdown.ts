import { useEffect, useState } from 'react'

const TICK_MS = 100

/**
 * Time left in the current phase, counting down from the server's
 * `phaseRemainingMs` since the snapshot arrived (`receivedAt`, from
 * performance.now()). Null when the phase has no timer. While `paused`
 * (Trebek stopped the clock) it stays where it stopped.
 */
export function useCountdown(
  remainingMs: number | null,
  receivedAt: number,
  paused = false,
): number | null {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (remainingMs === null || paused) {
      return
    }

    const timer = window.setInterval(
      () => setNow(performance.now()),
      TICK_MS,
    )

    return () => window.clearInterval(timer)
  }, [remainingMs, receivedAt, paused])

  if (remainingMs === null || paused) {
    return remainingMs
  }

  // `now` can be older than a snapshot that just arrived.
  const elapsed = Math.max(0, now - receivedAt)

  return Math.max(0, remainingMs - elapsed)
}
