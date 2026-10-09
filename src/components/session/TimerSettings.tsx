import type { FormEvent } from 'react'
import {
  MAX_TIMER_MS,
  MIN_TIMER_MS,
  type SessionTimers,
} from '../../api/sessions'

const TIMER_LABELS: Record<keyof SessionTimers, string> = {
  clueChoiceMs: 'Choosing a clue',
  clueRevealMs: 'Clue reveal',
  dailyDoubleWagerMs: 'Daily Double wager',
  buzzerMs: 'Buzzer',
  answerMs: 'Answer',
  answerRevealMs: 'Answer reveal',
  finalJeopardyWagerMs: 'Final Jeopardy wager',
  finalJeopardyAnswerMs: 'Final Jeopardy answer',
  finalJeopardyRevealMs: 'Final Jeopardy reveal',
}

const TIMER_FIELDS = Object.keys(TIMER_LABELS) as (keyof SessionTimers)[]

interface TimerSettingsProps {
  timers: SessionTimers
  canEdit: boolean
  onSave: (timers: SessionTimers) => void
}

function TimerSettings({
  timers,
  canEdit,
  onSave,
}: TimerSettingsProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const updated = { ...timers }

    for (const field of TIMER_FIELDS) {
      updated[field] = Math.round(Number(formData.get(field)) * 1000)
    }

    onSave(updated)
  }

  if (!canEdit) {
    return (
      <section className="timer-settings">
        <h2>Timers</h2>

        <dl>
          {TIMER_FIELDS.map(field => (
            <div key={field}>
              <dt>{TIMER_LABELS[field]}</dt>
              <dd>{timers[field] / 1000}s</dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }

  // Remounts when the timers change, so the inputs show the saved values.
  return (
    <form
      key={JSON.stringify(timers)}
      className="timer-settings"
      onSubmit={handleSubmit}
    >
      <h2>Timers (seconds)</h2>

      <div className="timer-fields">
        {TIMER_FIELDS.map(field => (
          <label key={field}>
            {TIMER_LABELS[field]}
            <input
              type="number"
              name={field}
              required
              min={MIN_TIMER_MS / 1000}
              max={MAX_TIMER_MS / 1000}
              step="any"
              defaultValue={timers[field] / 1000}
            />
          </label>
        ))}
      </div>

      <button type="submit">Save timers</button>
    </form>
  )
}

export default TimerSettings
