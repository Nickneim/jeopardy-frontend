import { useId, useState, type FormEvent } from 'react'
import {
  MAX_SCORE_ADJUSTMENT,
  type FinalRevealStep,
  type GameSession,
  type TrebekClue,
  type TrebekFinalJeopardy,
  type TrebekView,
} from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { formatAcceptedAnswers, formatMatchedAnswers, formatMoney } from '../../format'
import ClueMedia from '../ClueMedia'
import ClueQuestion from '../ClueQuestion'
import WagerForm from './WagerForm'

interface TrebekDeskProps {
  session: GameSession
  // Trebek's private view of this snapshot, or null before it arrives.
  view: TrebekView | null
  actions: SessionActions
}

// Trebek's controls, beside the screen everyone sees: the secrets of the
// clue in play, what the game waits for, the rulings, the clock and scores.
function TrebekDesk({ session, view, actions }: TrebekDeskProps) {
  const state = session.state

  function playerName(id: number | null): string {
    return session.players.find(player => player.id === id)?.name ?? 'Someone'
  }

  // The view can lag a moment behind the snapshot: only show its clue with
  // the clue in play.
  const clue = view?.clue && view.clue.clueId === session.currentClue?.clueId
    ? view.clue
    : null
  const pending = state === 'WAITING_FOR_RULING' &&
    view?.pendingAnswer?.playerId === session.playerAnswering
    ? view.pendingAnswer
    : null
  const amount = session.currentClue?.wager ?? session.currentClue?.value ?? 0
  const chooser = playerName(session.playerChoosingClue)
  const answering = playerName(session.playerAnswering)
  const isPlaying = state !== 'FINISHED_GAME'
  const boardLeft = session.board.some(category =>
    category.slots.some(slot => slot.status === 'AVAILABLE'))

  function step(label: string, primary = true) {
    return (
      <button
        type="button"
        className={primary ? 'tv-action is-primary' : 'tv-action'}
        onClick={actions.advance}
      >
        {label}
      </button>
    )
  }

  function ruling(note?: string) {
    return (
      <div className="trebek-ruling">
        {note && <p className="trebek-note">{note}</p>}
        <div className="trebek-buttons">
          <button
            type="button"
            className="trebek-correct"
            onClick={() => actions.rule(true)}
          >
            Correct +{formatMoney(amount)}
          </button>
          <button
            type="button"
            className="trebek-wrong"
            onClick={() => actions.rule(false)}
          >
            Wrong −{formatMoney(amount)}
          </button>
        </div>
      </div>
    )
  }

  function controls() {
    switch (state) {
      case 'ROUND_INTRO':
        return (
          <div className="trebek-buttons">
            {step(session.round === 'FINAL_JEOPARDY'
              ? 'On to the wagers'
              : 'Begin the round')}
          </div>
        )

      case 'CHOOSING_CLUE':
        return (
          <p className="trebek-note">
            <span className="tv-hand">{chooser}</span> is choosing. If they
            say it out loud, pick it for them on the board.
          </p>
        )

      case 'CLUE_PICKED':
        return (
          <>
            <p className="trebek-note">
              Read it out first if you like. The buzzers stay closed until you
              open them.
            </p>
            <div className="trebek-buttons">
              {step(clue?.dailyDouble
                ? 'Announce the Daily Double'
                : 'Show the clue to everyone')}
              <button
                type="button"
                className="tv-action"
                onClick={actions.returnClue}
              >
                Put it back
              </button>
            </div>
          </>
        )

      case 'REVEALING_DAILY_DOUBLE':
        return (
          <div className="trebek-buttons">
            {step(`Ask ${chooser} for a wager`)}
          </div>
        )

      case 'WAITING_FOR_DAILY_DOUBLE_WAGER': {
        const { minWager, maxWager } = session.currentClue ?? {}

        return (
          <>
            <p className="trebek-note">
              <span className="tv-hand">{chooser}</span> is wagering. Did they
              say it out loud? Place it for them.
            </p>
            {minWager != null && maxWager != null && (
              <WagerForm
                min={minWager}
                max={maxWager}
                label={`${chooser}’s wager`}
                submitLabel={`Wager for ${chooser}`}
                allIn
                once
                onSubmit={actions.placeDailyDoubleWager}
              />
            )}
            <div className="trebek-buttons">
              {step('Lock the lowest wager', false)}
            </div>
          </>
        )
      }

      case 'REVEALING_CLUE':
        return (
          <div className="trebek-buttons">
            {step(session.currentClue?.dailyDouble
              ? `Let ${chooser} answer`
              : 'Open the buzzers')}
          </div>
        )

      case 'WAITING_FOR_BUZZER':
        return (
          <div className="trebek-buttons">
            {step('Close the buzzers', false)}
          </div>
        )

      case 'WAITING_FOR_ANSWER':
        return (
          <>
            <p className="trebek-note">
              <span className="tv-hand">{answering}</span> is answering.
              You'll see the answer once it's submitted.
            </p>
            {ruling('Heard it out loud? You can rule now.')}
            <div className="trebek-buttons">
              {step('Close typing', false)}
            </div>
          </>
        )

      case 'WAITING_FOR_RULING':
        return (
          <>
            <div className="trebek-pending">
              <span className="tv-kicker">{answering}'s answer</span>
              {pending?.answer
                ? <strong className="tv-hand">{pending.answer}</strong>
                : <em>{pending ? 'Nothing typed' : 'Loading…'}</em>}
              {pending && <Suggestion {...pending} />}
            </div>
            {ruling()}
          </>
        )

      case 'REVEALING_ANSWER':
        return (
          <div className="trebek-buttons">
            {step(boardLeft ? 'Back to the board' : 'On to what’s next')}
          </div>
        )

      case 'FINAL_JEOPARDY_WAGERING':
      case 'FINAL_JEOPARDY_ANSWERING':
      case 'FINAL_JEOPARDY_REVEALING':
        return (
          <FinalDesk
            session={session}
            final={view?.finalJeopardy ?? null}
            actions={actions}
          />
        )

      default:
        return null
    }
  }

  return (
    <aside className="trebek-desk" aria-label="Host desk">
      <p className="trebek-desk-title">
        <span>Host desk</span>
        <span className="trebek-private">Only you see this</span>
      </p>

      {clue && <ClueCard clue={clue} />}

      {controls()}

      {/* A phase waiting for Trebek has no clock. A pause holds across
          phases, so Resume stays while paused. */}
      {isPlaying && (session.paused || session.phaseDurationMs !== null) && (
        <div className="trebek-buttons">
          <button
            type="button"
            className="tv-action"
            onClick={session.paused ? actions.resume : actions.pause}
          >
            {session.paused ? 'Resume the clock' : 'Pause the clock'}
          </button>
        </div>
      )}

      <ScoreAdjuster session={session} onAdjust={actions.adjustScore} />
    </aside>
  )
}

