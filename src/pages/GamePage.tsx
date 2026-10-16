import { useState } from 'react'
import {
  Link,
  useFetcher,
  useLoaderData,
  useLocation,
} from 'react-router'
import type {
  Game,
  GameCategory,
  GameClue,
} from '../api/games'
import {
  getRememberedPlayerName,
  type JoinActionData,
} from '../api/sessions'
import GameBoard from '../components/GameBoard'
import ClueModal from '../components/ClueModal'
import { gamesListPath } from '../navigation'

interface SelectedClue {
  clue: GameClue
  category: GameCategory
}

function GamePage() {
  const game = useLoaderData() as Game
  const location = useLocation()
  // The live games route's action creates the session and joins it, and its
  // errors (such as a rejected name) show here.
  const hostFetcher = useFetcher<JoinActionData>()
  const isHosting = hostFetcher.state !== 'idle'

  // Some imported games have no clues, and can't be played.
  const hasClues = [
    ...game.jeopardyRound,
    ...game.doubleJeopardyRound,
    ...(game.finalJeopardy ? [game.finalJeopardy] : []),
  ].some(category => category.clues.length > 0)

  const [selected, setSelected] =
    useState<SelectedClue | null>(null)

  function selectClue(clue: GameClue, category: GameCategory) {
    setSelected({ clue, category })
  }

  return (
    <main>
      <Link to={gamesListPath(location.state)}>← Back to games</Link>

      <h1>{game.title}</h1>

      <p>
        Season {game.season} — {game.gameDate}
      </p>

      {hasClues
        ? (
          <hostFetcher.Form
            method="post"
            action="/sessions"
            className="host-form"
          >
            <input type="hidden" name="gameId" value={game.id} />

            <label>
              Your name
              <input
                name="playerName"
                required
                maxLength={40}
                autoComplete="nickname"
                defaultValue={getRememberedPlayerName()}
              />
            </label>

            <button type="submit" disabled={isHosting}>
              {isHosting ? 'Creating…' : 'Host live game'}
            </button>

            {hostFetcher.data?.error && (
              <p className="form-error" role="alert">
                {hostFetcher.data.error}
              </p>
            )}
          </hostFetcher.Form>
        )
        : <p>This game has no clues yet.</p>}

      <h2>Jeopardy!</h2>

      <GameBoard
        categories={game.jeopardyRound}
        dailyDoubleClueIds={game.dailyDoubleClueIds}
        onClueClick={selectClue}
      />

      <h2>Double Jeopardy!</h2>

      <GameBoard
        categories={game.doubleJeopardyRound}
        dailyDoubleClueIds={game.dailyDoubleClueIds}
        onClueClick={selectClue}
      />

      {game.finalJeopardy && (
        <>
          <h2>Final Jeopardy!</h2>

          <GameBoard
            categories={[game.finalJeopardy]}
            dailyDoubleClueIds={game.dailyDoubleClueIds}
            onClueClick={selectClue}
          />
        </>
      )}

      {selected && (
        <ClueModal
          clue={selected.clue}
          category={selected.category}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}

export default GamePage
