import type { GameCategory, GameClue } from '../api/games'
import { formatCorrectResponse } from '../format'
import ClueMedia from './ClueMedia'
import ClueQuestion from './ClueQuestion'

interface GameBoardProps {
  categories: GameCategory[]
  dailyDoubleClueIds: number[]
  // Whether a clue shows its correct response instead of the clue.
  isFlipped: (clueId: number) => boolean
  onFlip: (clueId: number) => void
}

const ROWS = 5

function getClueValue(columnNumber: number, rowNumber: number): number {
  if (columnNumber <= 6) {
    return rowNumber * 200
  }

  if (columnNumber <= 12) {
    return rowNumber * 400
  }

  return 2000
}

// One round's board for browsing, styled like the live game's: every clue
// is shown, and clicking one flips it to its correct response and back.
function GameBoard({
  categories,
  dailyDoubleClueIds,
  isFlipped,
  onFlip,
}: GameBoardProps) {
  const dailyDoubleIds = new Set(dailyDoubleClueIds)

  return (
    <div className="board-scroll">
      <div
        className="browse-board"
        style={{
          gridTemplateColumns: `repeat(${categories.length}, minmax(150px, 1fr))`,
        }}
      >
        {categories.map(category => (
          <CategoryHeader key={category.id} category={category} />
        ))}

        {/* Rows can have gaps, so there are always 5. */}
        {Array.from({ length: ROWS }, (_, row) => categories.map(category => {
          const rowNumber = row + 1
          const clue = category.clues.find(clue => clue.rowNumber === rowNumber)

          return (
            <ClueCard
              key={`${category.id}-${rowNumber}`}
              clue={clue}
              label={`$${getClueValue(category.columnNumber, rowNumber)}`}
              dailyDouble={clue !== undefined && dailyDoubleIds.has(clue.id)}
              flipped={clue !== undefined && isFlipped(clue.id)}
              onFlip={onFlip}
            />
          )
        }))}
      </div>
    </div>
  )
}

export function CategoryHeader({ category }: { category: GameCategory }) {
  return (
    <div className="board-category" title={category.comments ?? undefined}>
      {category.name}
      {category.comments && (
        <span className="category-comments-marker" aria-hidden="true">
          {' '}ⓘ
        </span>
      )}
    </div>
  )
}

interface ClueCardProps {
  // None when the archive doesn't have it (it wasn't revealed on the show).
  clue: GameClue | undefined
  // The clue's value, or what stands for it (Final Jeopardy's category).
  label: string
  dailyDouble: boolean
  flipped: boolean
  onFlip: (clueId: number) => void
  className?: string
}

export function ClueCard({
  clue,
  label,
  dailyDouble,
  flipped,
  onFlip,
  className = '',
}: ClueCardProps) {
  if (!clue) {
    return (
      <div className={`board-cell is-missing ${className}`}>
        <span className="board-value">{label}</span>
        <span className="board-missing">Clue not available</span>
        <span className="board-missing-note">Not revealed on the show</span>
      </div>
    )
  }

  return (
    <div className={`board-cell ${flipped ? 'is-flipped' : ''} ${className}`}>
      <button
        type="button"
        className="board-clue"
        aria-pressed={flipped}
        onClick={() => onFlip(clue.id)}
      >
        <span className="board-value">{label}</span>
        {dailyDouble && <span className="board-daily-double">Daily Double</span>}

        {flipped
          ? (
            <>
              <span className="board-response-label">Correct response</span>
              <span className="board-response">
                {formatCorrectResponse(clue.answer)}
              </span>
            </>
          )
          : (
            <span className="board-question">
              <ClueQuestion html={clue.question} />
            </span>
          )}
      </button>

      {/* Outside the button: players have their own controls. */}
      {!flipped && (
        <div className="board-media">
          <ClueMedia clueType={clue.clueType} mediaUrl={clue.mediaUrl} />
        </div>
      )}
    </div>
  )
}

export default GameBoard
