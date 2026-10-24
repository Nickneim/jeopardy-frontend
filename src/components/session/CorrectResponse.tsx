import type { AcceptedAnswers } from '../../api/sessions'
import {
  formatAcceptedAnswers,
  formatAlsoAccepted,
  formatMatchedAnswers,
} from '../../format'

// A correct answer's matchedAnswers and alsoAccepted.
interface CorrectMatch {
  matchedAnswers: string[] | null
  alsoAccepted: string[] | null
}

interface CorrectResponseProps {
  accepted: AcceptedAnswers | null
  // A correct answer to show it in its own wording, if anyone gave one.
  match?: CorrectMatch | null
}

// The correct response after an answer reveal (api.md §6.7): what the
// player who got it right said, and a list's options they didn't name.
// Otherwise the accepted answers.
function CorrectResponse({ accepted, match = null }: CorrectResponseProps) {
  const matched = match?.matchedAnswers ?? []
  const alsoAccepted = match?.alsoAccepted ?? []

  const response = matched.length > 0
    ? formatMatchedAnswers(matched)
    : accepted && formatAcceptedAnswers(accepted)

  if (!response) {
    return null
  }

  return (
    <p className="tv-correct-response">
      <span className="tv-kicker">Correct response</span>
      <strong>{response}</strong>

      {matched.length > 0 && alsoAccepted.length > 0 && (
        <span className="tv-also-accepted">
          We would also have accepted {formatAlsoAccepted(alsoAccepted)}
        </span>
      )}
    </p>
  )
}

export default CorrectResponse
