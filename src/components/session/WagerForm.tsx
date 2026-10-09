import { useState, type FormEvent } from 'react'
import { formatMoney } from '../../format'

interface WagerFormProps {
  min: number
  max: number
  submitLabel: string
  onSubmit: (wager: number) => void
}

function WagerForm({
  min,
  max,
  submitLabel,
  onSubmit,
}: WagerFormProps) {
  const [wager, setWager] = useState(String(min))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(Number(wager))
  }

  return (
    <form className="answer-form" onSubmit={handleSubmit}>
      <label>
        Wager ({formatMoney(min)} to {formatMoney(max)})
        <input
          type="number"
          required
          min={min}
          max={max}
          step={1}
          value={wager}
          onChange={event => setWager(event.target.value)}
          autoFocus
        />
      </label>

      <button type="submit">{submitLabel}</button>
    </form>
  )
}

export default WagerForm
