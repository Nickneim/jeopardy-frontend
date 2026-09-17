import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/errors'
import { getClue, type Clue } from '../api/clues'

function CluePage() {
  const { id } = useParams()

  const [clue, setClue] = useState<Clue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('Clue ID is missing')
      setLoading(false)
      return
    }

    const clueId = Number(id)

    if (!Number.isInteger(clueId) || clueId <= 0) {
      setError('Invalid clue ID')
      setLoading(false)
      return
    }

    getClue(clueId)
      .then(setClue)
      .catch(error => {
        if (error instanceof ApiError) {
          setError(error.message)
        } else {
          setError('An unexpected error occurred')
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <p>Loading clue...</p>
  }

  if (error) {
    return (
      <main>
        <p>Error loading clue: {error}</p>
        <Link to="/games">Back to games</Link>
      </main>
    )
  }

  if (!clue) {
    return null
  }

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
