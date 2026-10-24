import { useState, type ReactNode } from 'react'

interface ConfirmButtonProps {
  label: string
  // Shown in the button instead of the label (an icon, say). The label
  // then names the button for screen readers.
  content?: ReactNode
  // Asked on the page before acting, or null to act at once.
  question: string | null
  confirmLabel: string
  className?: string
  disabled?: boolean
  onConfirm: () => void
}

// A button that asks on the page instead of with window.confirm, which some
// browsers (such as embedded ones) answer with false without showing it.
function ConfirmButton({
  label,
  content,
  question,
  confirmLabel,
  className,
  disabled = false,
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
      disabled={disabled}
      aria-label={content ? label : undefined}
      title={content ? label : undefined}
      onClick={() => (question ? setConfirming(true) : onConfirm())}
    >
      {content ?? label}
    </button>
  )
}

export default ConfirmButton
