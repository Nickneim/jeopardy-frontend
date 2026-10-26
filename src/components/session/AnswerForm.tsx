import { useId, useState, type FormEvent } from 'react'
import { MAX_ANSWER_LENGTH } from '../../api/sessions'

interface AnswerFormProps {
  label: string
  submitLabel: string
  // What the field starts with, e.g. an answer already sent.
  initialAnswer?: string
  // Only an exact number is accepted, so typos aren't forgiven.
  numberExpected?: boolean
  // Written by hand, like Final Jeopardy responses on the show.
  handwritten?: boolean
  // Sends only once: a second Enter would just get an error back.
  once?: boolean
  onSubmit: (answer: string) => void
}

function AnswerForm({
  label,
  submitLabel,
  initialAnswer = '',
  numberExpected = false,
  handwritten = false,
  once = false,
  onSubmit,
}: AnswerFormProps) {
  const [answer, setAnswer] = useState(initialAnswer)
  const [sent, setSent] = useState(false)
  const inputId = useId()
  const hintId = useId()

  const isLocked = once && sent

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (answer.trim() && !isLocked) {
      setSent(true)
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
          readOnly={isLocked}
          autoFocus
          autoComplete="off"
          aria-describedby={hint ? hintId : undefined}
        />

        <button type="submit" disabled={!answer.trim() || isLocked}>
          {submitLabel}
        </button>
      </div>

      {hint && <p id={hintId} className="answer-hint">{hint}</p>}
    </form>
  )
}

export default AnswerForm
