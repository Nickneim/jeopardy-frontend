import { useCallback, useEffect, useState } from 'react'
import { loadDraft, saveDraft, type Draft } from '../api/customShows'

const MAX_UNDO = 100

interface History {
  past: Draft[]
  present: Draft
  future: Draft[]
  // What the last change was, so typing in one field is a single undo step.
  lastKey: string | null
}

export interface DraftHistory {
  draft: Draft
  // `key` names a change that typing repeats (a field): consecutive changes
  // with the same key are undone together.
  change: (update: (draft: Draft) => Draft, key?: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

// The custom show draft with undo and redo. It's read from storage once and
// saved after every change, so closing the tab loses nothing.
export function useDraftHistory(): DraftHistory {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: loadDraft(),
    future: [],
    lastKey: null,
  }))

  useEffect(() => saveDraft(history.present), [history.present])

  const change = useCallback((update: (draft: Draft) => Draft, key?: string) => {
    setHistory(current => {
      const next = update(current.present)

      if (next === current.present) {
        return current
      }

      // The same field again: replace the step instead of adding one.
      if (key !== undefined && key === current.lastKey) {
        return { ...current, present: next, future: [] }
      }

      return {
        past: [...current.past, current.present].slice(-MAX_UNDO),
        present: next,
        future: [],
        lastKey: key ?? null,
      }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory(current => {
      const previous = current.past.at(-1)

      return previous
        ? {
          past: current.past.slice(0, -1),
          present: previous,
          future: [current.present, ...current.future],
          lastKey: null,
        }
        : current
    })
  }, [])

  const redo = useCallback(() => {
    setHistory(current => {
      const [next, ...future] = current.future

      return next
        ? {
          past: [...current.past, current.present],
          present: next,
          future,
          lastKey: null,
        }
        : current
    })
  }, [])

  return {
    draft: history.present,
    change,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
