import { clueAnswersRound, type GameSession, type Player } from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { formatCorrectResponse, formatMoney } from '../../format'
import ClueMedia from '../ClueMedia'
import AnswerForm from './AnswerForm'
import BuzzButton from './BuzzButton'
import ClueAnswers from './ClueAnswers'
import WagerForm from './WagerForm'

const MIN_DAILY_DOUBLE_WAGER = 5

interface CluePanelProps {
  session: GameSession
  me: Player | null
  actions: SessionActions
}

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

  const isLockedOut = me !== null && session.playersLockedOut.includes(me.id)
  const canBuzz = me !== null &&
    session.state === 'WAITING_FOR_BUZZER' &&
    !isLockedOut
  const isMyWager = me !== null &&
    session.state === 'WAITING_FOR_DAILY_DOUBLE_WAGER' &&
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

  return (
    <section className="clue-panel">
      <p className="clue-panel-heading">
        {category?.name}
        {' — '}
        {clue.dailyDouble && clue.wager !== null
          ? `Daily Double, wager ${formatMoney(clue.wager)}`
          : formatMoney(clue.value)}
      </p>

      {clue.dailyDouble && (
        <p className="daily-double-banner">Daily Double!</p>
      )}

      {category?.comments && (
        <p className="category-comments">{category.comments}</p>
      )}

      <ClueMedia clueType={clue.clueType} mediaUrl={clue.mediaUrl} />

      {clue.question && (
        <p
          className="clue-question"
          dangerouslySetInnerHTML={{ __html: clue.question }}
        />
      )}

      <ClueAnswers
        answers={session.clueAnswers}
        players={session.players}
        round={clueAnswersRound(session)}
        me={me}
      />

      {session.state === 'REVEALING_ANSWER' && clue.answer && (
        <p className="clue-answer">
          Correct response: {formatCorrectResponse(clue.answer)}
        </p>
      )}

      {isMyWager && (
        <WagerForm
          min={MIN_DAILY_DOUBLE_WAGER}
          max={maxDailyDoubleWager}
          submitLabel="Place wager"
          onSubmit={actions.placeDailyDoubleWager}
        />
      )}

      {session.state === 'WAITING_FOR_DAILY_DOUBLE_WAGER' && !isMyWager && (
        <p>{playerName(session.playerChoosingClue)} is placing a wager…</p>
      )}

      {me && !clue.dailyDouble &&
        (session.state === 'REVEALING_CLUE' ||
          session.state === 'WAITING_FOR_BUZZER') && (
        <BuzzButton enabled={canBuzz} onBuzz={actions.buzz} />
      )}

      {isLockedOut && session.state === 'WAITING_FOR_BUZZER' && (
        <p>You already buzzed on this clue.</p>
      )}

      {isMyAnswer && (
        <AnswerForm
          label="Your answer"
          submitLabel="Answer"
          numberExpected={clue.numberExpected === true}
          onSubmit={actions.answer}
        />
      )}

      {session.state === 'WAITING_FOR_ANSWER' && !isMyAnswer && (
        <p>{playerName(session.playerAnswering)} is answering…</p>
      )}
    </section>
  )
}

export default CluePanel
