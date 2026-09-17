import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/errors'
import { getGame, type Game, type GameCategory } from '../api/games'

function Category({ category }: { category: GameCategory }) {
  return (
    <section>
      <h2>{category.name}</h2>

      {category.comments && <p>{category.comments}</p>}

      <div>
        {category.clues.map(clue => (
          <article key={clue.id}>
            <h3>${clue.value}</h3>
            <p>{clue.question}</p>

            {clue.clueType !== 'TEXT' && clue.mediaUrl && (
              <p>
                Media: <a href={clue.mediaUrl}>{clue.mediaUrl}</a>
              </p>
            )}

            <details>
              <summary>Answer</summary>
              <p>{clue.answer}</p>
            </details>
          </article>
        ))}
      </div>
    </section>
  )
}

function Round({
  title,
  categories,
}: {
  title: string
  categories: GameCategory[]
}) {
  return (
    <section>
      <h2>{title}</h2>

      {categories.map(category => (
        <Category key={category.id} category={category} />
      ))}
    </section>
  )
}

function GamePage() {
  const { id } = useParams()
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('Game ID is missing')
      setLoading(false)
      return
    }

    const gameId = Number(id)

    if (!Number.isInteger(gameId) || gameId <= 0) {
      setError('Invalid game ID')
      setLoading(false)
      return
    }

    getGame(gameId)
      .then(setGame)
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
    return <p>Loading game...</p>
  }

  if (error) {
    return (
      <main>
        <p>Error loading game: {error}</p>
        <Link to="/games">Back to games</Link>
      </main>
    )
  }

  if (!game) {
    return null
  }

  return (
    <main>
      <Link to="/games">← Back to games</Link>

      <h1>{game.title}</h1>

      <p>
        Season {game.season} — {game.gameDate}
      </p>

      <Round
        title="Jeopardy!"
        categories={game.jeopardyRound}
      />

      <Round
        title="Double Jeopardy!"
        categories={game.doubleJeopardyRound}
      />

      {game.finalJeopardy && (
        <Round
          title="Final Jeopardy!"
          categories={[game.finalJeopardy]}
        />
      )}
    </main>
  )
}

export default GamePage