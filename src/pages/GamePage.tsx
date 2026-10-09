import { useState } from 'react'
import { Link, useLoaderData, useLocation } from 'react-router'
import type {
  Game,
  GameCategory,
  GameClue,
} from '../api/games'
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
