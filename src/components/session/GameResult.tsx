import type { FinalJeopardy, Player } from '../../api/sessions'
import { formatMoney } from '../../format'

interface GameResultProps {
  players: Player[]
  // Final Jeopardy's results, to show what it changed for each player.
  final?: FinalJeopardy | null
  myPlayerId?: number | null
}

function ordinal(n: number): string {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13
    ? 'th'
    : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'

  return `${n}${suffix}`
}

function joinNames(names: string[]): string {
  return names.length <= 2
    ? names.join(' & ')
    : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

// The backend has no winner field: the highest final score wins, and tied
// scores share a place.
function GameResult({
  players,
  final = null,
  myPlayerId = null,
}: GameResultProps) {
  if (players.length === 0) {
    return null
  }

  const ranked = [...players].sort((a, b) => b.score - a.score)
  const topScore = ranked[0].score
  const winners = ranked.filter(player => player.score === topScore)

  function finalChange(player: Player): string | null {
    const result = final?.players.find(r => r.playerId === player.id)

    if (!result) {
      return null
    }

    const wager = result.wager ?? 0
    const sign = wager === 0 ? '±' : result.correct ? '+' : '−'

    return `Final ${sign}${formatMoney(wager)}`
  }

  return (
    <section className="game-result">
      <p className="tv-kicker">Final results</p>
      <h2 className="game-result-winner tv-hand">
        {joinNames(winners.map(player => player.name))}
      </h2>
      <p className="game-result-line">
        {winners.length === 1 ? 'Wins with' : 'Tie for first with'}{' '}
        {formatMoney(topScore)}
      </p>

      <ol className="game-result-ranking">
        {ranked.map(player => {
          const rank = 1 + ranked.filter(p => p.score > player.score).length
          const change = finalChange(player)

          return (
            <li key={player.id} className={rank === 1 ? 'is-winner' : undefined}>
              <span className="game-result-rank">{ordinal(rank)}</span>

              <span className="game-result-name tv-hand">
                <span>{player.name}</span>
                {player.id === myPlayerId && <span className="tv-you">You</span>}
                {/* Players who leave once the results are in stay in them. */}
                {player.leaving && <span className="tv-you is-left">Left</span>}
              </span>

              <span
                className={player.score < 0
                  ? 'game-result-score is-negative'
                  : 'game-result-score'}
              >
                {formatMoney(player.score)}
              </span>

              <span className="game-result-final">{change}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default GameResult
