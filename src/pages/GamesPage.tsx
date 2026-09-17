import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../api/errors'
import { getGames, type GameSummary, type PageResponse } from '../api/games'

function GamesPage() {
  const [searchParams] = useSearchParams()

  const page = Number(searchParams.get('page') ?? '0')
  const size = Number(searchParams.get('size') ?? '20')
  const season = searchParams.get('season') ?? undefined

  const [data, setData] = useState<PageResponse<GameSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    getGames(page, size, season)
      .then(setData)
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
  }, [page, size, season])

  if (loading) {
    return <p>Loading games...</p>
  }

  if (error) {
    return <p>Error loading games: {error}</p>
  }

  if (!data) {
    return null
  }

  return (
    <main>
      <h1>Jeopardy Games</h1>

      {data.content.map(game => (
        <article key={game.id}>
          <Link to={`/games/${game.id}`}>
            <h2>{game.title}</h2>
          </Link>

          <p>
            Season {game.season} — {game.gameDate}
          </p>
        </article>
      ))}
    </main>
  )
}

export default GamesPage