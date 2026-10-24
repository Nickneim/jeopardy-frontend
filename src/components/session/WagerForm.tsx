import { useId, useState, type FormEvent } from 'react'
import { formatMoney } from '../../format'

interface WagerFormProps {
  min: number
  max: number
  submitLabel: string
  // Adds a button that wagers the most allowed (a "true Daily Double").
  allIn?: boolean
  // Said under the field, after the allowed range.
  note?: string
  onSubmit: (wager: number) => void
}

function WagerForm({
  min,
  max,
  submitLabel,
  allIn = false,
  note,
  onSubmit,
}: WagerFormProps) {
  const [wager, setWager] = useState(String(min))
  const inputId = useId()
  const hintId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(Number(wager))
  }

  return (
    <form className="tv-form" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="tv-form-label">Your wager</label>

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
            aria-describedby={hintId}
            autoFocus
          />
        </span>

        {allIn && (
          <button
            type="button"
            className="is-secondary"
            onClick={() => {
              setWager(String(max))
              onSubmit(max)
            }}
          >
            All in · {formatMoney(max)}
          </button>
        )}

        <button type="submit">{submitLabel}</button>
      </div>

      <p id={hintId} className="tv-form-hint">
        Between {formatMoney(min)} and {formatMoney(max)}
        {note && ` · ${note}`}
      </p>
    </form>
  )
}

export default WagerForm
