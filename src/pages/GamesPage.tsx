import {
  Link,
  useLoaderData,
  useLocation,
  useNavigation,
  useSearchParams,
} from 'react-router'
import type {
  GameFilters,
  GamesLoaderData,
} from '../api/games'
import GameFilterForm from '../components/GameFilterForm'
import Pagination from '../components/Pagination'

function GamesPage() {
  const { games, seasons, filters } = useLoaderData() as GamesLoaderData
  const navigation = useNavigation()
  const location = useLocation()
  const [, setSearchParams] = useSearchParams()

  const isLoading = navigation.state !== 'idle'
  const hasFilters = Object.keys(filters).length > 0

  // New filters start again from the first page.
  function applyFilters(newFilters: GameFilters) {
    const newParams = new URLSearchParams()

    for (const [name, value] of Object.entries(newFilters)) {
      if (value?.trim()) {
        newParams.set(name, value.trim())
      }
    }

    setSearchParams(newParams)
  }

  return (
    <main>
      <h1>Jeopardy Games</h1>

      {/* Remounts on URL changes (e.g. back button) so the inputs match the URL. */}
      <GameFilterForm
        key={location.search}
        filters={filters}
        seasons={seasons}
        disabled={isLoading}
        onSubmit={applyFilters}
      />

      {hasFilters && (
        <p>
          {games.totalElements} matching{' '}
          {games.totalElements === 1 ? 'game' : 'games'}{' '}
          <Link to="/games">Clear filters</Link>
        </p>
      )}

      {games.content.length === 0 && (
        <p>
          {hasFilters
            ? 'No games match these filters.'
            : 'No games found.'}
        </p>
      )}

      {games.content.map(game => (
        <article key={game.id}>
          <Link
            to={`/games/${game.id}`}
            state={{ gamesSearch: location.search }}
          >
            <h2>{game.title}</h2>
          </Link>

          <p>
            Season {game.season} — {game.gameDate}
            {game.clueCount === 0 && (
              <span className="no-clues"> — no clues, can't be played</span>
            )}
          </p>
        </article>
      ))}

      <Pagination
        page={games.page}
        totalPages={games.totalPages}
        disabled={isLoading}
        label="Game pagination"
      />
    </main>
  )
}

export default GamesPage
