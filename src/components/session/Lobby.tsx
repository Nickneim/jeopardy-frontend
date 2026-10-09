import { useState } from 'react'

interface LobbyProps {
  playerCount: number
  canStart: boolean
  onStart: () => void
}

function Lobby({
  playerCount,
  canStart,
  onStart,
}: LobbyProps) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="lobby">
      <p>
        Invite players by sharing this page's link.{' '}
        <button type="button" onClick={copyLink}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </p>

      {canStart
        ? (
          <button
            type="button"
            className="primary-button"
            disabled={playerCount === 0}
            onClick={onStart}
          >
            Start game
          </button>
        )
        : <p>Waiting for a player to start the game…</p>}
    </section>
  )
}

export default Lobby
