import type { GameCategory, GameClue } from '../api/games'
import ClueCell from './ClueCell'

interface GameBoardProps {
  categories: GameCategory[]
  dailyDoubleClueIds: number[]
  onClueClick: (clue: GameClue) => void
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

function GameBoard({
  categories,
  dailyDoubleClueIds,
  onClueClick,
}: GameBoardProps) {
  const dailyDoubleIds = new Set(dailyDoubleClueIds)

  return (
    <div className="game-board">
      {categories.map(category => (
        <div className="category-column" key={category.id}>
          <div className="category-header">
            {category.name}
          </div>

          {Array.from({ length: ROWS }, (_, rowIndex) => {
            const clue = category.clues.find(
              clue => clue.rowNumber == rowIndex + 1,
            )

            return (
              <ClueCell
                key={rowIndex}
                clue={clue}
                dailyDouble={clue !== undefined && dailyDoubleIds.has(clue.id)}
                onClick={onClueClick}
                value={getClueValue(category.columnNumber, rowIndex + 1)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default GameBoard