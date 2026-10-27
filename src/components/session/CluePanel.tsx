import { clueAnswersRound, type GameSession, type Player } from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { formatMoney } from '../../format'
import ClueMedia from '../ClueMedia'
import ClueQuestion from '../ClueQuestion'
import AnswerForm from './AnswerForm'
import ClueAnswers from './ClueAnswers'
import CorrectResponse from './CorrectResponse'
import WagerForm from './WagerForm'

interface CluePanelProps {
  session: GameSession
  me: Player | null
  actions: SessionActions
}

// The main screen while a clue is in play: from a Daily Double's wager to
// the answer reveal. Buzzing is on the player's podium.
function CluePanel({
  session,
  me,
  actions,
}: CluePanelProps) {
  const clue = session.currentClue

  if (!clue) {
    return null
  }

  const category = session.board.find(c =>
    c.slots.some(slot => slot.clueId === clue.clueId),
  )

  function playerName(id: number | null): string {
    return session.players.find(player => player.id === id)?.name ?? 'Someone'
  }

  const isWagering = session.state === 'WAITING_FOR_DAILY_DOUBLE_WAGER'
  const isMyWager = me !== null && isWagering &&
    session.playerChoosingClue === me.id

  const isMyAnswer = me !== null &&
    session.state === 'WAITING_FOR_ANSWER' &&
    session.playerAnswering === me.id
  const isRevealing = session.state === 'REVEALING_ANSWER'
  const hasAnswers = session.clueAnswers.length > 0

  return (
    <>
      <p className="tv-heading">
        <span>{category?.name}</span>
        {clue.dailyDouble
          ? <span className="tv-gold">Daily Double</span>
          : <span className="tv-gold">{formatMoney(clue.value)}</span>}
        {clue.dailyDouble && clue.wager !== null && (
          <span>Wager <span className="tv-gold">{formatMoney(clue.wager)}</span></span>
        )}
      </p>

      {category?.comments && (
        <p className="tv-comments">{category.comments}</p>
      )}

      {isWagering
        ? (
          <>
            <h2 className="tv-title">
              <span>Daily</span>
              <span>Double</span>
            </h2>

            {isMyWager && clue.minWager !== null && clue.maxWager !== null
              ? (
                <WagerForm
                  min={clue.minWager}
                  max={clue.maxWager}
                  submitLabel="Wager"
                  allIn
                  once
                  onSubmit={actions.placeDailyDoubleWager}
                />
              )
              : (
                <p className="tv-waiting">
                  <span className="tv-hand">
                    {playerName(session.playerChoosingClue)}
                  </span>
                  <span>is making a wager…</span>
                </p>
              )}
          </>
        )
        : (
          <>
            <ClueMedia clueType={clue.clueType} mediaUrl={clue.mediaUrl} />

            {clue.question && (
              <div
                className={isRevealing || hasAnswers
                  ? 'tv-question-box is-small'
                  : 'tv-question-box'}
              >
                <p className="tv-question">
                  <ClueQuestion html={clue.question} />
                </p>
              </div>
            )}

            {isRevealing && (
              <CorrectResponse
                accepted={clue.acceptedAnswers}
                match={session.clueAnswers.find(answer => answer.correct)}
              />
            )}

            <ClueAnswers
              answers={session.clueAnswers}
              players={session.players}
              round={clueAnswersRound(session)}
              me={me}
              amount={clue.wager ?? clue.value}
            />

            {isMyAnswer && (
              <AnswerForm
                label="Your response"
                submitLabel="Answer"
                numberExpected={clue.numberExpected === true}
                once
                onSubmit={actions.answer}
              />
            )}

            {session.state === 'WAITING_FOR_ANSWER' && !isMyAnswer && (
              <p className="tv-waiting">
                <span className="tv-hand">
                  {playerName(session.playerAnswering)}
                </span>
                <span>is answering…</span>
              </p>
            )}
          </>
        )}
    </>
  )
}

export default CluePanel
