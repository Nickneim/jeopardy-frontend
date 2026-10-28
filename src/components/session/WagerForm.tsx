import { useId, useState, type FormEvent } from 'react'
import { formatMoney } from '../../format'

interface WagerFormProps {
  min: number
  max: number
  // The field's label, "Your wager" by default.
  label?: string
  // What the field starts with (a wager already placed), `min` by default.
  initialWager?: number | null
  submitLabel: string
  // Adds a button that wagers the most allowed (a "true Daily Double").
  allIn?: boolean
  // Sends only once: a second click would just get an error back.
  once?: boolean
  // Said under the field, after the allowed range.
  note?: string
  onSubmit: (wager: number) => void
}

function WagerForm({
  min,
  max,
  label = 'Your wager',
  initialWager = null,
  submitLabel,
  allIn = false,
  once = false,
  note,
  onSubmit,
}: WagerFormProps) {
  const [wager, setWager] = useState(String(initialWager ?? min))
  const [sent, setSent] = useState(false)
  const inputId = useId()
  const hintId = useId()

  const isLocked = once && sent

  function send(value: number) {
    if (!isLocked) {
      setSent(true)
      onSubmit(value)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send(Number(wager))
  }

  return (
    <form className="tv-form" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="tv-form-label">{label}</label>

      <div className="tv-form-row">
        <span className="tv-money-input">
          <span aria-hidden="true">$</span>
          <input
            id={inputId}
            type="number"
            required
            min={min}
            max={max}
            step={1}
            value={wager}
            onChange={event => setWager(event.target.value)}
            readOnly={isLocked}
            aria-describedby={hintId}
            autoFocus
          />
        </span>

        {allIn && (
          <button
            type="button"
            className="is-secondary"
            disabled={isLocked}
            onClick={() => {
              setWager(String(max))
              send(max)
            }}
          >
            All in · {formatMoney(max)}
          </button>
        )}

        <button type="submit" disabled={isLocked}>{submitLabel}</button>
      </div>

      <p id={hintId} className="tv-form-hint">
        Between {formatMoney(min)} and {formatMoney(max)}
        {note && ` · ${note}`}
      </p>
    </form>
  )
}

export default WagerForm
