import { redirect, type ActionFunctionArgs } from 'react-router'
import type { ClueType } from './clues'
import { hasErrorCode } from './errors'
import type { Game, GameCategory } from './games'
import {
  cleanPlayerName,
  createSession,
  hostNameError,
  joinAsPlayer,
  type GameRound,
} from './sessions'
import { formatAirDate } from '../format'

// ---------- The backend's custom show (api.md §3.2, "Custom shows") ----------

export interface CustomGameRequest {
  name: string
  jeopardyRound: CustomCategoryRequest[]
  doubleJeopardyRound: CustomCategoryRequest[]
  finalJeopardy: CustomFinalJeopardyRequest | null
}

export interface CustomCategoryRequest {
  // 1–6, unique in the round.
  column: number
  // Null for a category that was never named.
  name: string | null
  comments: string | null
  sourceCategoryId: number | null
  // Empty rows are left out.
  clues: CustomClueRequest[]
}

export interface CustomClueRequest {
  // 1–5: the value follows the row.
  row: number
  question: string
  answer: string
  clueType: ClueType
  mediaUrl: string | null
  dailyDouble: boolean
}

// All blank is the same as no Final Jeopardy.
export interface CustomFinalJeopardyRequest {
  name: string | null
  comments: string | null
  question: string | null
  answer: string | null
}

export type CustomGameProblemCode =
  | 'NO_CLUES'
  | 'SHOW_NAME_MISSING'
  | 'SHOW_NAME_TOO_LONG'
  | 'CATEGORY_NAME_MISSING'
  | 'CATEGORY_NAME_TOO_LONG'
  | 'FINAL_CLUE_MISSING'
  | 'QUESTION_MISSING'
  | 'QUESTION_TOO_LONG'
  | 'ANSWER_MISSING'
  | 'ANSWER_TOO_LONG'
  | 'ANSWER_UNREADABLE'
  | 'MEDIA_URL_MISSING'
  | 'MEDIA_URL_INVALID'
  | 'MEDIA_URL_NOT_ALLOWED'
  | 'TOO_MANY_DAILY_DOUBLES'

// One reason a custom show was refused, at the request's column and row.
export interface CustomGameProblem {
  code: CustomGameProblemCode
  // Null: the whole show.
  round: GameRound | null
  // 1–6. Null: the whole round, or Final Jeopardy.
  column: number | null
  // 1–5. Null: the whole category.
  row: number | null
  // English, ready to show.
  message: string
}

// ---------- The draft the editor keeps ----------

export type BoardRound = 'JEOPARDY' | 'DOUBLE_JEOPARDY'

export const BOARD_ROUNDS: readonly BoardRound[] = ['JEOPARDY', 'DOUBLE_JEOPARDY']
export const COLUMNS = 6
export const ROWS = 5

// Pinned by the host, never added at random (api.md §3.2, rule 8).
export const MAX_DAILY_DOUBLES: Record<BoardRound, number> = {
  JEOPARDY: 1,
  DOUBLE_JEOPARDY: 2,
}

export interface DraftClue {
  // Sent as written, HTML tags included: the editor shows them as text.
  question: string
  answer: string
  clueType: ClueType
  // As typed. Null for a TEXT clue.
  mediaUrl: string | null
  dailyDouble: boolean
  // Written or changed here, rather than imported as it was.
  custom: boolean
}

export interface DraftCategory {
  // Null until the host names it: it then shows its default name.
  name: string | null
  comments: string | null
  // The stored category it was imported from, so it can't be imported twice.
  sourceCategoryId: number | null
  // Where it was imported from, such as "Show #8612 · Mar 4, 2022".
  source: string | null
  // One per row, null for an empty one.
  clues: (DraftClue | null)[]
}

export interface DraftFinal {
  name: string | null
  comments: string | null
  sourceCategoryId: number | null
  source: string | null
  question: string
  answer: string
  custom: boolean
}

export interface Draft {
  name: string
  rounds: Record<BoardRound, DraftCategory[]>
  final: DraftFinal
}

export interface CategoryPosition {
  round: BoardRound
  // 0-based.
  column: number
}

export interface CluePosition extends CategoryPosition {
  // 0-based.
  row: number
}

export function emptyCategory(): DraftCategory {
  return {
    name: null,
    comments: null,
    sourceCategoryId: null,
    source: null,
    clues: Array.from({ length: ROWS }, () => null),
  }
}

export function emptyFinal(): DraftFinal {
  return {
    name: null,
    comments: null,
    sourceCategoryId: null,
    source: null,
    question: '',
    answer: '',
    custom: false,
  }
}

