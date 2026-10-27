import { useState, type ReactNode } from 'react'
import { Link, useLoaderData, useLocation } from 'react-router'
import type { Game, GameCategory } from '../api/games'
import GameBoard, { CategoryHeader, ClueCard } from '../components/GameBoard'
import HostGameForm from '../components/HostGameForm'
import { formatAirDate } from '../format'
import { gamesListPath } from '../navigation'

function hasClues(categories: GameCategory[]): boolean {
  return categories.some(category => category.clues.length > 0)
}

function GamePage() {
  const game = useLoaderData() as Game
  const location = useLocation()

  // Each clue shows its correct response when it's flipped one way or the
  // other from "Show all answers".
  const [showAll, setShowAll] = useState(false)
  const [toggled, setToggled] = useState<ReadonlySet<number>>(new Set())

  const isFlipped = (clueId: number) => showAll !== toggled.has(clueId)

  function flip(clueId: number) {
    setToggled(current => {
      const next = new Set(current)

      if (!next.delete(clueId)) {
        next.add(clueId)
      }

      return next
    })
  }

  function toggleAll() {
    setShowAll(!showAll)
    setToggled(new Set())
  }

  const final = game.finalJeopardy
  const finalClue = final?.clues[0]
  // Some imported games have no clues, and can't be played.
  const playable = hasClues([
    ...game.jeopardyRound,
    ...game.doubleJeopardyRound,
    ...(final ? [final] : []),
  ])

  return (
    <main className="site-page game-page">
      <header className="game-header">
        <div className="game-header-row">
          <Link to={gamesListPath(location.state)} className="back-link">
            ‹ Back to games
          </Link>

          <h1>
            {game.title}{' '}
            <span className="game-meta">
              Season {game.season} · {formatAirDate(game.gameDate)}
            </span>
          </h1>

          {playable && (
            <button type="button" className="outline-button" onClick={toggleAll}>
              {showAll ? 'Show all clues' : 'Show all answers'}
            </button>
          )}
        </div>

        {playable
          ? <HostGameForm gameId={game.id} submitLabel="Host live game" />
          : <p className="game-unplayable">This game has no clues, so it can't be hosted.</p>}

        <nav className="round-tabs" aria-label="Rounds">
          <a href="#jeopardy">Jeopardy!</a>
          <a href="#double-jeopardy">Double Jeopardy!</a>
          <a href="#final-jeopardy">Final Jeopardy!</a>
        </nav>
      </header>

      <RoundSection id="jeopardy" name="Jeopardy!">
        {hasClues(game.jeopardyRound)
          ? (
            <GameBoard
              categories={game.jeopardyRound}
              dailyDoubleClueIds={game.dailyDoubleClueIds}
              isFlipped={isFlipped}
              onFlip={flip}
            />
          )
          : <RoundNotice title="No clues for this round" round="Jeopardy!" />}
      </RoundSection>

      <RoundSection id="double-jeopardy" name="Double Jeopardy!">
        {hasClues(game.doubleJeopardyRound)
          ? (
            <GameBoard
              categories={game.doubleJeopardyRound}
              dailyDoubleClueIds={game.dailyDoubleClueIds}
              isFlipped={isFlipped}
              onFlip={flip}
            />
          )
          : <RoundNotice title="No clues for this round" round="Double Jeopardy!" />}
      </RoundSection>

      <RoundSection id="final-jeopardy" name="Final Jeopardy!">
        {final && finalClue
          ? (
            <div className="final-board">
              <CategoryHeader category={final} />
              <ClueCard
                clue={finalClue}
                label=""
                dailyDouble={false}
                flipped={isFlipped(finalClue.id)}
                onFlip={flip}
                className="is-final"
              />
            </div>
          )
          : <RoundNotice title="No Final Jeopardy! clue" round="Final Jeopardy!" />}
      </RoundSection>
    </main>
  )
}

interface RoundSectionProps {
  id: string
  name: string
  children: ReactNode
}

function RoundSection({ id, name, children }: RoundSectionProps) {
  return (
    <section id={id} className="round-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="round-title">{name}</h2>
      {children}
    </section>
  )
}

interface RoundNoticeProps {
  title: string
  round: string
}

function RoundNotice({ title, round }: RoundNoticeProps) {
  return (
    <div className="round-notice">
      <strong>{title}</strong>
      <span>The archive has no {round} round for this game.</span>
    </div>
  )
}

export default GamePage
