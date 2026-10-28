import { useState } from 'react'
import type { BoardCategory, ClueSlot } from '../../api/sessions'

interface SessionBoardProps {
  board: BoardCategory[]
  canChoose: boolean
  onChoose: (clueId: number) => void
  // On a phone: the categories, then one category's clues.
  compact?: boolean
  // The compact board's category open at first (the clue in play's, for the
  // board behind it), or the category list.
  openColumn?: number | null
}

function SessionBoard({
  board,
  canChoose,
  onChoose,
  compact = false,
  openColumn = null,
}: SessionBoardProps) {
  const [column, setColumn] = useState<number | null>(openColumn)

  function renderSlot(category: BoardCategory, slot: ClueSlot | undefined, key: string) {
    // A played cell keeps its clue's id: a clue grows out of it.
    if (!slot || slot.status !== 'AVAILABLE' || slot.clueId === null) {
      return (
        <div
          key={key}
          className="tv-board-cell"
          data-clue-id={slot?.clueId ?? undefined}
        />
      )
    }

    const clueId = slot.clueId

    // TV boards show values without a thousands separator: $1000.
    return (
      <button
        key={key}
        type="button"
        className="tv-board-cell"
        data-clue-id={clueId}
        aria-label={`${category.name} for $${slot.value ?? 0}`}
        disabled={!canChoose}
        onClick={() => onChoose(clueId)}
      >
        ${slot.value ?? 0}
      </button>
    )
  }

  if (compact) {
    const open = column === null ? null : board[column] ?? null

    return (
      <div className="tv-board-compact">
        <div className="tv-board-compact-heading">
          {open
            ? (
              <>
                <button
                  type="button"
                  className="tv-board-back"
                  onClick={() => setColumn(null)}
                >
                  ‹ Back
                </button>
                <span className="tv-board-compact-title">{open.name}</span>
              </>
            )
            : <span className="tv-board-compact-title">Categories</span>}
        </div>

        {open
          ? (
            <>
              {open.comments && <p className="tv-comments">{open.comments}</p>}
              <div className="tv-board-compact-clues">
                {open.slots.map((slot, row) => renderSlot(open, slot, `${row}`))}
              </div>
            </>
          )
          : (
            <ul className="tv-board-compact-categories">
              {board.map((category, index) => {
                const available = category.slots
                  .filter(slot => slot.status === 'AVAILABLE').length
                const count = available === 1 ? '1 clue' : `${available} clues`

                // Anyone can look, but only the chooser picks.
                return (
                  <li key={index}>
                    <button
                      type="button"
                      className="tv-board-category"
                      disabled={available === 0}
                      aria-label={`${category.name}, ${count} left`}
                      onClick={() => setColumn(index)}
                    >
                      <span>{category.name}</span>
                      <span className="tv-board-count">
                        {count}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
      </div>
    )
  }

  // The server always sends a rectangular grid.
  const rows = board[0]?.slots.length ?? 0

  return (
    <div
      className="tv-board"
      style={{
        gridTemplateColumns: `repeat(${board.length}, minmax(96px, 1fr))`,
        gridTemplateRows: `minmax(110px, auto) repeat(${rows}, minmax(64px, 1fr))`,
      }}
    >
      {board.map((category, column) => (
        <div
          key={`category-${column}`}
          className="tv-board-category"
          title={category.comments ?? undefined}
        >
          {category.name}
          {category.comments && (
            <span className="category-comments-marker" aria-hidden="true">
              {' '}ⓘ
            </span>
          )}
        </div>
      ))}

      {Array.from({ length: rows }, (_, row) => board.map((category, column) =>
        renderSlot(category, category.slots[row], `${row}-${column}`)))}
    </div>
  )
}

export default SessionBoard
