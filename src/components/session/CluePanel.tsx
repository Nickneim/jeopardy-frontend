import { clueAnswersRound, type GameSession, type Player } from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { formatCorrectResponse, formatMoney } from '../../format'
import ClueMedia from '../ClueMedia'
import AnswerForm from './AnswerForm'
import ClueAnswers from './ClueAnswers'
import WagerForm from './WagerForm'

const MIN_DAILY_DOUBLE_WAGER = 5

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

  // The most a player can wager: their score, or the round's top clue value.
  const highestValue = Math.max(
    0,
    ...session.board.flatMap(c => c.slots.map(slot => slot.value ?? 0)),
  )
  const maxDailyDoubleWager = Math.max(me?.score ?? 0, highestValue)

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

            {isMyWager
              ? (
                <WagerForm
                  min={MIN_DAILY_DOUBLE_WAGER}
                  max={maxDailyDoubleWager}
                  submitLabel="Wager"
                  allIn
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
                <p
                  className="tv-question"
                  dangerouslySetInnerHTML={{ __html: clue.question }}
                />
              </div>
            )}

            {isRevealing && clue.answer && (
              <p className="tv-correct-response">
                <span className="tv-kicker">Correct response</span>
                <strong>{formatCorrectResponse(clue.answer)}</strong>
              </p>
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
