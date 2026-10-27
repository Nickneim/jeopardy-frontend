import type { AcceptedAnswers, GameRound } from './api/sessions'

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
// (api.md §6.7). For the browsing pages, whose clues come without
// acceptedAnswers: live games show those instead.
export function formatCorrectResponse(answer: string): string {
  const list = ANSWER_LIST.exec(answer)

  if (!list) {
    return answer
  }

  return formatAcceptedAnswers({
    required: Number(list[1]),
    options: list[2].split('|').map(option => option.trim()),
  })
}

// A live clue's accepted answers (api.md §6.7): one option as it is, a list
// as "A or B", "A, B and C" or "Any 2 of: A, B, C".
export function formatAcceptedAnswers({ required, options }: AcceptedAnswers): string {
  if (required <= 1) {
    return joinWords(options, 'or')
  }

  if (required >= options.length) {
    return joinWords(options, 'and')
  }

  return `Any ${required} of: ${options.join(', ')}`
}

// What a correct answer named (matchedAnswers): "myrrh and gold".
export function formatMatchedAnswers(matched: string[]): string {
  return joinWords(matched, 'and')
}

// A list's options the player didn't name (alsoAccepted): "Uruguay or Argentina".
export function formatAlsoAccepted(alsoAccepted: string[]): string {
  return joinWords(alsoAccepted, 'or')
}

function joinWords(words: string[], conjunction: string): string {
  if (words.length === 1) {
    return words[0]
  }

  return `${words.slice(0, -1).join(', ')} ${conjunction} ${words[words.length - 1]}`
}

// A game's air date ("2024-07-26") as "Jul 26, 2024", the same in every time
// zone.
export function formatAirDate(gameDate: string): string {
  const date = new Date(`${gameDate}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) {
    return gameDate
  }

  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
