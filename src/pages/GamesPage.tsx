import { useState } from 'react'
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigation,
  useSearchParams,
} from 'react-router'
import {
  DEFAULT_GAME_SORT,
  type GameFilters,
  type GamesLoaderData,
} from '../api/games'
import GameFilterForm from '../components/GameFilterForm'
import HostGameForm from '../components/HostGameForm'
import Pagination from '../components/Pagination'
import SortHeader from '../components/SortHeader'
import { formatAirDate } from '../format'

function GamesPage() {
  const { games, seasons, filters, sort } = useLoaderData() as GamesLoaderData
  const navigation = useNavigation()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  // The game whose row shows the host form.
  const [hostingId, setHostingId] = useState<number | null>(null)

  const isLoading = navigation.state !== 'idle'
  const hasFilters = Object.keys(filters).length > 0

  // New filters start again from the first page, in the same order.
  function applyFilters(newFilters: GameFilters) {
    const newParams = new URLSearchParams()

    for (const [name, value] of Object.entries(newFilters)) {
      if (value?.trim()) {
        newParams.set(name, value.trim())
      }
    }

    for (const name of ['sort', 'direction']) {
      const value = searchParams.get(name)

      if (value) {
        newParams.set(name, value)
      }
    }

    setSearchParams(newParams)
  }

  const headerProps = {
    sort,
    defaultSort: DEFAULT_GAME_SORT,
    disabled: isLoading,
  }

  return (
    <main className="site-page">
      <div className="page-heading">
        <h1>Game catalog</h1>
        <p className="page-count">
          {games.totalElements.toLocaleString('en-US')}
          {hasFilters ? ' matching ' : ' '}
          {games.totalElements === 1 ? 'game' : 'games'}
          {hasFilters && (
            <>
              {' · '}
              <Link to="/games">Clear filters</Link>
            </>
          )}
        </p>
      </div>

      {/* Remounts on URL changes (e.g. back button) so the inputs match the URL. */}
      <GameFilterForm
        key={location.search}
        filters={filters}
        seasons={seasons}
        disabled={isLoading}
        onSubmit={applyFilters}
      />

      <div className="table-box">
        <table className="tv-table">
          <thead>
            <tr>
              <SortHeader column="title" label="Game" {...headerProps} />
              <SortHeader column="season" label="Season" firstDirection="desc" {...headerProps} />
              <SortHeader column="gameDate" label="Air date" firstDirection="desc" {...headerProps} />
              <SortHeader column="clueCount" label="Clues" firstDirection="desc" {...headerProps} />
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>

          <tbody>
            {games.content.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  {hasFilters
                    ? 'No games match these filters.'
                    : 'No games found.'}
                </td>
              </tr>
            )}

            {games.content.map(game => (
              <GameRow
                key={game.id}
                id={game.id}
                title={game.title}
                season={game.season}
                gameDate={game.gameDate}
                clueCount={game.clueCount}
                gamesSearch={location.search}
                hosting={hostingId === game.id}
                onHost={setHostingId}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={games.page}
        totalPages={games.totalPages}
        disabled={isLoading}
        label="Game pagination"
      />
    </main>
  )
}

interface GameRowProps {
  id: number
  title: string
  season: string
  gameDate: string
  clueCount: number
  gamesSearch: string
  hosting: boolean
  onHost: (id: number | null) => void
}

function GameRow({
  id,
  title,
  season,
  gameDate,
  clueCount,
  gamesSearch,
  hosting,
  onHost,
}: GameRowProps) {
  // Back links on the game page return to this page of the list.
  const linkState = { gamesSearch }

  return (
    <>
      <tr>
        <td className="cell-title">
          <Link to={`/games/${id}`} state={linkState}>{title}</Link>
        </td>
        <td className="cell-season">{season}</td>
        <td className="cell-nowrap">{formatAirDate(gameDate)}</td>
        <td>
          {clueCount === 0
            ? <span className="no-clues">None, can't be played</span>
            : clueCount}
        </td>
        <td className="cell-actions">
          <Link to={`/games/${id}`} state={linkState} className="outline-button">
            View
          </Link>
          {clueCount > 0 && (
            <button
              type="button"
              className="gold-button"
              aria-expanded={hosting}
              onClick={() => onHost(hosting ? null : id)}
            >
              Host
            </button>
          )}
        </td>
      </tr>

      {hosting && (
        <tr className="host-row">
          <td colSpan={5}>
            <HostGameForm
              gameId={id}
              submitLabel={`Host ${title}`}
              autoFocus
              onCancel={() => onHost(null)}
            />
          </td>
        </tr>
      )}
    </>
  )
}

export default GamesPage
