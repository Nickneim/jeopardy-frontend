import type { Player } from '../../api/sessions'
import { formatMoney } from '../../format'

interface GameResultProps {
  players: Player[]
}

// The backend has no winner field: the highest final score wins.
function GameResult({
  players,
}: GameResultProps) {
  if (players.length === 0) {
    return null
  }

  const topScore = Math.max(...players.map(player => player.score))
  const winners = players.filter(player => player.score === topScore)
  const names = winners.map(player => player.name).join(' and ')

  return (
    <section className="game-result">
      <h2>Game over</h2>

      <p>
        {winners.length === 1
          ? `${names} wins with ${formatMoney(topScore)}!`
          : `It's a tie between ${names} at ${formatMoney(topScore)}!`}
      </p>
    </section>
  )
}

export default GameResult
