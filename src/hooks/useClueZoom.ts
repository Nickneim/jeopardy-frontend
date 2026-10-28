import { useLayoutEffect, useRef, type RefObject } from 'react'

const ZOOM_MS = 600
const FLIP_MS = 1000
// Once over, rolling forwards: the top comes towards you and goes down.
const FLIP_TURN_DEG = 360

/**
 * Grows the screen out of the picked clue's cell until it covers the board,
 * like the show. A Daily Double's screen (`dailyDouble`, its announcement)
 * flips over itself as it grows, or where it is when the clue was already
 * on screen (picked in a Trebek game). `board` is the board left behind the
 * screen while a clue is in play, with a `data-clue-id` on each cell. Plays
 * when `clueId` comes into play, not for a clue already in play when the
 * page opened.
 */
export function useClueZoom(
  screen: RefObject<HTMLElement | null>,
  board: RefObject<HTMLElement | null>,
  clueId: number | null,
  dailyDouble: boolean,
) {
  const shown = useRef({ clueId, dailyDouble })

  useLayoutEffect(() => {
    const isNewClue = clueId !== shown.current.clueId
    const isNewFlip = dailyDouble && !shown.current.dailyDouble
    shown.current = { clueId, dailyDouble }
    const element = screen.current

    // jsdom has no animations.
    if (clueId === null || !(isNewClue || isNewFlip) || !element ||
      typeof element.animate !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const to = element.getBoundingClientRect()

    if (to.width === 0 || to.height === 0) {
      return
    }

    // From the cell, or from where the screen is.
    const cell = isNewClue
      ? board.current?.querySelector(`[data-clue-id="${clueId}"]`)
      : null
    const from = cell?.getBoundingClientRect() ?? to

    // The same transforms at both ends, so a whole turn isn't flattened
    // into none. The turn is around the screen's middle, after the zoom.
    function frame(x: number, y: number, scaleX: number, scaleY: number, turn: number) {
      return {
        transformOrigin: '0 0',
        transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY}) ` +
          'translate(50%, 50%) perspective(1500px) ' +
          `rotateX(${turn}deg) translate(-50%, -50%)`,
      }
    }

    const animation = element.animate([
      frame(
        from.left - to.left,
        from.top - to.top,
        from.width / to.width,
        from.height / to.height,
        dailyDouble ? FLIP_TURN_DEG : 0,
      ),
      frame(0, 0, 1, 1, 0),
    ], dailyDouble
      // A Daily Double rolls out at a steady pace.
      ? { duration: FLIP_MS, easing: 'linear' }
      : { duration: ZOOM_MS, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' })

    return () => animation.cancel()
  }, [screen, board, clueId, dailyDouble])
}
