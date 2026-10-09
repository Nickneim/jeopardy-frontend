import type { GameSession } from '../../api/sessions'
import { formatMoney } from '../../format'

interface ScoreboardProps {
  session: GameSession
  myPlayerId: number | null
}

function Scoreboard({
  session,
  myPlayerId,
}: ScoreboardProps) {
  const lockedOut = new Set(session.playersLockedOut)

  if (session.players.length === 0) {
    return <p>No players yet.</p>
  }

  return (
    <ol className="scoreboard">
      {session.players.map(player => {
        const isChoosing = session.state === 'CHOOSING_CLUE' &&
          player.id === session.playerChoosingClue
        const isAnswering = player.id === session.playerAnswering

        const classNames = [
          'scoreboard-player',
          isChoosing && 'is-choosing',
          isAnswering && 'is-answering',
          lockedOut.has(player.id) && 'is-locked-out',
        ].filter(Boolean).join(' ')

        return (
          <li key={player.id} className={classNames}>
            <span className="scoreboard-name">
              {player.name}
              {player.id === myPlayerId && ' (you)'}
            </span>

            <span
              className={player.score < 0
                ? 'scoreboard-score negative'
                : 'scoreboard-score'}
            >
              {formatMoney(player.score)}
            </span>

            <span className="scoreboard-status">
              {isChoosing && 'Choosing'}
              {isAnswering && 'Answering'}
              {lockedOut.has(player.id) && !isAnswering && 'Buzzed'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default Scoreboard
