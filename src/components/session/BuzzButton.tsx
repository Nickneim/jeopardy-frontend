import { useEffect } from 'react'

interface BuzzButtonProps {
  enabled: boolean
  onBuzz: () => void
}

function BuzzButton({
  enabled,
  onBuzz,
}: BuzzButtonProps) {
  // The space bar buzzes too, unless the player is typing somewhere.
  useEffect(() => {
    if (!enabled) {
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
  }, [enabled, onBuzz])

  return (
    <button
      type="button"
      className="buzz-button"
      disabled={!enabled}
      onClick={onBuzz}
    >
      Buzz <kbd>Space</kbd>
    </button>
  )
}

export default BuzzButton