export function emptyDraft(): Draft {
  return {
    name: '',
    rounds: {
      JEOPARDY: Array.from({ length: COLUMNS }, emptyCategory),
      DOUBLE_JEOPARDY: Array.from({ length: COLUMNS }, emptyCategory),
    },
    final: emptyFinal(),
  }
}

// "Category #1" to "#12", numbered across both rounds by position, so no two
// default names are the same.
export function defaultCategoryName({ round, column }: CategoryPosition): string {
  const offset = round === 'DOUBLE_JEOPARDY' ? COLUMNS : 0
  return `Category #${offset + column + 1}`
}

export function categoryName(
  category: DraftCategory,
  position: CategoryPosition,
): string {
  return category.name?.trim() || defaultCategoryName(position)
}

export const FINAL_DEFAULT_NAME = 'Final Jeopardy! category'

export function clueValue(round: BoardRound, row: number): number {
  return (row + 1) * (round === 'JEOPARDY' ? 200 : 400)
}

export const BOARD_SIZE = BOARD_ROUNDS.length * COLUMNS * ROWS + 1

export function hasFinalClue(final: DraftFinal): boolean {
  return Boolean(final.question.trim() || final.answer.trim())
}

export function clueCount(draft: Draft): number {
  const boardClues = BOARD_ROUNDS
    .flatMap(round => draft.rounds[round])
    .flatMap(category => category.clues)
    .filter(clue => clue !== null).length

  return boardClues + (hasFinalClue(draft.final) ? 1 : 0)
}

export function dailyDoubleCount(categories: DraftCategory[]): number {
  return categories
    .flatMap(category => category.clues)
    .filter(clue => clue?.dailyDouble).length
}

// Whether there's nothing on the board worth asking before replacing it.
export function isEmptyDraft(draft: Draft): boolean {
  const named = (category: { name: string | null }) => Boolean(category.name?.trim())

  return clueCount(draft) === 0 &&
    !draft.name.trim() &&
    !named(draft.final) &&
    !BOARD_ROUNDS.some(round => draft.rounds[round].some(named))
}

// The stored categories already on the board, which can't be imported again.
export function importedCategoryIds(draft: Draft): Set<number> {
  const ids = [
    ...BOARD_ROUNDS.flatMap(round => draft.rounds[round]),
    draft.final,
  ].map(category => category.sourceCategoryId)

  return new Set(ids.filter(id => id !== null))
}

// ---------- Edits: each returns a new draft ----------

export function updateCategory(
  draft: Draft,
  { round, column }: CategoryPosition,
  update: (category: DraftCategory) => DraftCategory,
): Draft {
  return {
    ...draft,
    rounds: {
      ...draft.rounds,
      [round]: draft.rounds[round].map((category, index) =>
        index === column ? update(category) : category),
    },
  }
}

export function setClue(
  draft: Draft,
  position: CluePosition,
  clue: DraftClue | null,
): Draft {
  return updateCategory(draft, position, category => ({
    ...category,
    clues: category.clues.map((current, row) =>
      row === position.row ? clue : current),
  }))
}

// Clues only move within their column, taking the value of their new row.
export function swapClues(
  draft: Draft,
  position: CategoryPosition,
  rowA: number,
  rowB: number,
): Draft {
  return updateCategory(draft, position, category => {
    const clues = [...category.clues]
    ;[clues[rowA], clues[rowB]] = [clues[rowB], clues[rowA]]
    return { ...category, clues }
  })
}

// Categories trade places with their clues, in either round.
export function swapCategories(
  draft: Draft,
  a: CategoryPosition,
  b: CategoryPosition,
): Draft {
  const first = draft.rounds[a.round][a.column]
  const second = draft.rounds[b.round][b.column]

  return updateCategory(
    updateCategory(draft, a, () => second),
    b,
    () => first,
  )
}

export function toggleDailyDouble(draft: Draft, position: CluePosition): Draft {
  const clue = draft.rounds[position.round][position.column].clues[position.row]

  return clue
    ? setClue(draft, position, { ...clue, dailyDouble: !clue.dailyDouble })
    : draft
}

// Where a game came from, as the editor shows it.
export function gameSource(game: Pick<Game, 'title' | 'gameDate'>): string {
  const show = game.title.split(' - ')[0]
  return `${show} · ${formatAirDate(game.gameDate)}`
}

