import {
  Link,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from 'react-router'
import type { PageResponse } from '../api/games'
import type { GameSessionSummary } from '../api/sessions'
import Pagination from '../components/Pagination'
import JoinByCode from '../components/session/JoinByCode'
import { formatMoney, ROUND_NAMES } from '../format'
import type { SessionLinkState } from '../navigation'

const JOIN_STATE: SessionLinkState = { joinMode: 'join' }
const WATCH_STATE: SessionLinkState = { joinMode: 'watch' }

function stateLabel(session: GameSessionSummary): string {
  switch (session.state) {
    case 'WAITING_FOR_START':
      return 'Waiting to start'
    case 'FINISHED_GAME':
    case 'CLOSED':
      return 'Finished'
    default:
      return `${ROUND_NAMES[session.round]} in progress`
  }
}

function SessionsPage() {
  const sessions = useLoaderData() as PageResponse<GameSessionSummary>
  const navigation = useNavigation()
  const revalidator = useRevalidator()
  const [searchParams, setSearchParams] = useSearchParams()

  const showFinished = searchParams.get('finished') === 'true'
  const isLoading = navigation.state !== 'idle' ||
    revalidator.state !== 'idle'


  // Back to the first page, since the list changes.
  function toggleFinished(show: boolean) {
    setSearchParams(show ? { finished: 'true' } : {})
  }

  return (
    <main>
      <h1>Live Games</h1>

      <p>
        Join a game below, or <Link to="/games">pick a game to host</Link>.{' '}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void revalidator.revalidate()}
        >
          Refresh
        </button>
      </p>

      <JoinByCode />

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={showFinished}
          disabled={isLoading}
          onChange={event => toggleFinished(event.target.checked)}
        />
        Show finished games
      </label>

      {sessions.content.length === 0 && (
        <p>{showFinished ? 'No games right now.' : 'No live games right now.'}</p>
      )}

      {sessions.content.map(session => (
        <article key={session.id}>
          <Link to={`/sessions/${session.id}`}>
            <h2>{session.gameTitle ?? 'Untitled game'}</h2>
          </Link>

          <p>
            {stateLabel(session)}
            {' — '}
            {session.playerCount}{' '}
            {session.playerCount === 1 ? 'player' : 'players'}
            {session.hostName && `, hosted by ${session.hostName}`}
            {' — '}
            created {new Date(session.createdAt).toLocaleString()}
          </p>

          <p>
            {session.joinable && (
              <>
                <Link to={`/sessions/${session.id}`} state={JOIN_STATE}>
                  Join
                </Link>
                {session.joinScore < 0 &&
                  ` (new players start with ${formatMoney(session.joinScore)})`}
                {' · '}
              </>
            )}
            <Link to={`/sessions/${session.id}`} state={WATCH_STATE}>
              Watch
            </Link>
          </p>
        </article>
      ))}

      <Pagination
        page={sessions.page}
        totalPages={sessions.totalPages}
        disabled={isLoading}
        label="Live game pagination"
      />
    </main>
  )
}

export default SessionsPage
