import { useState } from 'react'
import type { GameSession, Player } from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { formatMoney } from '../../format'
import AnswerForm from './AnswerForm'
import WagerForm from './WagerForm'

interface FinalJeopardyPanelProps {
  session: GameSession
  me: Player | null
  actions: SessionActions
}

function FinalJeopardyPanel({
  session,
  me,
  actions,
}: FinalJeopardyPanelProps) {
  // Wagers and answers stay hidden from everyone until the reveal, so the
  // player's own are remembered here to show them back.
  const [myWager, setMyWager] = useState<number | null>(null)
  const [myAnswer, setMyAnswer] = useState<string | null>(null)

  const final = session.finalJeopardy

  if (!final) {
    return null
  }

  const isRevealed = session.state === 'FINAL_JEOPARDY_REVEALING' ||
    session.state === 'FINISHED_GAME'

  function placeWager(wager: number) {
    setMyWager(wager)
    actions.placeFinalJeopardyWager(wager)
  }

  function answer(text: string) {
    setMyAnswer(text)
    actions.answerFinalJeopardy(text)
  }

  return (
    <section className="clue-panel">
      <p className="clue-panel-heading">
        Final Jeopardy! — {final.category}
      </p>

      {final.categoryComments && (
        <p className="category-comments">{final.categoryComments}</p>
      )}

      {final.question && (
        <p
          className="clue-question"
          dangerouslySetInnerHTML={{ __html: final.question }}
        />
      )}

      {me && session.state === 'FINAL_JEOPARDY_WAGERING' && (
        <>
          {myWager !== null && (
            <p>
              Your wager: {formatMoney(myWager)}.
              You can change it until time runs out.
            </p>
          )}

          <WagerForm
            min={0}
            max={Math.max(0, me.score)}
            submitLabel={myWager === null ? 'Place wager' : 'Change wager'}
            onSubmit={placeWager}
          />
        </>
      )}

      {me && session.state === 'FINAL_JEOPARDY_ANSWERING' && (
        <>
          {myAnswer !== null && (
            <p>
              Your answer: “{myAnswer}”.
              You can change it until time runs out.
            </p>
          )}

          <AnswerForm
            label="Your answer"
            submitLabel={myAnswer === null ? 'Answer' : 'Change answer'}
            onSubmit={answer}
          />
        </>
      )}

      {isRevealed && final.answer && (
        <p className="clue-answer">Correct response: {final.answer}</p>
      )}

      <table className="final-jeopardy-table">
        <thead>
          <tr>
            <th>Player</th>
            {isRevealed
              ? (
                <>
                  <th>Answer</th>
                  <th>Wager</th>
                </>
              )
              : (
                <>
                  <th>Wagered</th>
                  <th>Answered</th>
                </>
              )}
          </tr>
        </thead>

        <tbody>
          {final.players.map(result => {
            const name = session.players
              .find(p => p.id === result.playerId)?.name

            return (
              <tr key={result.playerId}>
                <td>{name}</td>

                {isRevealed
                  ? (
                    <>
                      <td className={result.correct ? 'correct' : 'wrong'}>
                        {result.correct ? '✓' : '✗'}{' '}
                        {result.answer ?? <em>no answer</em>}
                      </td>
                      <td>{formatMoney(result.wager ?? 0)}</td>
                    </>
                  )
                  : (
                    <>
                      <td>{result.hasWagered ? '✓' : '…'}</td>
                      <td>{result.hasAnswered ? '✓' : '…'}</td>
                    </>
                  )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export default FinalJeopardyPanel
