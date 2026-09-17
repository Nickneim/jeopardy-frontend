import type { GameClue } from '../api/games'

interface ClueCellProps {
  clue: GameClue | undefined
  dailyDouble: boolean
  onClick: (clue: GameClue) => void
  value: number
}

function ClueCell({
  clue,
  dailyDouble,
  onClick,
  value
}: ClueCellProps) {
  if (!clue) {
    return <div className="clue-cell clue-cell-empty" />
  }

  return (
    <button
      type="button"
      className="clue-cell"
      onClick={() => onClick(clue)}
    >
      {dailyDouble && <span className="daily-double">Daily Double</span>}

      <span className="clue-value">
        ${value}
      </span>
    </button>
  )
}

export default ClueCell