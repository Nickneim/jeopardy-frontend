import {
  isRouteErrorResponse,
  Link,
  useRouteError,
} from 'react-router'
import { ApiError, isServerOffline } from '../api/errors'
import ServerOffline from '../components/ServerOffline'

function ErrorPage() {
  const error = useRouteError()

  if (isServerOffline(error)) {
    return <ServerOffline />
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