// Fills a category with a stored one's clues, each on its own row.
export function importCategory(
  draft: Draft,
  position: CategoryPosition,
  imported: GameCategory,
  source: string,
): Draft {
  return updateCategory(draft, position, () => ({
    name: imported.name,
    comments: imported.comments,
    sourceCategoryId: imported.id,
    source,
    clues: Array.from({ length: ROWS }, (_, row) => {
      const clue = imported.clues.find(clue => clue.rowNumber === row + 1)

      return clue
        ? {
          question: clue.question,
          answer: clue.answer,
          clueType: clue.clueType,
          mediaUrl: clue.clueType === 'TEXT' ? null : clue.mediaUrl,
          dailyDouble: false,
          custom: false,
        }
        : null
    }),
  }))
}

export function importFinal(
  draft: Draft,
  imported: GameCategory,
  source: string,
): Draft {
  const clue = imported.clues[0]

  return {
    ...draft,
    final: {
      name: imported.name,
      comments: imported.comments,
      sourceCategoryId: imported.id,
      source,
      question: clue?.question ?? '',
      answer: clue?.answer ?? '',
      custom: false,
    },
  }
}

// ---------- Hosting ----------

function blankToNull(text: string | null): string | null {
  return text?.trim() ? text : null
}

// A link as the backend wants it: spaces and other characters a URL can't
// hold are encoded, and what's already encoded stays as it is.
export function mediaLink(url: string | null): string | null {
  const trimmed = url?.trim()

  if (!trimmed) {
    return null
  }

  try {
    return new URL(trimmed).href
  } catch {
    // Not a URL: the backend says so (MEDIA_URL_INVALID).
    return trimmed
  }
}

function categoryRequest(
  category: DraftCategory,
  column: number,
): CustomCategoryRequest {
  return {
    column: column + 1,
    name: blankToNull(category.name),
    comments: category.comments,
    sourceCategoryId: category.sourceCategoryId,
    clues: category.clues.flatMap((clue, row) => clue
      ? [{
        row: row + 1,
        question: clue.question,
        answer: clue.answer,
        clueType: clue.clueType,
        mediaUrl: clue.clueType === 'TEXT' ? null : mediaLink(clue.mediaUrl),
        dailyDouble: clue.dailyDouble,
      }]
      : []),
  }
}

// The draft as the backend takes it. Columns and rows are the board's own,
// so the problems it reports point back at the same places. An unnamed
// category without clues is left out: there's nothing to show.
export function customGameRequest(draft: Draft): CustomGameRequest {
  const round = (categories: DraftCategory[]) => categories
    .map(categoryRequest)
    .filter(category => category.name !== null || category.clues.length > 0)

  const final = draft.final
  const finalJeopardy: CustomFinalJeopardyRequest = {
    name: blankToNull(final.name),
    comments: final.comments,
    question: blankToNull(final.question),
    answer: blankToNull(final.answer),
  }
  const hasFinal = finalJeopardy.name !== null ||
    finalJeopardy.question !== null ||
    finalJeopardy.answer !== null

  return {
    name: draft.name,
    jeopardyRound: round(draft.rounds.JEOPARDY),
    doubleJeopardyRound: round(draft.rounds.DOUBLE_JEOPARDY),
    finalJeopardy: hasFinal ? finalJeopardy : null,
  }
}

// What a problem is about in the draft: the show's name, a round, a
// category's name, a clue or Final Jeopardy. Edits make new objects, so it's
// unchanged exactly while the host hasn't touched it.
function problemTarget(draft: Draft, problem: CustomGameProblem): unknown {
  const { round, column, row, code } = problem

  if (round === null) {
    return code === 'NO_CLUES' ? clueCount(draft) > 0 : draft.name
  }

  if (round === 'FINAL_JEOPARDY') {
    return draft.final
  }

  const categories = draft.rounds[round]

  if (column === null) {
    return dailyDoubleCount(categories)
  }

  const category = categories[column - 1]

  if (!category) {
    return undefined
  }

  return row === null ? category.name : category.clues[row - 1]
}

// The problems still worth showing: those whose place hasn't been edited
// since the show was refused.
export function openProblems(
  problems: CustomGameProblem[],
  refused: Draft,
  current: Draft,
): CustomGameProblem[] {
  return problems.filter(problem =>
    Object.is(problemTarget(refused, problem), problemTarget(current, problem)))
}

export interface HostCustomShowRequest {
  playerName: string
  game: CustomGameRequest
}

export interface HostCustomShowData {
  error: string
  // Why the backend refused the show, to mark on the board.
  problems?: CustomGameProblem[]
}

