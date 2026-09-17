import { Link, useLoaderData } from 'react-router'
import type { Clue } from '../api/clues'

function CluePage() {
  const clue = useLoaderData() as Clue

  return (
    <main>
      <Link to="/games">← Back to games</Link>

      <h1>{clue.categoryName}</h1>

      <p>
        Value: ${clue.value}
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
    </main>
  )
}

export default CluePage