interface SuggestionProps {
  suggestedCorrect: boolean | null
  phrasedAsQuestion: boolean | null
  matchedAnswers: string[] | null
}

// What the answer check thinks: a suggestion, never a ruling.
function Suggestion({
  suggestedCorrect,
  phrasedAsQuestion,
  matchedAnswers,
}: SuggestionProps) {
  if (suggestedCorrect === null) {
    return null
  }

  const notes = [
    matchedAnswers && matchedAnswers.length > 0 &&
      `matches ${formatMatchedAnswers(matchedAnswers)}`,
    phrasedAsQuestion === false && 'not phrased as a question',
  ].filter(Boolean)

  return (
    <span className={suggestedCorrect ? 'trebek-suggestion is-right' : 'trebek-suggestion'}>
      {suggestedCorrect ? 'Looks right' : 'Looks wrong'}
      {notes.length > 0 && ` · ${notes.join(' · ')}`}
    </span>
  )
}

// The whole clue, before anyone else sees it.
function ClueCard({ clue }: { clue: TrebekClue }) {
  return (
    <section className="trebek-clue" aria-label="The clue">
      <p className="trebek-clue-heading">
        <span>{clue.categoryName}</span>
        <span className="tv-gold">
          {clue.dailyDouble ? 'Daily Double' : formatMoney(clue.value)}
        </span>
      </p>

      <ClueMedia clueType={clue.clueType} mediaUrl={clue.mediaUrl} />

      <p className="trebek-clue-question">
        <ClueQuestion html={clue.question} />
      </p>

      <p className="trebek-clue-answer">
        <span className="tv-kicker">Correct response</span>
        <strong>{formatAcceptedAnswers(clue.acceptedAnswers)}</strong>
        {clue.numberExpected && <em>Only the exact number counts.</em>}
      </p>
    </section>
  )
}

interface FinalDeskProps {
  session: GameSession
  final: TrebekFinalJeopardy | null
  actions: SessionActions
}

const NEXT_STEP: Record<Exclude<FinalRevealStep, 'AWARDED'>, string> = {
  HIDDEN: 'Show {name}’s wager',
  WAGER: 'Show {name}’s answer',
  ANSWER: 'Award {name}',
}

