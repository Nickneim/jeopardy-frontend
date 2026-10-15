import { useId, useState, type FormEvent } from 'react'

interface AnswerFormProps {
  label: string
  submitLabel: string
  // Only an exact number is accepted, so typos aren't forgiven.
  numberExpected?: boolean
  onSubmit: (answer: string) => void
}

function AnswerForm({
  label,
  submitLabel,
  numberExpected = false,
  onSubmit,
}: AnswerFormProps) {
  const [answer, setAnswer] = useState('')
  const hintId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (answer.trim()) {
      onSubmit(answer.trim())
    }
  }

  const hint = numberExpected
    ? 'The answer is a number: only the exact number counts.'
    : null

  return (
    <form className="answer-form" onSubmit={handleSubmit}>
      <label>
        {label}
        <input
          value={answer}
          onChange={event => setAnswer(event.target.value)}
          autoFocus
          autoComplete="off"
          aria-describedby={hint ? hintId : undefined}
        />
      </label>

      <button type="submit" disabled={!answer.trim()}>
        {submitLabel}
      </button>

      {hint && <p id={hintId} className="answer-hint">{hint}</p>}
    </form>
  )
}

export default AnswerForm
