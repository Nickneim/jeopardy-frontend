import { useId } from 'react'
import {
  DEFAULT_TIMERS,
  MAX_TIMER_MS,
  MIN_TIMER_MS,
  type SessionTimerModes,
  type SessionTimers,
  type TimerMode,
} from '../../api/sessions'

// In the order the phases come up in a game.
const TIMER_LABELS: Record<keyof SessionTimers, string> = {
  roundIntroMs: 'Round title card',
  clueChoiceMs: 'Choosing a clue',
  clueRevealMs: 'Clue reveal',
  dailyDoubleRevealMs: 'Daily Double announcement',
  dailyDoubleWagerMs: 'Daily Double wager',
  buzzerMs: 'Buzzer',
  answerMs: 'Answer',
  answerRevealMs: 'Answer reveal',
  finalJeopardyWagerMs: 'Final Jeopardy wager',
  finalJeopardyAnswerMs: 'Final Jeopardy answer',
  finalJeopardyRevealMs: 'Final Jeopardy reveal, per player',
}

// What happens in a Trebek game when the phase ends on its own, and what it
// waits for when Trebek runs it.
const MODE_HINTS: Record<keyof SessionTimers, Record<TimerMode, string>> = {
  roundIntroMs: { AUTOMATIC: 'Then the round begins', TREBEK: 'Until you begin the round' },
  clueChoiceMs: { AUTOMATIC: 'Then a clue is picked for them', TREBEK: 'No limit · you can pick for them' },
  clueRevealMs: { AUTOMATIC: 'Then the buzzers open', TREBEK: 'Until you open the buzzers' },
  dailyDoubleRevealMs: { AUTOMATIC: 'Then the wager starts', TREBEK: 'Until you start the wager' },
  dailyDoubleWagerMs: { AUTOMATIC: 'Then the lowest wager locks', TREBEK: 'Until you lock the wager' },
  buzzerMs: { AUTOMATIC: 'Then nobody buzzed', TREBEK: 'Until you close the buzzers' },
  answerMs: { AUTOMATIC: 'Then typing closes · you still rule', TREBEK: 'Until you rule' },
  answerRevealMs: { AUTOMATIC: 'Then back to the board', TREBEK: 'Until you go back to the board' },
  finalJeopardyWagerMs: { AUTOMATIC: 'Then wagers lock', TREBEK: 'Until you lock wagers' },
  finalJeopardyAnswerMs: { AUTOMATIC: 'Then answers lock · you still rule', TREBEK: 'Until you lock answers' },
  finalJeopardyRevealMs: { AUTOMATIC: 'Split over their wager, answer and award · waits for your rulings', TREBEK: 'You reveal each player' },
}

const TIMER_FIELDS = Object.keys(TIMER_LABELS) as (keyof SessionTimers)[]

interface TimerSettingsProps {
  timers: SessionTimers
  // A Trebek game's timer modes; null in a classic game, where every timer
  // is automatic.
  modes?: SessionTimerModes | null
  canEdit: boolean
  onSave: (timers: Partial<SessionTimers>) => void
  onSaveModes?: (modes: Partial<SessionTimerModes>) => void
}

function TimerSettings({
  timers,
  modes = null,
  canEdit,
  onSave,
  onSaveModes,
}: TimerSettingsProps) {
  const idPrefix = useId()

  function waitsForTrebek(field: keyof SessionTimers): boolean {
    return modes?.[field] === 'TREBEK'
  }

  // Saves one field when the host leaves it, kept within the backend's
  // bounds. An empty or unreadable value goes back to the saved one.
  function saveField(field: keyof SessionTimers, input: HTMLInputElement) {
    const seconds = Number(input.value)

    if (input.value.trim() === '' || !Number.isFinite(seconds)) {
      input.value = String(timers[field] / 1000)
      return
    }

    const ms = Math.min(
      MAX_TIMER_MS,
      Math.max(MIN_TIMER_MS, Math.round(seconds * 1000)),
    )
    input.value = String(ms / 1000)

    if (ms !== timers[field]) {
      onSave({ [field]: ms })
    }
  }

  if (!canEdit) {
    return (
      <section className="timer-settings">
        <h2>Timers</h2>

        <dl>
          {TIMER_FIELDS.map(field => (
            <div key={field}>
              <dt>{TIMER_LABELS[field]}</dt>
              <dd>
                {waitsForTrebek(field)
                  ? 'Waits for Trebek'
                  : `${timers[field] / 1000}s`}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }

  return (
    <section className="timer-settings">
      <h2>Timers (seconds)</h2>

      <p className="timer-settings-note">
        Changes are saved as soon as you leave a field.
        {modes && ' Automatic runs the clock; Trebek waits for you.'}
      </p>

      <div className="timer-fields">
        {TIMER_FIELDS.map(field => (
          <div key={field} className="timer-field">
            <label htmlFor={`${idPrefix}-${field}`}>
              {TIMER_LABELS[field]}
            </label>

            {modes && (
              <div
                className="timer-mode"
                role="group"
                aria-label={`${TIMER_LABELS[field]} mode`}
              >
                {(['AUTOMATIC', 'TREBEK'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    className={modes[field] === mode ? 'is-selected' : undefined}
                    aria-pressed={modes[field] === mode}
                    onClick={() => {
                      if (modes[field] !== mode) {
                        onSaveModes?.({ [field]: mode })
                      }
                    }}
                  >
                    {mode === 'AUTOMATIC' ? 'Automatic' : 'Trebek'}
                  </button>
                ))}
              </div>
            )}

            {modes && (
              <span className="timer-mode-hint">
                {MODE_HINTS[field][modes[field]]}
              </span>
            )}

            {waitsForTrebek(field)
              ? <span className="timer-no-clock">No clock</span>
              : (
                <div className="timer-input">
                  {/* Remounts when the saved value changes, to show it. */}
                  <input
                    key={timers[field]}
                    id={`${idPrefix}-${field}`}
                    type="number"
                    name={field}
                    min={MIN_TIMER_MS / 1000}
                    max={MAX_TIMER_MS / 1000}
                    step="any"
                    defaultValue={timers[field] / 1000}
                    onBlur={event => saveField(field, event.currentTarget)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur()
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="timer-reset"
                    aria-label={`Reset ${TIMER_LABELS[field]} to the default, ${DEFAULT_TIMERS[field] / 1000}s`}
                    title={`Reset to the default (${DEFAULT_TIMERS[field] / 1000}s)`}
                    disabled={timers[field] === DEFAULT_TIMERS[field]}
                    onClick={() => onSave({ [field]: DEFAULT_TIMERS[field] })}
                  >
                    <span aria-hidden="true">↺</span>
                  </button>
                </div>
              )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default TimerSettings
