import { useEffect } from 'react'

interface BuzzButtonProps {
  enabled: boolean
  // Not connected yet: a buzz would be lost.
  disabled?: boolean
  onBuzz: () => void
}

// The red button on the player's own podium. It can always be pressed, like
// a real buzzer, but only buzzes while the buzzers are open.
function BuzzButton({
  enabled,
  disabled = false,
  onBuzz,
}: BuzzButtonProps) {
  // The space bar buzzes too, unless the player is typing somewhere.
  useEffect(() => {
    if (!enabled || disabled) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTyping = target?.closest('input, textarea, select, button')

      if (event.code === 'Space' && !event.repeat && !isTyping) {
        event.preventDefault()
        onBuzz()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, disabled, onBuzz])

  return (
    <button
      type="button"
      className="buzz-button"
      aria-label="Buzz in"
      title="Buzz in (Space)"
      disabled={disabled}
      onClick={() => {
        if (enabled) {
          onBuzz()
        }
      }}
    />
  )
}

export default BuzzButton