// Creates the session from the board and joins it as the host, like hosting
// a stored game. The editor posts the board as JSON.
export async function customShowAction({
  request,
}: ActionFunctionArgs): Promise<HostCustomShowData | Response> {
  const body = await request.json() as HostCustomShowRequest
  const playerName = cleanPlayerName(String(body.playerName ?? ''))
  const nameError = hostNameError(playerName)

  if (nameError) {
    return { error: nameError }
  }

  let id: string

  try {
    ({ id } = await createSession({ customGame: body.game }))
  } catch (error) {
    if (hasErrorCode(error, 'INVALID_CUSTOM_GAME')) {
      return { error: error.message, problems: error.problems }
    }

    throw error
  }

  return await joinAsPlayer(id, playerName) ?? redirect(`/sessions/${id}`)
}

// ---------- Keeping the draft ----------

// One draft per browser, back after closing the tab.
const DRAFT_KEY = 'jeopardy.customShow'
const BLIND_KEY = 'jeopardy.customShow.blind'

export function loadDraft(): Draft {
  try {
    const stored = localStorage.getItem(DRAFT_KEY)
    return (stored && readDraft(JSON.parse(stored))) || emptyDraft()
  } catch {
    return emptyDraft()
  }
}

export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Without storage, the draft only lasts until the tab closes.
  }
}

export function loadBlind(): boolean {
  try {
    return localStorage.getItem(BLIND_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveBlind(blind: boolean) {
  try {
    localStorage.setItem(BLIND_KEY, String(blind))
  } catch {
    // It's just off again next time.
  }
}

// ---------- Files ----------

const FILE_FORMAT = 'jeopardy-custom-show'
const FILE_VERSION = 1

export interface ShowFile {
  format: typeof FILE_FORMAT
  version: typeof FILE_VERSION
  show: Draft
}

export function showFile(draft: Draft): ShowFile {
  return { format: FILE_FORMAT, version: FILE_VERSION, show: draft }
}

// A name to save the file under, from the show's name.
export function showFileName(draft: Draft): string {
  const slug = draft.name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${slug || 'custom-show'}.json`
}

// The draft in an exported file, or null when it isn't one.
export function readShowFile(text: string): Draft | null {
  try {
    const file = JSON.parse(text) as Partial<ShowFile> | null

    if (file?.format !== FILE_FORMAT || file.version !== FILE_VERSION) {
      return null
    }

    return readDraft(file.show)
  } catch {
    return null
  }
}

const CLUE_TYPES: readonly ClueType[] = ['TEXT', 'IMAGE', 'SOUND', 'VIDEO']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readOptionalText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readId(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function readClue(value: unknown): DraftClue | null {
  if (!isRecord(value)) {
    return null
  }

  const clueType = CLUE_TYPES.includes(value.clueType as ClueType)
    ? value.clueType as ClueType
    : 'TEXT'

  return {
    question: readText(value.question),
    answer: readText(value.answer),
    clueType,
    mediaUrl: clueType === 'TEXT' ? null : readText(value.mediaUrl),
    dailyDouble: value.dailyDouble === true,
    custom: value.custom === true,
  }
}

function readCategory(value: unknown): DraftCategory {
  if (!isRecord(value)) {
    return emptyCategory()
  }

  const clues = Array.isArray(value.clues) ? value.clues : []

  return {
    name: readOptionalText(value.name),
    comments: readOptionalText(value.comments),
    sourceCategoryId: readId(value.sourceCategoryId),
    source: readOptionalText(value.source),
    clues: Array.from({ length: ROWS }, (_, row) => readClue(clues[row])),
  }
}

// A draft from storage or a file, checked field by field: anything missing
// or of the wrong type is left empty. Null when it isn't a draft at all.
export function readDraft(value: unknown): Draft | null {
  if (!isRecord(value) || !isRecord(value.rounds)) {
    return null
  }

  const rounds = value.rounds
  const round = (categories: unknown) => Array.from({ length: COLUMNS },
    (_, column) => readCategory(Array.isArray(categories) ? categories[column] : null))
  const final = isRecord(value.final) ? value.final : {}

  return {
    name: readText(value.name),
    rounds: {
      JEOPARDY: round(rounds.JEOPARDY),
      DOUBLE_JEOPARDY: round(rounds.DOUBLE_JEOPARDY),
    },
    final: {
      name: readOptionalText(final.name),
      comments: readOptionalText(final.comments),
      sourceCategoryId: readId(final.sourceCategoryId),
      source: readOptionalText(final.source),
      question: readText(final.question),
      answer: readText(final.answer),
      custom: final.custom === true,
    },
  }
}
