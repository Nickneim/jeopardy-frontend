import { useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import type {
  Game,
  GameClue,
} from '../api/games'
import GameBoard from '../components/GameBoard'
import ClueModal from '../components/ClueModal'

function GamePage() {
  const game = useLoaderData() as Game

  const [selectedClue, setSelectedClue] =
    useState<GameClue | null>(null)

  return (
    <main>
      <Link to="/games">← Back to games</Link>

      <h1>{game.title}</h1>

      <p>
        Season {game.season} — {game.gameDate}
      </p>

      <h2>Jeopardy!</h2>

      <GameBoard
        categories={game.jeopardyRound}
        dailyDoubleClueIds={game.dailyDoubleClueIds}
        onClueClick={setSelectedClue}
      />

      <h2>Double Jeopardy!</h2>

      <GameBoard
        categories={game.doubleJeopardyRound}
        dailyDoubleClueIds={game.dailyDoubleClueIds}
        onClueClick={setSelectedClue}
      />

      {game.finalJeopardy && (
        <>
          <h2>Final Jeopardy!</h2>

          <GameBoard
            categories={[game.finalJeopardy]}
            dailyDoubleClueIds={game.dailyDoubleClueIds}
            onClueClick={setSelectedClue}
          />
        </>
      )}

      {selectedClue && (
        <ClueModal
          clue={selectedClue}
          onClose={() => setSelectedClue(null)}
        />
      )}
    </main>
  )
}

export default GamePage
