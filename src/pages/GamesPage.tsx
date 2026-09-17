import { useEffect, useState } from 'react'
import { getGames, type GameSummary } from '../api/games'
import { ApiError } from '../api/errors'

function GamesPage() {
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGames()
      .then(data => {
        setGames(data.content)
      })
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
  }, [])

  if (loading) {
    return <p>Loading games...</p>
  }

  if (error) {
    return <p>Error loading games: {error}</p>
  }

  return (
    <main>
      <h1>Jeopardy Games</h1>

      {games.map(game => (
        <article key={game.id}>
          <h2>{game.title}</h2>
          <p>
            Season {game.season} — {game.gameDate}
          </p>
        </article>
      ))}
    </main>
  )
}

export default GamesPage