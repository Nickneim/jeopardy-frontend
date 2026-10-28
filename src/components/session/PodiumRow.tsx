import { useEffect, useRef, type ReactNode } from 'react'
import type { Player, Trebek } from '../../api/sessions'
import Podium from './Podium'

// Up to this many players share the row; with more, yours stays on the left
// and the others scroll.
const MAX_FITTING = 4
// The edge fade over the last visible podium.
const FADE_PX = 64

interface PodiumRowProps {
  players: Player[]
  me: Player | null
  // A Trebek game's host, on their own lectern at the left.
  trebek?: Trebek | null
  activeId: number | null
  lights: number
  lockedOut: number[]
  badges: Map<number, string>
  // What a leaving player's badge says.
  leavingLabel: string
  // New scores during the Final Jeopardy reveal.
  scores: Map<number, number>
  // Buzzing and kicking wait for the live connection.
  isConnected: boolean
  canBuzz: boolean
  onBuzz: () => void
  // Only given to the host.
  onKick?: (player: Player) => void
  // The buttons on the right: join, share, leave.
  actions: ReactNode
}

function PodiumRow({
  players,
  me,
  trebek = null,
  activeId,
  lights,
  lockedOut,
  badges,
  leavingLabel,
  scores,
  isConnected,
  canBuzz,
  onBuzz,
  onKick,
  actions,
}: PodiumRowProps) {
  const scrollerRef = useRef<HTMLUListElement>(null)

  const scrolls = players.length > MAX_FITTING
  const mine = players.find(player => player.id === me?.id) ?? null
  const others = players.filter(player => player !== mine)
  const pinned = scrolls ? mine : null
  const listed = pinned ? others : [...(mine ? [mine] : []), ...others]

  // Slide the active player (who buzzed, say) into view, only as far as
  // needed and only when they aren't fully visible.
  useEffect(() => {
    const scroller = scrollerRef.current

    if (!scrolls || activeId === null || !scroller ||
      scroller.scrollWidth <= scroller.clientWidth) {
      return
    }

    const slot = scroller.querySelector<HTMLElement>(
      `[data-player-id="${activeId}"]`)

    if (!slot) {
      return
    }

    const left = slot.offsetLeft
    const right = left + slot.offsetWidth
    const visibleRight = scroller.scrollLeft + scroller.clientWidth - FADE_PX

    if (left < scroller.scrollLeft) {
      scroller.scrollTo({ left, behavior: 'smooth' })
    } else if (right > visibleRight) {
      scroller.scrollTo({
        left: right - scroller.clientWidth + FADE_PX,
        behavior: 'smooth',
      })
    }
  }, [scrolls, activeId])

  function renderPodium(player: Player) {
    return (
      <Podium
        player={player}
        score={scores.get(player.id) ?? player.score}
        isMe={player === mine}
        isActive={player.id === activeId}
        lights={player.id === activeId ? lights : 0}
        isLockedOut={lockedOut.includes(player.id)}
        isLeaving={player.leaving}
        leavingLabel={leavingLabel}
        isAway={player.away}
        badge={badges.get(player.id) ?? null}
        isConnected={isConnected}
        canBuzz={canBuzz}
        onBuzz={onBuzz}
        onKick={onKick && player !== mine && !player.leaving
          ? () => onKick(player)
          : undefined}
      />
    )
  }

  return (
    <div className="podium-row">
      <div className="podium-area">
        {trebek && (
          <>
            <div
              role="group"
              className={trebek.away ? 'trebek-lectern is-away' : 'trebek-lectern'}
              aria-label={`Your host, ${trebek.name}${trebek.away ? ' (away)' : ''}`}
            >
              {trebek.away && <span className="podium-badge">Away</span>}
              <span className="tv-kicker">Your host</span>
              <span className="trebek-lectern-name tv-hand">{trebek.name}</span>
            </div>
            <div className="podium-divider" aria-hidden="true" />
          </>
        )}

        {pinned && (
          <>
            <div className="podium-pinned">{renderPodium(pinned)}</div>
            <div className="podium-divider" aria-hidden="true" />
          </>
        )}

        <ul
          ref={scrollerRef}
          className={scrolls ? 'podium-list is-scrolling' : 'podium-list'}
          aria-label="Players"
        >
          {listed.map(player => (
            <li
              key={player.id}
              className="podium-slot"
              data-player-id={player.id}
            >
              {renderPodium(player)}
            </li>
          ))}
        </ul>
      </div>

      <div className="podium-actions">{actions}</div>
    </div>
  )
}

export default PodiumRow
