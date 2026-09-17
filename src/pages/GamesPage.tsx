import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router'
import type {
  GameSummary,
  PageResponse,
} from '../api/games'

function GamesPage() {
  const data = useLoaderData() as PageResponse<GameSummary>
  const navigation = useNavigation()
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(
    0,
    Number(searchParams.get('page') ?? '0'),
  )

  const isLoading = navigation.state !== 'idle'

  function goToPage(newPage: number) {
    const newParams = new URLSearchParams(searchParams)

    if (newPage === 0) {
      newParams.delete('page')
    } else {
      newParams.set('page', String(newPage))
    }

    setSearchParams(newParams)
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

      <nav aria-label="Game pagination">
        <button
          type="button"
          disabled={isLoading || page === 0}
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
          disabled={
            isLoading ||
            page >= data.totalPages - 1
          }
          onClick={() => goToPage(page + 1)}
        >
          Next
        </button>
      </nav>
    </main>
  )
}

export default GamesPage
