import { useEffect, useState } from 'react'

interface GameSummary {
  id: number
  title: string
  gameDate: string
  season: string
}

interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function GamesPage() {
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/games?page=0&size=20')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        return response.json()
      })
      .then((data: PageResponse<GameSummary>) => {
        setGames(data.content)
      })
      .catch(error => {
        setError(error.message)
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