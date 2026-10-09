import type { GameSession, Player } from '../../api/sessions'
import { formatMoney } from '../../format'

interface ScoreboardProps {
  session: GameSession
  myPlayerId: number | null
  // Only given to the host, who can kick everyone else.
  onKick?: (player: Player) => void
}

function Scoreboard({
  session,
  myPlayerId,
  onKick,
}: ScoreboardProps) {
  const lockedOut = new Set(session.playersLockedOut)
  // Nobody is leaving a session that's already closed.
  const isClosed = session.state === 'CLOSED'

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
          player.leaving && !isClosed && 'is-leaving',
        ].filter(Boolean).join(' ')

        const canKick = onKick !== undefined &&
          player.id !== myPlayerId &&
          !player.leaving

        return (
          <li key={player.id} className={classNames}>
            <span className="scoreboard-name">
              {player.name}
              {player.id === myPlayerId && ' (you)'}
              {player.id === session.hostPlayerId && ' (host)'}
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
              {player.leaving && !isClosed && ' Leaving'}
            </span>

            {canKick && (
              <button
                type="button"
                className="kick-button"
                onClick={() => onKick?.(player)}
              >
                Kick
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default Scoreboard
