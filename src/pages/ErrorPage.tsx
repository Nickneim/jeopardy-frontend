import {
  isRouteErrorResponse,
  Link,
  useRouteError,
} from 'react-router'
import { ApiError, hasErrorCode, isServerOffline } from '../api/errors'
import ServerOffline from '../components/ServerOffline'

function ErrorPage() {
  const error = useRouteError()

  if (isServerOffline(error)) {
    return <ServerOffline />
  }

  // An old invite link, or a game that ended while the page was open.
  if (hasErrorCode(error, 'SESSION_NOT_FOUND')) {
    return (
      <main>
        <h1>Game over</h1>

        <p>This game has ended, or there's no game with this code.</p>

        <p>
          <Link to="/sessions">See the live games</Link>
          {' · '}
          <Link to="/games">Pick a game to host</Link>
        </p>
      </main>
    )
  }

  let message = 'An unexpected error occurred.'
  let status: number | undefined

  if (error instanceof ApiError) {
    message = error.message
    status = error.status
  } else if (isRouteErrorResponse(error)) {
    message = error.data || error.statusText
    status = error.status
  }

  return (
    <main>
      <h1>
        {status ? `Error ${status}` : 'Something went wrong'}
      </h1>

      <p>{message}</p>

      <Link to="/games">Back to games</Link>
    </main>
  )
}

export default ErrorPage