// Final Jeopardy's wagers and answers as they come in, then the rulings and
// the reveal, one step at a time.
function FinalDesk({ session, final, actions }: FinalDeskProps) {
  const state = session.state
  const isRevealing = state === 'FINAL_JEOPARDY_REVEALING'
  const publicPlayers = session.finalJeopardy?.players ?? []
  const order = session.finalJeopardy?.revealOrder ??
    publicPlayers.map(player => player.playerId)

  function playerName(id: number): string {
    return session.players.find(player => player.id === id)?.name ?? 'Someone'
  }

  function revealStep(id: number): FinalRevealStep {
    return publicPlayers.find(p => p.playerId === id)?.revealStep ?? 'HIDDEN'
  }

  const nextId = isRevealing
    ? order.find(id => revealStep(id) !== 'AWARDED') ?? null
    : null
  const nextStep = nextId === null ? null : revealStep(nextId)
  const nextRuling = final?.players.find(p => p.playerId === nextId)?.ruling ?? null
  const blocked = nextStep === 'ANSWER' && nextRuling === null

  return (
    <>
      {final && (
        <section className="trebek-clue" aria-label="Final Jeopardy">
          <p className="trebek-clue-question">
            <ClueQuestion html={final.question} />
          </p>

          <p className="trebek-clue-answer">
            <span className="tv-kicker">Correct response</span>
            <strong>{formatAcceptedAnswers(final.acceptedAnswers)}</strong>
            {final.numberExpected && <em>Only the exact number counts.</em>}
          </p>
        </section>
      )}

      <table className="trebek-final">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Wager</th>
            <th scope="col">Answer</th>
            {isRevealing && <th scope="col">Your ruling</th>}
          </tr>
        </thead>
        <tbody>
          {order.map(id => {
            const secret = final?.players.find(p => p.playerId === id)
            const step = revealStep(id)

            return (
              <tr key={id} className={id === nextId ? 'is-next' : undefined}>
                <th scope="row" className="tv-hand">{playerName(id)}</th>
                <td>{secret?.wager == null ? '—' : formatMoney(secret.wager)}</td>
                <td>
                  {state === 'FINAL_JEOPARDY_WAGERING'
                    ? '—'
                    : secret?.answer ?? <em>No answer</em>}
                  {secret && <Suggestion {...secret} />}
                </td>
                {isRevealing && (
                  <td>
                    {step === 'AWARDED'
                      ? (secret?.ruling ? 'Correct' : 'Wrong')
                      : (
                        <div className="trebek-buttons">
                          {([true, false] as const).map(correct => (
                            <button
                              key={String(correct)}
                              type="button"
                              className={[
                                correct ? 'trebek-correct' : 'trebek-wrong',
                                secret?.ruling === correct && 'is-selected',
                              ].filter(Boolean).join(' ')}
                              aria-pressed={secret?.ruling === correct}
                              onClick={() => actions.ruleFinal(id, correct)}
                            >
                              {correct ? 'Correct' : 'Wrong'}
                            </button>
                          ))}
                        </div>
                      )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="trebek-buttons">
        {state === 'FINAL_JEOPARDY_WAGERING' && (
          <button type="button" className="tv-action" onClick={actions.advance}>
            Lock the wagers
          </button>
        )}

        {state === 'FINAL_JEOPARDY_ANSWERING' && (
          <button type="button" className="tv-action" onClick={actions.advance}>
            Lock the answers
          </button>
        )}

        {isRevealing && (
          <button
            type="button"
            className="tv-action is-primary"
            disabled={blocked}
            onClick={actions.advance}
          >
            {nextId === null || nextStep === null || nextStep === 'AWARDED'
              ? 'Show the final scores'
              : NEXT_STEP[nextStep].replace('{name}', playerName(nextId))}
          </button>
        )}
      </div>

      {blocked && nextId !== null && (
        <p className="trebek-note">Rule on {playerName(nextId)}’s answer first.</p>
      )}
    </>
  )
}

interface ScoreAdjusterProps {
  session: GameSession
  onAdjust: (playerId: number, amount: number) => void
}

// Gives or takes away points, at any time once the game has started.
function ScoreAdjuster({ session, onAdjust }: ScoreAdjusterProps) {
  const players = session.players
  const [playerId, setPlayerId] = useState(players[0]?.id ?? 0)
  const [amount, setAmount] = useState('')
  const playerFieldId = useId()
  const amountFieldId = useId()

  const value = Number(amount)
  const valid = Number.isInteger(value) && value > 0 &&
    value <= MAX_SCORE_ADJUSTMENT
  const selected = players.some(player => player.id === playerId)
    ? playerId
    : players[0]?.id

  if (players.length === 0) {
    return null
  }

  function adjust(sign: 1 | -1) {
    if (valid && selected !== undefined) {
      onAdjust(selected, sign * value)
      setAmount('')
    }
  }

  return (
    <form
      className="trebek-scores"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        adjust(1)
      }}
    >
      <span className="tv-kicker">Change a score</span>

      <label htmlFor={playerFieldId} className="visually-hidden">Player</label>
      <select
        id={playerFieldId}
        value={selected}
        onChange={event => setPlayerId(Number(event.target.value))}
      >
        {players.map(player => (
          <option key={player.id} value={player.id}>
            {player.name} ({formatMoney(player.score)})
          </option>
        ))}
      </select>

      <label htmlFor={amountFieldId} className="visually-hidden">Amount</label>
      <span className="tv-money-input">
        <span aria-hidden="true">$</span>
        <input
          id={amountFieldId}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SCORE_ADJUSTMENT}
          step={1}
          value={amount}
          placeholder="200"
          onChange={event => setAmount(event.target.value)}
        />
      </span>

      <button type="submit" className="tv-action" disabled={!valid}>Give</button>
      <button
        type="button"
        className="tv-action"
        disabled={!valid}
        onClick={() => adjust(-1)}
      >
        Take away
      </button>
    </form>
  )
}

export default TrebekDesk
