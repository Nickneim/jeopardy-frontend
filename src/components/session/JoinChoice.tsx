import { useState } from 'react'
import type { JoinMode } from '../../navigation'
import JoinForm from './JoinForm'

interface JoinChoiceProps {
  // False once the game has started, if the host blocked late joining.
  canJoin: boolean
  joinScore: number
  defaultMode: JoinMode
}

// What someone without a token sees: a choice between joining and
// watching. Spectators can still join later, while joining is allowed.
function JoinChoice({
  canJoin,
  joinScore,
  defaultMode,
}: JoinChoiceProps) {
  const [mode, setMode] = useState<JoinMode>(defaultMode)

  if (!canJoin) {
    return (
      <p>
        This game has already started and doesn't accept new players.
        You're watching as a spectator.
      </p>
    )
  }

  if (mode === 'join') {
    return (
      <JoinForm
        joinScore={joinScore}
        onCancel={() => setMode('watch')}
      />
    )
  }

  if (mode === 'watch') {
    return (
      <p>
        You're watching as a spectator.{' '}
        <button type="button" onClick={() => setMode('join')}>
          Join this game
        </button>
      </p>
    )
  }

  return (
    <div className="join-choice">
      <button
        type="button"
        className="primary-button"
        onClick={() => setMode('join')}
      >
        Join this game
      </button>

      <button
        type="button"
        className="primary-button"
        onClick={() => setMode('watch')}
      >
        Watch as spectator
      </button>
    </div>
  )
}

export default JoinChoice
