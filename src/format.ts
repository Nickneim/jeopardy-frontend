import type { GameRound } from './api/sessions'

export function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US')}`
}

export const ROUND_NAMES: Record<GameRound, string> = {
  JEOPARDY: 'Jeopardy!',
  DOUBLE_JEOPARDY: 'Double Jeopardy!',
  FINAL_JEOPARDY: 'Final Jeopardy!',
}
