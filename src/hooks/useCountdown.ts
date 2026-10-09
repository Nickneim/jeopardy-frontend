import { useEffect, useState } from 'react'

const TICK_MS = 100

/**
 * Time left in the current phase, counting down from the server's
 * `phaseRemainingMs` since the snapshot arrived (`receivedAt`, from
 * performance.now()). Null when the phase has no timer.
 */
export function useCountdown(
  remainingMs: number | null,
  receivedAt: number,
): number | null {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (remainingMs === null) {
      return
    }

    const timer = window.setInterval(
      () => setNow(performance.now()),
      TICK_MS,
    )

    return () => window.clearInterval(timer)
  }, [remainingMs, receivedAt])

  if (remainingMs === null) {
    return null
  }

  // `now` can be older than a snapshot that just arrived.
  const elapsed = Math.max(0, now - receivedAt)

  return Math.max(0, remainingMs - elapsed)
}
