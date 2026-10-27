import type { ClueType } from '../../api/clues'
import type {
  BoardRound,
  CategoryPosition,
  CluePosition,
  CustomGameProblem,
  CustomGameProblemCode,
} from '../../api/customShows'
import type { GameRound } from '../../api/sessions'

// What's being dragged on the board.
export type DragItem =
  | { kind: 'clue', position: CluePosition }
  | { kind: 'category', position: CategoryPosition }

// Where a drag can go: a clue to another row of its own column, a category
// onto any other category.
export function canDrop(item: DragItem, target: DragItem): boolean {
  const from = item.position
  const to = target.position
  const sameColumn = from.round === to.round && from.column === to.column

  if (item.kind === 'clue' && target.kind === 'clue') {
    return sameColumn && item.position.row !== target.position.row
  }

  return item.kind === 'category' && target.kind === 'category' && !sameColumn
}

// Element ids, so a problem in the list can scroll to its place.
export function categoryElementId(round: GameRound, column: number): string {
  return `custom-${round.toLowerCase()}-${column}`
}

export function clueElementId(round: BoardRound, column: number, row: number): string {
  return `custom-${round.toLowerCase()}-${column}-${row}`
}

export const SHOW_NAME_ID = 'custom-show-name'

// The element a problem points at.
export function problemElementId(problem: CustomGameProblem): string {
  const { round, column, row } = problem

  if (round === null) {
    return SHOW_NAME_ID
  }

  if (round === 'FINAL_JEOPARDY' || column === null) {
    return `custom-${round.toLowerCase()}`
  }

  return row === null
    ? categoryElementId(round, column - 1)
    : clueElementId(round, column - 1, row - 1)
}

const PROBLEM_LABELS: Record<CustomGameProblemCode, string> = {
  NO_CLUES: 'No clues',
  SHOW_NAME_MISSING: 'No name',
  SHOW_NAME_TOO_LONG: 'Name too long',
  CATEGORY_NAME_MISSING: 'No name',
  CATEGORY_NAME_TOO_LONG: 'Name too long',
  FINAL_CLUE_MISSING: 'No clue',
  QUESTION_MISSING: 'No clue',
  QUESTION_TOO_LONG: 'Clue too long',
  ANSWER_MISSING: 'No response',
  ANSWER_TOO_LONG: 'Response too long',
  ANSWER_UNREADABLE: 'Response',
  MEDIA_URL_MISSING: 'No link',
  MEDIA_URL_INVALID: 'Media link',
  MEDIA_URL_NOT_ALLOWED: 'Media link',
  TOO_MANY_DAILY_DOUBLES: 'Daily Doubles',
}

// A few words for the marker on the board; the message says the rest.
export function problemLabel(code: CustomGameProblemCode): string {
  return PROBLEM_LABELS[code]
}

const MEDIA_LABELS: Record<ClueType, string> = {
  TEXT: 'Text',
  IMAGE: 'Image',
  VIDEO: 'Video',
  SOUND: 'Sound',
}

export function mediaLabel(clueType: ClueType): string {
  return MEDIA_LABELS[clueType]
}
