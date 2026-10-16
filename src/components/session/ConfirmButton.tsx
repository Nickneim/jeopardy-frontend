import { useState } from 'react'

interface ConfirmButtonProps {
  label: string
  // Asked on the page before acting, or null to act at once.
  question: string | null
  confirmLabel: string
  className?: string
  onConfirm: () => void
}

// A button that asks on the page instead of with window.confirm, which some
// browsers (such as embedded ones) answer with false without showing it.
function ConfirmButton({
  label,
  question,
  confirmLabel,
  className,
  onConfirm,
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming && question) {
    return (
      <span className="confirm-prompt" role="group" aria-label={question}>
        {question}{' '}
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            onConfirm()
          }}
        >
          {confirmLabel}
        </button>{' '}
        <button type="button" autoFocus onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => (question ? setConfirming(true) : onConfirm())}
    >
      {label}
    </button>
  )
}

export default ConfirmButton
