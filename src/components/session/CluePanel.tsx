import { clueAnswersRound, type GameSession, type Player } from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { formatMoney } from '../../format'
import ClueMedia from '../ClueMedia'
import ClueQuestion from '../ClueQuestion'
import AnswerForm from './AnswerForm'
import ClueAnswers from './ClueAnswers'
import CorrectResponse from './CorrectResponse'
import TitleCard from './TitleCard'
import WagerForm from './WagerForm'

interface CluePanelProps {
  session: GameSession
  me: Player | null
  actions: SessionActions
}

// The main screen while a clue is in play: from the pick (in a Trebek game)
// or a Daily Double's announcement to the answer reveal. Buzzing is on the
// player's podium. Trebek sees this too, with their desk beside it.
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

  const trebekName = session.trebek?.name ?? 'Trebek'
  const isPicked = session.state === 'CLUE_PICKED'
  const isWagering = session.state === 'WAITING_FOR_DAILY_DOUBLE_WAGER'
  const isMyWager = me !== null && isWagering &&
    session.playerChoosingClue === me.id

  const isMyAnswer = me !== null &&
    session.state === 'WAITING_FOR_ANSWER' &&
    session.playerAnswering === me.id
  const isRevealing = session.state === 'REVEALING_ANSWER'
  const isRuling = session.state === 'WAITING_FOR_RULING'
  const hasAnswers = session.clueAnswers.length > 0

  // A Daily Double is announced before the wager, with nothing to play.
  if (session.state === 'REVEALING_DAILY_DOUBLE') {
    return (
      <>
        <p className="tv-heading">
          <span>{category?.name}</span>
        </p>

        <TitleCard title="Daily Double!" />

        <p className="tv-waiting">
          {me !== null && session.playerChoosingClue === me.id
            ? <span>You found it!</span>
            : (
              <>
                <span className="tv-hand">
                  {playerName(session.playerChoosingClue)}
                </span>
                <span>found it!</span>
              </>
            )}
        </p>
      </>
    )
  }

  if (isPicked) {
    return (
      <>
        <p className="tv-heading">
          <span>{category?.name}</span>
          <span className="tv-gold">{formatMoney(clue.value)}</span>
        </p>

        <p className="tv-waiting">
          <span className="tv-hand">{trebekName}</span>
          <span>is about to show the clue…</span>
        </p>
      </>
    )
  }

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
              accepted={clue.acceptedAnswers}
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

            {isRuling && (
              <p className="tv-waiting">
                <span className="tv-hand">{trebekName}</span>
                <span>
                  {me !== null && session.playerAnswering === me.id
                    ? 'is ruling on your answer…'
                    : `is ruling on ${playerName(session.playerAnswering)}'s answer…`}
                </span>
              </p>
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
