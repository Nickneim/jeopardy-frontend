import { useFetcher } from 'react-router'
import type { JoinActionData } from '../../api/sessions'

// Opens a live game from a code someone read out or sent. Posts to the live
// games list's action, which checks the game exists before going there.
function JoinByCode() {
  const fetcher = useFetcher<JoinActionData>()

  const isOpening = fetcher.state !== 'idle'

  return (
    <fetcher.Form method="post" action="/sessions" className="code-form">
      <label>
        Game code
        <input
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="7KQ2M"
        />
      </label>

      <button type="submit" className="gold-button" disabled={isOpening}>
        {isOpening ? 'Opening…' : 'Join'}
      </button>

      {fetcher.data?.error && (
        <p className="form-error" role="alert">{fetcher.data.error}</p>
      )}
    </fetcher.Form>
  )
}

export default JoinByCode
