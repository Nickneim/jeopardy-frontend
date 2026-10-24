import type { JoinMode } from '../../navigation'
import JoinForm from './JoinForm'

interface JoinChoiceProps {
  // False once the game has started, if the host blocked late joining.
  canJoin: boolean
  joinScore: number
  // Kept by the page, whose "Join as player" button (next to the podiums)
  // lets a spectator join later.
  mode: JoinMode
  onModeChange: (mode: JoinMode) => void
}

// What someone without a token sees: a choice between joining and
// watching. Spectators can still join later, while joining is allowed.
function JoinChoice({
  canJoin,
  joinScore,
  mode,
  onModeChange,
}: JoinChoiceProps) {
  if (!canJoin) {
    return (
      <p>
        You're watching as a spectator: this game doesn't accept new players.
      </p>
    )
  }

  if (mode === 'join') {
    return (
      <JoinForm
        joinScore={joinScore}
        onCancel={() => onModeChange('watch')}
      />
    )
  }

  if (mode === 'watch') {
    return <p>You're watching as a spectator.</p>
  }

  return (
    <div className="join-choice">
      <button
        type="button"
        className="primary-button"
        onClick={() => onModeChange('join')}
      >
        Join this game
      </button>

      <button
        type="button"
        className="primary-button"
        onClick={() => onModeChange('watch')}
      >
        Watch as spectator
      </button>
    </div>
  )
}

export default JoinChoice
