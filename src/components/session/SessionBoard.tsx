import type { BoardCategory } from '../../api/sessions'

interface SessionBoardProps {
  board: BoardCategory[]
  canChoose: boolean
  onChoose: (clueId: number) => void
}

function SessionBoard({
  board,
  canChoose,
  onChoose,
}: SessionBoardProps) {
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

      {Array.from({ length: rows }, (_, row) => board.map((category, column) => {
        const slot = category.slots[row]
        const key = `${row}-${column}`

        if (!slot || slot.status !== 'AVAILABLE' || slot.clueId === null) {
          return <div key={key} className="tv-board-cell" />
        }

        const clueId = slot.clueId

        // TV boards show values without a thousands separator: $1000.
        return (
          <button
            key={key}
            type="button"
            className="tv-board-cell"
            aria-label={`${category.name} for $${slot.value ?? 0}`}
            disabled={!canChoose}
            onClick={() => onChoose(clueId)}
          >
            ${slot.value ?? 0}
          </button>
        )
      }))}
    </div>
  )
}

export default SessionBoard
