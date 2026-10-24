import { useState } from 'react'
import {
  getSentFinalJeopardy,
  rememberSentFinalJeopardy,
  type GameSession,
  type Player,
  type SentFinalJeopardy,
} from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { formatMoney } from '../../format'
import AnswerForm from './AnswerForm'
import CorrectResponse from './CorrectResponse'
import FinalReveal from './FinalReveal'
import type { FinalRevealProgress } from './revealProgress'
import WagerForm from './WagerForm'

interface FinalJeopardyPanelProps {
  session: GameSession
  me: Player | null
  actions: SessionActions
  // Where the reveal is (finalRevealProgress); null shows every result.
  reveal?: FinalRevealProgress | null
}

// The main screen from Final Jeopardy's category to its reveal.
function FinalJeopardyPanel({
  session,
  me,
  actions,
  reveal = null,
}: FinalJeopardyPanelProps) {
  // Wagers and answers stay hidden from everyone until the reveal, so the
  // player's own are remembered to show them back, across refreshes too.
  const [sent, setSent] = useState<SentFinalJeopardy>(() => me
    ? getSentFinalJeopardy(session.id, me.id)
    : { wager: null, answer: null })
  const myWager = sent.wager
  const myAnswer = sent.answer

  const final = session.finalJeopardy

  if (!final) {
    return null
  }

  const isWagering = session.state === 'FINAL_JEOPARDY_WAGERING'
  const isRevealing = session.state === 'FINAL_JEOPARDY_REVEALING'

  // The correct response in the wording you used if you got it right,
  // otherwise in the first right answer's.
  const correct = final.players.filter(player => player.correct)
  const correctMatch = correct.find(player => player.playerId === me?.id) ??
    correct[0]

  function remember(update: Partial<SentFinalJeopardy>) {
    const next = { ...sent, ...update }
    setSent(next)

    if (me) {
      rememberSentFinalJeopardy(session.id, me.id, next)
    }
  }

  function placeWager(wager: number) {
    remember({ wager })
    actions.placeFinalJeopardyWager(wager)
  }

  function answer(text: string) {
    remember({ answer: text })
    actions.answerFinalJeopardy(text)
  }

  return (
    <>
      <p className="tv-heading">
        <span className="tv-gold">Final Jeopardy</span>
        {!isWagering && <span>{final.category}</span>}
      </p>

      {isWagering && (
        <div className="tv-category">
          <span className="tv-kicker">The category is</span>
          <h2>{final.category}</h2>
          {final.categoryComments && (
            <p className="tv-comments">{final.categoryComments}</p>
          )}
        </div>
      )}

      {final.question && (
        <div className={isRevealing ? 'tv-question-box is-small' : 'tv-question-box'}>
          <p
            className="tv-question"
            dangerouslySetInnerHTML={{ __html: final.question }}
          />
        </div>
      )}

      {me && isWagering && (
        <>
          {myWager !== null && (
            <p className="tv-form-hint">
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
            <p className="tv-form-hint">
              Your answer: “{myAnswer}”.
              You can change it until time runs out.
            </p>
          )}

          <AnswerForm
            label="Your response"
            submitLabel={myAnswer === null ? 'Answer' : 'Change answer'}
            numberExpected={final.numberExpected === true}
            handwritten
            onSubmit={answer}
          />
        </>
      )}

      {isRevealing && (
        <>
          <FinalReveal players={session.players} reveal={reveal} final={final} />

          {(reveal === null || reveal.showCorrectResponse) && (
            <CorrectResponse
              accepted={final.acceptedAnswers}
              match={correctMatch}
            />
          )}
        </>
      )}
    </>
  )
}

export default FinalJeopardyPanel
