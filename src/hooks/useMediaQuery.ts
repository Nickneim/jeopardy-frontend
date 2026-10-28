import { useSyncExternalStore } from 'react'

// Phones get simpler layouts: a live game's category list instead of the
// whole board, a custom show's import one step at a time.
export const PHONE_QUERY = '(max-width: 640px)'

/**
 * Whether the media query matches, following it as it changes. False where
 * there's no matchMedia (jsdom).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      if (typeof window.matchMedia !== 'function') {
        return () => {}
      }

      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)

      return () => list.removeEventListener('change', onChange)
    },
    () => typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
  )
}
