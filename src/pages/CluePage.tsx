import { Link, useLoaderData, useLocation } from 'react-router'
import type { Clue } from '../api/clues'
import ClueMedia from '../components/ClueMedia'

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

      <ClueMedia
        clueType={clue.clueType}
        mediaUrl={clue.mediaUrl}
      />

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
