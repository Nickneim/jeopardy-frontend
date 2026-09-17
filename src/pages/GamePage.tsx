import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/errors'
import {
  getGame,
  type Game,
  type GameClue,
} from '../api/games'
import GameBoard from '../components/GameBoard'
import ClueModal from '../components/ClueModal'

function GamePage() {
  const { id } = useParams()

  const [game, setGame] = useState<Game | null>(null)
  const [selectedClue, setSelectedClue] = useState<GameClue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('Game ID is missing')
      setLoading(false)
      return
    }

    const gameId = Number(id)

    if (!Number.isInteger(gameId) || gameId <= 0) {
      setError('Invalid game ID')
      setLoading(false)
      return
    }

    getGame(gameId)
      .then(setGame)
      .catch(error => {
        if (error instanceof ApiError) {
          setError(error.message)
        } else {
          setError('An unexpected error occurred')
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <p>Loading game...</p>
  }

  if (error) {
    return (
      <main>
        <p>Error loading game: {error}</p>
        <Link to="/games">Back to games</Link>
      </main>
    )
  }

  if (!game) {
    return null
  }

  return (
    <main>
      <Link to="/games">← Back to games</Link>

      <h1>{game.title}</h1>

      <p>
        Season {game.season} — {game.gameDate}
      </p>

      <h2>Jeopardy!</h2>

      <GameBoard
        categories={game.jeopardyRound}
        dailyDoubleClueIds={game.dailyDoubleClueIds}
        onClueClick={setSelectedClue}
      />

      <h2>Double Jeopardy!</h2>

      <GameBoard
        categories={game.doubleJeopardyRound}
        dailyDoubleClueIds={game.dailyDoubleClueIds}
        onClueClick={setSelectedClue}
      />

      {game.finalJeopardy && (
        <>
          <h2>Final Jeopardy!</h2>

          <GameBoard
            categories={[game.finalJeopardy]}
            dailyDoubleClueIds={game.dailyDoubleClueIds}
            onClueClick={setSelectedClue}
          />
        </>
      )}

      {selectedClue && (
        <ClueModal
          clue={selectedClue}
          onClose={() => setSelectedClue(null)}
        />
      )}
    </main>
  )
}

export default GamePage