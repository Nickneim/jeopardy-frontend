import { Link, useLoaderData, useLocation } from 'react-router'
import type { Clue } from '../api/clues'

function CluePage() {
  const clue = useLoaderData() as Clue
  const location = useLocation()

  return (
    <main>
      <Link
        to={`/games/${clue.gameId}`}
        state={location.state}
      >
        ← Back to game
      </Link>

      <h1>{clue.categoryName}</h1>

      {clue.categoryComments && (
        <p className="category-comments">{clue.categoryComments}</p>
      )}

      <p>
        {clue.isFinalClue ? 'Final Jeopardy!' : `Value: $${clue.value}`}
      </p>

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

      <div
        className="clue-question"
        dangerouslySetInnerHTML={{ __html: clue.question }}
      />

      <details>
        <summary>Show Answer</summary>
        <p className="clue-answer">
          {clue.answer}
        </p>
      </details>
    </main>
  )
}

export default CluePage
