import type { BoardCategory } from '../../api/sessions'
import { formatMoney } from '../../format'

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
      className="game-board"
      style={{ gridTemplateColumns: `repeat(${board.length}, minmax(100px, 1fr))` }}
    >
      {board.map((category, column) => (
        <div
          className="category-column"
          key={column}
          style={{ gridTemplateRows: `minmax(70px, auto) repeat(${rows}, 80px)` }}
        >
          <div
            className="category-header"
            title={category.comments ?? undefined}
          >
            {category.name}
            {category.comments && (
              <span className="category-comments-marker" aria-hidden="true">
                {' '}ⓘ
              </span>
            )}
          </div>

          {category.slots.map(slot => {
            if (slot.status !== 'AVAILABLE' || slot.clueId === null) {
              return (
                <div
                  key={slot.row}
                  className="clue-cell clue-cell-empty"
                />
              )
            }

            const clueId = slot.clueId

            return (
              <button
                key={slot.row}
                type="button"
                className="clue-cell"
                disabled={!canChoose}
                onClick={() => onChoose(clueId)}
              >
                <span className="clue-value">
                  {formatMoney(slot.value ?? 0)}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default SessionBoard
