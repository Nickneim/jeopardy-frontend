import type { ClueType } from '../../api/clues'
import { mediaLabel } from './board'
import { MediaIcon, StarIcon } from './icons'

interface MediaBadgeProps {
  clueType: ClueType
}

// A clue with media, whose link is often broken in imported games. Shown in
// blind mode too.
export function MediaBadge({ clueType }: MediaBadgeProps) {
  if (clueType === 'TEXT') {
    return null
  }

  return (
    <span
      className="custom-badge is-media"
      title={`${mediaLabel(clueType)} clue: its media link may be broken`}
    >
      <MediaIcon clueType={clueType} />
      {mediaLabel(clueType)}
    </span>
  )
}

interface ClueBadgesProps {
  clue: {
    clueType?: ClueType
    dailyDouble?: boolean
    custom: boolean
  }
}

// A clue's Daily Double, media and Custom badges.
function ClueBadges({ clue }: ClueBadgesProps) {
  return (
    <span className="custom-badges">
      {clue.dailyDouble && (
        <span className="custom-badge is-daily-double">
          <StarIcon size={12} filled />
          Daily Double
        </span>
      )}
      {clue.clueType && <MediaBadge clueType={clue.clueType} />}
      {clue.custom && <span className="custom-badge is-custom">Custom</span>}
    </span>
  )
}

export default ClueBadges
