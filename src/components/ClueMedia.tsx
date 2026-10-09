import type { ClueType } from '../api/clues'

interface ClueMediaProps {
  clueType: ClueType | null
  mediaUrl: string | null
}

function ClueMedia({
  clueType,
  mediaUrl,
}: ClueMediaProps) {
  if (!mediaUrl) {
    return null
  }

  switch (clueType) {
    case 'IMAGE':
      return <img src={mediaUrl} alt="" />
    case 'VIDEO':
      return <video controls src={mediaUrl} />
    case 'SOUND':
      return <audio controls src={mediaUrl} />
    default:
      return null
  }
}

export default ClueMedia
