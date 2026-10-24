import type { ReactNode } from 'react'

// Small stroke icons for the live game's buttons. Decorative: the buttons
// carry their own text or aria-label.

interface IconProps {
  size?: number
}

function Icon({
  size = 20,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function BootIcon({ size = 22 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M7 3h6v8.5l5.2 2.1A3 3 0 0 1 20 16.4V18H4v-4.5L7 12z" />
      <path d="M4 21h16" />
      <path d="M13 7h-3" />
    </Icon>
  )
}

export function JoinIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-1a6 6 0 0 1 12 0v1" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </Icon>
  )
}

export function LinkIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </Icon>
  )
}

export function LeaveIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Icon>
  )
}

export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 12.5l5 5L20 6.5" strokeWidth="3" />
    </Icon>
  )
}

export function CrossIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M6 6l12 12" strokeWidth="3" />
      <path d="M18 6L6 18" strokeWidth="3" />
    </Icon>
  )
}
