import { useState, type FormEvent } from 'react'

interface AnswerFormProps {
  label: string
  submitLabel: string
  onSubmit: (answer: string) => void
}

function AnswerForm({
  label,
  submitLabel,
  onSubmit,
}: AnswerFormProps) {
  const [answer, setAnswer] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (answer.trim()) {
      onSubmit(answer.trim())
    }
  }

  return (
    <form className="answer-form" onSubmit={handleSubmit}>
      <label>
        {label}
        <input
          value={answer}
          onChange={event => setAnswer(event.target.value)}
          autoFocus
          autoComplete="off"
        />
      </label>

      <button type="submit" disabled={!answer.trim()}>
        {submitLabel}
      </button>
    </form>
  )
}

export default AnswerForm
