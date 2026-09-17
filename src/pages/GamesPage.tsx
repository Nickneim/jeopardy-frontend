import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../api/errors'
import { getGames, type GameSummary, type PageResponse } from '../api/games'

const PAGE_SIZE = 20

function GamesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(
    0,
    Number(searchParams.get('page') ?? '0'),
  )

  const season = searchParams.get('season') ?? undefined

  const [data, setData] = useState<PageResponse<GameSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    getGames(page, PAGE_SIZE, season)
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
  }, [page, season])

  function goToPage(newPage: number) {
    const newParams = new URLSearchParams(searchParams)

    if (newPage === 0) {
      newParams.delete('page')
    } else {
      newParams.set('page', String(newPage))
    }

    setSearchParams(newParams)
  }

  if (!data && loading) {
    return <p>Loading games...</p>
  }

  if (!data) {
    return <p>{error ?? 'Unable to load games.'}</p>
  }

  return (
    <main>
      <h1>Jeopardy Games</h1>

      {error && <p>Error loading games: {error}</p>}

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

      <nav aria-label="Game pagination">
        <button
          type="button"
          disabled={loading || page === 0}
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </button>

        <span>
          {' '}
          Page {data.page + 1} of {data.totalPages}{' '}
        </span>

        <button
          type="button"
          disabled={loading || page >= data.totalPages - 1}
          onClick={() => goToPage(page + 1)}
        >
          Next
        </button>
      </nav>
    </main>
  )
}

export default GamesPage

