import type { ClueType } from '../../api/clues'
import { Icon, type IconProps } from '../session/icons'

// The custom show editor's stroke icons, drawn like the live game's.
// Decorative: the buttons carry their own text or aria-label.

export function GripIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" strokeWidth="3" />
    </Icon>
  )
}

export function ImportIcon({ size = 18 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Icon>
  )
}

export function UploadIcon({ size = 18 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />
    </Icon>
  )
}

export function TrashIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
  )
}

export function PlusIcon({ size = 18 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function StarIcon({ size = 20, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  )
}

export function UndoIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
    </Icon>
  )
}

export function RedoIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />
    </Icon>
  )
}

export function SearchIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </Icon>
  )
}

export function MediaIcon({ clueType, size = 14 }: IconProps & { clueType: ClueType }) {
  switch (clueType) {
    case 'IMAGE':
      return (
        <Icon size={size}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="M21 16l-5-5-8 8" />
        </Icon>
      )
    case 'VIDEO':
      return (
        <Icon size={size}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M10 9l5 3-5 3z" />
        </Icon>
      )
    case 'SOUND':
      return (
        <Icon size={size}>
          <path d="M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
        </Icon>
      )
    default:
      return null
  }
}
