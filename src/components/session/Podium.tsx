import type { Player } from '../../api/sessions'
import { formatMoney } from '../../format'
import BuzzButton from './BuzzButton'
import ConfirmButton from './ConfirmButton'
import { BootIcon, CheckIcon } from './icons'

export const PODIUM_LIGHTS = 9

interface PodiumProps {
  player: Player
  // Shown instead of the player's score during the Final Jeopardy reveal.
  score: number
  isMe: boolean
  // Choosing, answering, wagering on a Daily Double, or being revealed.
  isActive: boolean
  // How many of the lights are on, counting down the active player's time.
  lights: number
  isLockedOut: boolean
  isLeaving: boolean
  // A short note such as "Wagered" in Final Jeopardy.
  badge: string | null
  isConnected: boolean
  canBuzz: boolean
  onBuzz: () => void
  // Only given to the host, for everyone else.
  onKick?: () => void
}

function Podium({
  player,
  score,
  isMe,
  isActive,
  lights,
  isLockedOut,
  isLeaving,
  badge,
  isConnected,
  canBuzz,
  onBuzz,
  onKick,
}: PodiumProps) {
  const classNames = [
    'podium',
    isMe && 'is-me',
    isActive && 'is-active',
    isLockedOut && 'is-locked-out',
    isLeaving && 'is-leaving',
  ].filter(Boolean).join(' ')

  // The lights go out from both ends towards the middle.
  const middle = (PODIUM_LIGHTS - 1) / 2

  return (
    <div className={classNames}>
      {(isLeaving || badge) && (
        <span className="podium-badge">
          {!isLeaving && <CheckIcon size={14} />}
          {isLeaving ? 'Leaving' : badge}
        </span>
      )}

      <div className="podium-screen">
        <span
          className={score < 0 ? 'podium-score is-negative' : 'podium-score'}
        >
          {formatMoney(score)}
        </span>
      </div>

      <div className="podium-lights" aria-hidden="true">
        {Array.from({ length: PODIUM_LIGHTS }, (_, k) => (
          <span
            key={k}
            className={Math.abs(k - middle) <= (lights - 1) / 2
              ? 'podium-light is-lit'
              : 'podium-light'}
          />
        ))}
      </div>

      <div className="podium-name-row">
        <span className="podium-screen podium-name tv-hand">{player.name}</span>

        {isMe && (
          <BuzzButton
            enabled={canBuzz}
            disabled={!isConnected}
            onBuzz={onBuzz}
          />
        )}

        {onKick && (
          <ConfirmButton
            label={`Kick ${player.name}`}
            content={<BootIcon />}
            question={`Remove ${player.name} from the game?`}
            confirmLabel="Yes, kick"
            className="kick-button"
            disabled={!isConnected}
            onConfirm={onKick}
          />
        )}
      </div>
    </div>
  )
}

export default Podium
