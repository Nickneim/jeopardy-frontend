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
  onSave: (timers: Partial<SessionTimers>) => void
}

function TimerSettings({
  timers,
  canEdit,
  onSave,
}: TimerSettingsProps) {
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
              <dd>{timers[field] / 1000}s</dd>
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
      </p>

      <div className="timer-fields">
        {TIMER_FIELDS.map(field => (
          <label key={field}>
            {TIMER_LABELS[field]}
            {/* Remounts when the saved value changes, to show it. */}
            <input
              key={timers[field]}
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
          </label>
        ))}
      </div>
    </section>
  )
}

export default TimerSettings
