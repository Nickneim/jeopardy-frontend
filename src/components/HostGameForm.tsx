import { useFetcher } from 'react-router'
import {
  getRememberedPlayerName,
  MAX_NAME_LENGTH,
  type JoinActionData,
} from '../api/sessions'

interface HostGameFormProps {
  // The game to host, or none for a random one.
  gameId?: number
  submitLabel: string
  autoFocus?: boolean
  onCancel?: () => void
}

// Asks for the host's name and posts to the live games route's action, which
// creates the session, joins it and goes there. Its errors (such as a
// rejected name) show on this form.
function HostGameForm({
  gameId,
  submitLabel,
  autoFocus = false,
  onCancel,
}: HostGameFormProps) {
  const fetcher = useFetcher<JoinActionData>()
  const isHosting = fetcher.state !== 'idle'

  return (
    <fetcher.Form method="post" action="/sessions" className="host-form">
      {gameId === undefined
        ? <input type="hidden" name="random" value="true" />
        : <input type="hidden" name="gameId" value={gameId} />}

      <label>
        Your name
        <input
          name="playerName"
          required
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          autoFocus={autoFocus}
          defaultValue={getRememberedPlayerName()}
        />
      </label>

      <button type="submit" className="gold-button" disabled={isHosting}>
        {isHosting ? 'Creating…' : submitLabel}
      </button>

      {onCancel && (
        <button type="button" className="outline-button" onClick={onCancel}>
          Cancel
        </button>
      )}

      {fetcher.data?.error && (
        <p className="form-error" role="alert">
          {fetcher.data.error}
        </p>
      )}
    </fetcher.Form>
  )
}

export default HostGameForm
