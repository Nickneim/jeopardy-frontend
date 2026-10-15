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

const ANSWER_LIST = /^\s*\((\d+) of\)\s*(.*)$/s

// Correct responses write alternatives and lists as "(N of) A | B | C"
// (api.md §6.7). Shows them as "A or B", "A, B and C" or "Any 2 of: A, B, C".
export function formatCorrectResponse(answer: string): string {
  const list = ANSWER_LIST.exec(answer)

  if (!list) {
    return answer
  }

  const needed = Number(list[1])
  const options = list[2].split('|').map(option => option.trim())

  if (needed <= 1) {
    return joinWords(options, 'or')
  }

  if (needed >= options.length) {
    return joinWords(options, 'and')
  }

  return `Any ${needed} of: ${options.join(', ')}`
}

function joinWords(words: string[], conjunction: string): string {
  if (words.length === 1) {
    return words[0]
  }

  return `${words.slice(0, -1).join(', ')} ${conjunction} ${words[words.length - 1]}`
}
