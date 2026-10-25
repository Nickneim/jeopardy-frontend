import { Link, useLocation } from 'react-router'
import type { GameCategory, GameClue } from '../api/games'
import { sanitizeClueHtml } from '../clueHtml'
import { formatCorrectResponse } from '../format'
import ClueMedia from './ClueMedia'

interface ClueModalProps {
  clue: GameClue
  category: GameCategory
  onClose: () => void
}

function ClueModal({
  clue,
  category,
  onClose,
}: ClueModalProps) {
  const location = useLocation()

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
          <h2 className="clue-category">{category.name}</h2>

          {category.comments && (
            <p className="category-comments">{category.comments}</p>
          )}

          <ClueMedia
            clueType={clue.clueType}
            mediaUrl={clue.mediaUrl}
          />

          <p
            className="clue-question"
            dangerouslySetInnerHTML={{ __html: sanitizeClueHtml(clue.question) }}
          />

          <details>
            <summary>Show Answer</summary>
            <p className="clue-answer">
              {formatCorrectResponse(clue.answer)}
            </p>
          </details>

          <Link
            to={`/clues/${clue.id}`}
            state={location.state}
          >
            Open clue page
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ClueModal