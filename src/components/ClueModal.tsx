import type { GameClue } from '../api/games'

interface ClueModalProps {
  clue: GameClue
  onClose: () => void
}

function ClueModal({
  clue,
  onClose,
}: ClueModalProps) {
  return (
    <div
      className="clue-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="clue-modal"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="clue-modal-close"
          onClick={onClose}
          aria-label="Close clue"
        >
          ×
        </button>

        <div className="clue-modal-content">
          {clue.clueType === 'IMAGE' && clue.mediaUrl && (
            <img
              src={clue.mediaUrl}
              alt=""
            />
          )}

          {clue.clueType === 'VIDEO' && clue.mediaUrl && (
            <video
              controls
              src={clue.mediaUrl}
            />
          )}

          {clue.clueType === 'SOUND' && clue.mediaUrl && (
            <audio
              controls
              src={clue.mediaUrl}
            />
          )}

          <p
            className="clue-question"
            dangerouslySetInnerHTML={{ __html: clue.question }}
          />

          <details>
            <summary>Show Answer</summary>
            <p className="clue-answer">
              {clue.answer}
            </p>
          </details>
        </div>
      </div>
    </div>
  )
}

export default ClueModal