import { useId, useState, type FormEvent } from 'react'
import { MAX_ANSWER_LENGTH } from '../../api/sessions'

interface AnswerFormProps {
  label: string
  submitLabel: string
  // Only an exact number is accepted, so typos aren't forgiven.
  numberExpected?: boolean
  // Written by hand, like Final Jeopardy responses on the show.
  handwritten?: boolean
  onSubmit: (answer: string) => void
}

function AnswerForm({
  label,
  submitLabel,
  numberExpected = false,
  handwritten = false,
  onSubmit,
}: AnswerFormProps) {
  const [answer, setAnswer] = useState('')
  const inputId = useId()
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
    <form className="tv-form" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="tv-form-label">{label}</label>

      <div className="tv-form-row">
        <input
          id={inputId}
          className={handwritten ? 'is-hand' : 'is-serif'}
          value={answer}
          onChange={event => setAnswer(event.target.value)}
          maxLength={MAX_ANSWER_LENGTH}
          autoFocus
          autoComplete="off"
          aria-describedby={hint ? hintId : undefined}
        />

        <button type="submit" disabled={!answer.trim()}>
          {submitLabel}
        </button>
      </div>

      {hint && <p id={hintId} className="answer-hint">{hint}</p>}
    </form>
  )
}

export default AnswerForm
