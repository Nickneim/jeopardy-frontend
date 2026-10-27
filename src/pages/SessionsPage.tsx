import type { FormEvent } from 'react'
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from 'react-router'
import {
  DEFAULT_SESSION_SORT,
  SESSION_STAGES,
  sessionStage,
  type SessionFilters,
  type SessionsLoaderData,
  type SessionStage,
} from '../api/sessions'
import Pagination from '../components/Pagination'
import SortHeader from '../components/SortHeader'
import JoinByCode from '../components/session/JoinByCode'
import { formatAirDate, formatMoney, ROUND_NAMES } from '../format'
import type { SessionLinkState } from '../navigation'

const JOIN_STATE: SessionLinkState = { joinMode: 'join' }
const WATCH_STATE: SessionLinkState = { joinMode: 'watch' }

function stageLabel(stage: SessionStage): string {
  switch (stage) {
    case 'LOBBY':
      return 'Waiting to start'
    case 'FINISHED':
      return 'Finished'
    default:
      return ROUND_NAMES[stage]
  }
}

function SessionsPage() {
  const { sessions, filters, sort } = useLoaderData() as SessionsLoaderData
  const navigation = useNavigation()
  const revalidator = useRevalidator()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const isLoading = navigation.state !== 'idle' ||
    revalidator.state !== 'idle'
  const hasFilters = Boolean(filters.search || filters.stage || filters.joinable)

  // New filters start again from the first page, in the same order.
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const newParams = new URLSearchParams()
    const set = (name: string, value: FormDataEntryValue | null) => {
      const text = String(value ?? '').trim()

      if (text) {
        newParams.set(name, text)
      }
    }

    set('search', formData.get('search'))
    set('stage', formData.get('stage'))
    set('joinable', formData.get('joinable'))
    set('finished', formData.get('finished'))
    set('sort', searchParams.get('sort'))
    set('direction', searchParams.get('direction'))

    setSearchParams(newParams)
  }

  const headerProps = {
    sort,
    defaultSort: DEFAULT_SESSION_SORT,
    disabled: isLoading,
  }

  return (
    <main className="site-page">
      <div className="page-heading">
        <h1>
          <span className="live-dot" aria-hidden="true" />
          Live games
        </h1>
        <JoinByCode />
      </div>

      {/* Remounts on URL changes (e.g. back button) so the inputs match the URL. */}
      <SessionFilterForm
        key={location.search}
        filters={filters}
        disabled={isLoading}
        onSubmit={applyFilters}
        onRefresh={() => void revalidator.revalidate()}
      />

      <div className="table-box">
        <table className="tv-table">
          <thead>
            <tr>
              <SortHeader column="id" label="Code" {...headerProps} />
              <SortHeader column="gameTitle" label="Game" {...headerProps} />
              <SortHeader column="gameSeason" label="Season" firstDirection="desc" {...headerProps} />
              <SortHeader column="gameDate" label="Air date" firstDirection="desc" {...headerProps} />
              <SortHeader column="hostName" label="Host" {...headerProps} />
              <SortHeader column="playerCount" label="Players" firstDirection="desc" {...headerProps} />
              <SortHeader column="stage" label="Status" {...headerProps} />
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>

          <tbody>
            {sessions.content.length === 0 && (
              <tr>
                <td colSpan={8} className="table-empty">
                  {hasFilters
                    ? 'No live games match these filters.'
                    : <>No live games right now. <Link to="/games">Host one!</Link></>}
                </td>
              </tr>
            )}

            {sessions.content.map(session => (
              <tr key={session.id}>
                <td className="cell-code">{session.id}</td>
                <td className="cell-title">{session.gameTitle ?? 'Untitled game'}</td>
                <td className="cell-season">{session.gameSeason ?? '—'}</td>
                <td className="cell-nowrap">
                  {session.gameDate ? formatAirDate(session.gameDate) : '—'}
                </td>
                <td className="cell-host">{session.hostName ?? '—'}</td>
                <td>{session.playerCount}</td>
                <td className="cell-status">{stageLabel(sessionStage(session))}</td>
                <td className="cell-actions">
                  {session.joinable && (
                    <Link
                      to={`/sessions/${session.id}`}
                      state={JOIN_STATE}
                      className="gold-button"
                      title={session.joinScore < 0
                        ? `New players start with ${formatMoney(session.joinScore)}`
                        : undefined}
                    >
                      Join
                    </Link>
                  )}
                  <Link
                    to={`/sessions/${session.id}`}
                    state={WATCH_STATE}
                    className="outline-button"
                  >
                    Watch
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={sessions.page}
        totalPages={sessions.totalPages}
        disabled={isLoading}
        label="Live game pagination"
      />
    </main>
  )
}

interface SessionFilterFormProps {
  filters: SessionFilters
  disabled: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onRefresh: () => void
}

function SessionFilterForm({
  filters,
  disabled,
  onSubmit,
  onRefresh,
}: SessionFilterFormProps) {
  return (
    <form className="game-filters" onSubmit={onSubmit}>
      <label>
        Search
        <input
          type="search"
          name="search"
          placeholder="Game or host"
          defaultValue={filters.search}
        />
      </label>

      <label>
        Status
        <select name="stage" defaultValue={filters.stage ?? ''}>
          <option value="">Any</option>
          {SESSION_STAGES.map(stage => (
            <option key={stage} value={stage}>{stageLabel(stage)}</option>
          ))}
        </select>
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          name="joinable"
          value="true"
          defaultChecked={filters.joinable}
        />
        Joinable only
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          name="finished"
          value="true"
          defaultChecked={filters.includeFinished}
        />
        Show finished games
      </label>

      <button type="submit" className="gold-button" disabled={disabled}>
        Search
      </button>

      <button
        type="button"
        className="outline-button"
        disabled={disabled}
        onClick={onRefresh}
      >
        Refresh
      </button>
    </form>
  )
}

export default SessionsPage
