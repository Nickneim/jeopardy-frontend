import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'
import { get, post, put } from './client'
import type { ClueType } from './clues'
import type { CustomGameRequest } from './customShows'
import { hasErrorCode } from './errors'
import { getRandomGame, type PageResponse } from './games'
import { pageParam, redirectPastLastPage } from './paging'
import { sortParams, type ListSort } from './listSort'
import { normalizeSessionCode, randomSessionCode } from '../sessionCode'

export type GameRound = 'JEOPARDY' | 'DOUBLE_JEOPARDY' | 'FINAL_JEOPARDY'

export type GameSessionState =
  | 'WAITING_FOR_START'
  | 'CHOOSING_CLUE'
  // Trebek sessions: a clue was chosen and Trebek hasn't shown it.
  | 'CLUE_PICKED'
  | 'WAITING_FOR_DAILY_DOUBLE_WAGER'
  | 'REVEALING_CLUE'
  | 'WAITING_FOR_BUZZER'
  | 'WAITING_FOR_ANSWER'
  // Trebek sessions: the answer is in and Trebek hasn't ruled.
  | 'WAITING_FOR_RULING'
  | 'REVEALING_ANSWER'
  | 'FINAL_JEOPARDY_WAGERING'
  | 'FINAL_JEOPARDY_ANSWERING'
  | 'FINAL_JEOPARDY_REVEALING'
  | 'FINISHED_GAME'
  // Only in a removed session's last broadcast.
  | 'CLOSED'

export type SessionCloseReason =
  | 'ABANDONED'
  | 'IDLE'
  | 'FINISHED'
  // Trebek left during the game, which ends it.
  | 'TREBEK_LEFT'

// TREBEK: the host runs the show instead of playing (api.md §6.8).
export type HostMode = 'CONTESTANT' | 'TREBEK'
// TREBEK: the phase has no timer and waits for Trebek's advance.
export type TimerMode = 'AUTOMATIC' | 'TREBEK'

export type GameErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'NOT_YOUR_TURN'
  | 'INVALID_STATE'
  // A moment too late (someone else buzzed first, time ran out): not a bug.
  | 'TOO_LATE'
  | 'CLUE_NOT_FOUND'
  | 'CLUE_ALREADY_PLAYED'
  | 'PLAYER_NOT_IN_SESSION'
  | 'INVALID_WAGER'
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'NOT_HOST'
  | 'PLAYER_NOT_FOUND'
  | 'INTERNAL_ERROR'

// The host running a Trebek session. Never in `players`.
export interface Trebek {
  // Also the session's hostPlayerId.
  id: number
  name: string
  away: boolean
}

export interface Player {
  id: number
  name: string
  score: number
  // Left (or was kicked) but still holds a role, removed when it ends; or
  // left from the Final Jeopardy reveal on, staying in the results.
  leaving: boolean
  // No open connection: closed tab, lost network, or not connected yet.
  away: boolean
}

// Limits on what players type, in Unicode code points ([...text].length),
// as the backend counts them.
export const MAX_NAME_LENGTH = 30
export const MAX_ANSWER_LENGTH = 200

export function textLength(text: string): number {
  return [...text].length
}

// A name as the backend cleans it before checking it: spaces and zero-width
// spaces (U+200B, U+2060, U+FEFF) removed at both ends.
const NAME_EDGES = /^[\s\u200B\u2060\uFEFF]+|[\s\u200B\u2060\uFEFF]+$/g

export function cleanPlayerName(name: string): string {
  return name.replace(NAME_EDGES, '')
}

// Phase durations in milliseconds.
export interface SessionTimers {
  clueChoiceMs: number
  clueRevealMs: number
  dailyDoubleWagerMs: number
  buzzerMs: number
  answerMs: number
  answerRevealMs: number
  finalJeopardyWagerMs: number
  finalJeopardyAnswerMs: number
  finalJeopardyRevealMs: number
}

// Which phases wait for Trebek, keyed like SessionTimers.
export type SessionTimerModes = Record<keyof SessionTimers, TimerMode>

// Every session starts with these (api.md §6.8).
export const DEFAULT_TIMER_MODES: SessionTimerModes = {
  clueChoiceMs: 'AUTOMATIC',
  clueRevealMs: 'TREBEK',
  dailyDoubleWagerMs: 'TREBEK',
  buzzerMs: 'AUTOMATIC',
  answerMs: 'AUTOMATIC',
  answerRevealMs: 'TREBEK',
  finalJeopardyWagerMs: 'AUTOMATIC',
  finalJeopardyAnswerMs: 'AUTOMATIC',
  finalJeopardyRevealMs: 'TREBEK',
}

export const MIN_TIMER_MS = 1000
export const MAX_TIMER_MS = 300000

// Every session starts with these (api.md §6.3).
export const DEFAULT_TIMERS: SessionTimers = {
  clueChoiceMs: 30000,
  clueRevealMs: 3000,
  dailyDoubleWagerMs: 30000,
  buzzerMs: 10000,
  answerMs: 15000,
  answerRevealMs: 3000,
  finalJeopardyWagerMs: 30000,
  finalJeopardyAnswerMs: 30000,
  finalJeopardyRevealMs: 10000,
}

export type ClueSlotStatus = 'AVAILABLE' | 'PLAYED' | 'EMPTY'

export interface ClueSlot {
  row: number
  clueId: number | null
  value: number | null
  status: ClueSlotStatus
}

export interface BoardCategory {
  name: string
  comments: string | null
  slots: ClueSlot[]
}

export interface CurrentClue {
  clueId: number
  value: number
  // Null in CLUE_PICKED, so the board doesn't give a Daily Double away.
  dailyDouble: boolean | null
  wager: number | null
  // The chooser's allowed wager, only while wagering on a Daily Double.
  minWager: number | null
  maxWager: number | null
  question: string | null
  clueType: ClueType | null
  mediaUrl: string | null
  // Only an exact number is accepted (api.md §6.7). Hidden like `question`.
  numberExpected: boolean | null
  // Written as in api.md §6.7. Show acceptedAnswers instead.
  answer: string | null
  // Revealed with `answer`, ready to show (formatAcceptedAnswers).
  acceptedAnswers: AcceptedAnswers | null
}

// A correct response names `required` of the options, each in one wording.
// Anything but a list has a single option.
export interface AcceptedAnswers {
  required: number
  options: string[]
}

export interface ClueAnswer {
  playerId: number
  answer: string | null
  correct: boolean
  // Set in every round, null when the player ran out of time (api.md §6.7).
  phrasedAsQuestion: boolean | null
  // Correct answers only: what it named, in the wording the player matched.
  matchedAnswers: string[] | null
  // Correct answers only: a list's options it didn't name, [] if not a list.
  alsoAccepted: string[] | null
  // `correct` is Trebek's ruling. In a Trebek session the two fields above
  // are only set when the ruling is correct and the check matched it.
  ruledByTrebek: boolean
}

// How far a player's Final Jeopardy reveal has got in a Trebek session:
// their wager is shown from WAGER, their answer from ANSWER, and once
// AWARDED their result, already applied to their score.
export type FinalRevealStep = 'HIDDEN' | 'WAGER' | 'ANSWER' | 'AWARDED'

export interface FinalJeopardyPlayer {
  playerId: number
  // A missing wager still counts as 0.
  hasWagered: boolean
  hasAnswered: boolean
  // The most they can wager, only in FINAL_JEOPARDY_WAGERING.
  maxWager: number | null
  wager: number | null
  answer: string | null
  correct: boolean | null
  // Revealed with `correct`, null without an answer.
  phrasedAsQuestion: boolean | null
  // Revealed, correct answers only (as in ClueAnswer).
  matchedAnswers: string[] | null
  alsoAccepted: string[] | null
  // Trebek sessions, from FINAL_JEOPARDY_REVEALING on.
  revealStep: FinalRevealStep | null
}

export interface FinalJeopardy {
  category: string
  categoryComments: string | null
  question: string | null
  // Only an exact number is accepted (api.md §6.7). Null while wagering.
  numberExpected: boolean | null
  // Written as in api.md §6.7. Show acceptedAnswers instead.
  answer: string | null
  // Revealed with `answer`, ready to show (formatAcceptedAnswers).
  acceptedAnswers: AcceptedAnswers | null
  players: FinalJeopardyPlayer[]
  // Trebek sessions, from FINAL_JEOPARDY_REVEALING on: the player ids in the
  // order they're revealed.
  revealOrder: number[] | null
}

export interface GameSession {
  id: string
  version: number
  round: GameRound
  state: GameSessionState
  closeReason: SessionCloseReason | null
  phaseDurationMs: number | null
  // Frozen while `paused`.
  phaseRemainingMs: number | null
  // Trebek stopped the clock: don't count down.
  paused: boolean
  timers: SessionTimers
  // Only matter in a Trebek session.
  timerModes: SessionTimerModes
  hostMode: HostMode
  // Null in a CONTESTANT session.
  trebek: Trebek | null
  // Whether players can join after the start. Only the host changes it,
  // before the start.
  allowLateJoin: boolean
  // The score a player who joins now starts with, never above 0.
  joinScore: number
  // Never Trebek.
  players: Player[]
  // trebek.id in a Trebek session.
  hostPlayerId: number | null
  playerChoosingClue: number | null
  playerAnswering: number | null
  playersLockedOut: number[]
  board: BoardCategory[]
  currentClue: CurrentClue | null
  clueAnswers: ClueAnswer[]
  finalJeopardy: FinalJeopardy | null
}

// The round `clueAnswers` were given in. They stay on screen in the next
// CHOOSING_CLUE, so right after Jeopardy ends they still belong to the Jeopardy
// round while `round` is already Double Jeopardy: no clue played on the board
// yet means they're from the previous round.
export function clueAnswersRound(session: GameSession): GameRound {
  const nothingPlayed = !session.board.some(category =>
    category.slots.some(slot => slot.status === 'PLAYED'))

  return session.round === 'DOUBLE_JEOPARDY' && nothingPlayed
    ? 'JEOPARDY'
    : session.round
}

export function isTrebek(
  session: GameSession,
  playerId: number | undefined,
): boolean {
  return session.trebek !== null && session.trebek.id === playerId
}

// Whether this player leaving closes the session: nobody else is still
// playing, or Trebek leaves during the game, which ends it. Trebek can wait
// alone in the lobby, and a finished game's results stay until it times out.
export function leavingClosesSession(
  session: GameSession,
  playerId: number | undefined,
): boolean {
  const state = session.state
  const othersStay = session.players
    .some(p => p.id !== playerId && !p.leaving)

  if (state === 'FINISHED_GAME') {
    return false
  }

  if (isTrebek(session, playerId)) {
    return state !== 'WAITING_FOR_START' || !othersStay
  }

  return !othersStay && !(state === 'WAITING_FOR_START' && session.trebek)
}

// What the host can change in the lobby, at least one of them.
export interface UpdateSettingsRequest {
  allowLateJoin?: boolean
  hostMode?: HostMode
  timerModes?: Partial<SessionTimerModes>
}

// ---------- Trebek's private view (/user/queue/trebek, api.md §6.8) ----------

// The clue in play, from CLUE_PICKED until its answer reveal ends.
export interface TrebekClue {
  clueId: number
  value: number
  dailyDouble: boolean
  categoryName: string
  question: string
  clueType: ClueType
  mediaUrl: string | null
  numberExpected: boolean
  // Written as in api.md §6.7. Show acceptedAnswers instead.
  answer: string
  acceptedAnswers: AcceptedAnswers
}

// In WAITING_FOR_RULING: what the answering player submitted.
export interface TrebekPendingAnswer {
  playerId: number
  // Null: nothing was submitted.
  answer: string | null
  // What a CONTESTANT session would have scored.
  suggestedCorrect: boolean
  phrasedAsQuestion: boolean | null
  // Only when suggestedCorrect.
  matchedAnswers: string[] | null
}

export interface TrebekFinalPlayer {
  playerId: number
  // Null while wagering until they wager; then 0 if they didn't.
  wager: number | null
  answer: string | null
  // Null until there's an answer or answering closes.
  suggestedCorrect: boolean | null
  phrasedAsQuestion: boolean | null
  matchedAnswers: string[] | null
  // Null: Trebek hasn't ruled yet.
  ruling: boolean | null
}

export interface TrebekFinalJeopardy {
  question: string
  answer: string
  acceptedAnswers: AcceptedAnswers
  numberExpected: boolean
  players: TrebekFinalPlayer[]
}

// The secrets only Trebek sees, for the snapshot with the same version.
export interface TrebekView {
  version: number
  clue: TrebekClue | null
  pendingAnswer: TrebekPendingAnswer | null
  finalJeopardy: TrebekFinalJeopardy | null
}

// adjust-score's limit, either way, per call.
export const MAX_SCORE_ADJUSTMENT = 100000

// Whether a join would be accepted now, like the live games list's
// `joinable`: never once Final Jeopardy's wagering is over (api.md §6.6).
export function isJoinable(session: GameSession): boolean {
  switch (session.state) {
    case 'WAITING_FOR_START':
      return true
    case 'FINAL_JEOPARDY_ANSWERING':
    case 'FINAL_JEOPARDY_REVEALING':
    case 'FINISHED_GAME':
    case 'CLOSED':
      return false
    default:
      return session.allowLateJoin
  }
}

export interface GameSessionError {
  code: GameErrorCode
  message: string
}

export interface GameSessionSummary {
  id: string
  // Null for a custom show, whose gameTitle is the show's name.
  gameId: number | null
  gameTitle: string | null
  // A board built in the custom show editor rather than a stored game.
  custom: boolean
  // Clues on the board, all rounds and Final Jeopardy.
  clueCount: number
  // The game's season and air date ("YYYY-MM-DD"), null without a game.
  gameSeason: string | null
  gameDate: string | null
  state: GameSessionState
  round: GameRound
  // Players who haven't left, never Trebek.
  playerCount: number
  // Trebek's name in a Trebek session.
  hostName: string | null
  // TREBEK: the host runs the show, marked in the list.
  hostMode: HostMode
  createdAt: string
  // Whether a join would be accepted right now.
  joinable: boolean
  allowLateJoin: boolean
  joinScore: number
}

export interface JoinedPlayer {
  playerId: number
  token: string
}

// Every request about one session carries ?session=<its id>. With several
// backend instances, the load balancer routes by it to the instance that
// holds the session; a single instance ignores it.
function routedTo(id: string) {
  return { session: id }
}

const CREATE_ATTEMPTS = 5

// A session is created from a stored game or a custom show, never both.
export type CreateSessionRequest =
  | { gameId: number }
  | { customGame: CustomGameRequest }

// The client picks the new session's code, so the create can already be
// routed by it. A 409 means another session has that code: pick another.
export async function createSession(
  body: CreateSessionRequest,
): Promise<{ id: string }> {
  for (let attempt = 1; ; attempt++) {
    const id = randomSessionCode()

    try {
      return await put<{ id: string }>(
        `/game-sessions/${id}`,
        body,
        routedTo(id),
      )
    } catch (error) {
      const taken = hasErrorCode(error, 'SESSION_ALREADY_EXISTS')

      if (!taken || attempt === CREATE_ATTEMPTS) {
        throw error
      }
    }
  }
}

// Where a live game is, as the live games list shows, filters and sorts it
// (in this order): the lobby, a round in progress, or finished. The backend
// derives it the same way.
export type SessionStage = 'LOBBY' | GameRound | 'FINISHED'

export const SESSION_STAGES: readonly SessionStage[] = [
  'LOBBY',
  'JEOPARDY',
  'DOUBLE_JEOPARDY',
  'FINAL_JEOPARDY',
  'FINISHED',
]

export function sessionStage(session: GameSessionSummary): SessionStage {
  switch (session.state) {
    case 'WAITING_FOR_START':
      return 'LOBBY'
    case 'FINISHED_GAME':
    case 'CLOSED':
      return 'FINISHED'
    default:
      return session.round
  }
}

export interface SessionFilters {
  // Part of the game's title or the host's name.
  search?: string
  stage?: SessionStage
  joinable?: boolean
  includeFinished?: boolean
}

export const SESSION_SORT_COLUMNS = [
  'id',
  'gameTitle',
  'gameSeason',
  'gameDate',
  'hostName',
  'playerCount',
  'stage',
  'createdAt',
] as const

export type SessionSortColumn = typeof SESSION_SORT_COLUMNS[number]

export type SessionSort = ListSort<SessionSortColumn>

// The backend's own order: newest first.
export const DEFAULT_SESSION_SORT: SessionSort = {
  sort: 'createdAt',
  direction: 'desc',
}

export function getSessions(
  page = 0,
  size = 20,
  filters: SessionFilters = {},
  sort: SessionSort = DEFAULT_SESSION_SORT,
): Promise<PageResponse<GameSessionSummary>> {
  return get<PageResponse<GameSessionSummary>>('/game-sessions', {
    page,
    size,
    search: filters.search,
    stage: filters.stage,
    joinable: filters.joinable ? 'true' : undefined,
    // Without it, the backend leaves finished games out.
    includeFinished: filters.includeFinished ? 'true' : undefined,
    ...sort,
  })
}

export function getSession(id: string): Promise<GameSession> {
  return get<GameSession>(`/game-sessions/${id}`, routedTo(id))
}

export function joinSession(
  id: string,
  playerName: string,
): Promise<JoinedPlayer> {
  return post<JoinedPlayer>(
    `/game-sessions/${id}/players`,
    { playerName },
    routedTo(id),
  )
}

// The token is a secret that proves who the player is. It's kept so a
// refresh reconnects as the same player, and only ever sent in the STOMP
// CONNECT header.
function storageKey(sessionId: string): string {
  return `jeopardy.session.${sessionId}`
}

export function getStoredPlayer(sessionId: string): JoinedPlayer | null {
  try {
    const stored = localStorage.getItem(storageKey(sessionId))
    return stored ? JSON.parse(stored) as JoinedPlayer : null
  } catch {
    return null
  }
}

function storePlayer(sessionId: string, player: JoinedPlayer) {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(player))
  } catch {
    // Without storage the player still plays, but can't survive a refresh.
  }
}

// The last name used to host or join, to fill in the next time.
const PLAYER_NAME_KEY = 'jeopardy.playerName'

export function getRememberedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberPlayerName(playerName: string) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, playerName)
  } catch {
    // The form just starts empty next time.
  }
}

export function forgetPlayer(sessionId: string) {
  try {
    localStorage.removeItem(storageKey(sessionId))
    localStorage.removeItem(finalJeopardyKey(sessionId))
  } catch {
    // Nothing to forget.
  }
}

// The server hides Final Jeopardy wagers and answers until the reveal, so
// the player's own are kept here to show them back, even after a refresh.
export interface SentFinalJeopardy {
  wager: number | null
  answer: string | null
}

interface StoredFinalJeopardy extends SentFinalJeopardy {
  playerId: number
}

function finalJeopardyKey(sessionId: string): string {
  return `jeopardy.finalJeopardy.${sessionId}`
}

export function getSentFinalJeopardy(
  sessionId: string,
  playerId: number,
): SentFinalJeopardy {
  try {
    const stored = localStorage.getItem(finalJeopardyKey(sessionId))
    const sent = stored ? JSON.parse(stored) as StoredFinalJeopardy : null

    // Someone who left and rejoined is a new player with nothing sent.
    if (sent?.playerId === playerId) {
      return { wager: sent.wager, answer: sent.answer }
    }
  } catch {
    // Fall through: nothing sent that we know of.
  }

  return { wager: null, answer: null }
}

export function rememberSentFinalJeopardy(
  sessionId: string,
  playerId: number,
  sent: SentFinalJeopardy,
) {
  try {
    localStorage.setItem(
      finalJeopardyKey(sessionId),
      JSON.stringify({ playerId, ...sent }),
    )
  } catch {
    // Without storage it's only lost on a refresh.
  }
}

const PAGE_SIZE = 20

export interface SessionsLoaderData {
  sessions: PageResponse<GameSessionSummary>
  filters: SessionFilters
  sort: SessionSort
}

// The list's filters from the URL: `search`, `stage`, `joinable` and
// `finished`.
function sessionFilterParams(url: URL): SessionFilters {
  const params = url.searchParams
  const stage = params.get('stage')

  if (stage && !SESSION_STAGES.includes(stage as SessionStage)) {
    throw new Response('Invalid stage parameter', {
      status: 400,
    })
  }

  return {
    search: params.get('search')?.trim() || undefined,
    stage: (stage || undefined) as SessionStage | undefined,
    joinable: params.get('joinable') === 'true' || undefined,
    // Finished games are only listed when asked for, or filtered on.
    includeFinished: params.get('finished') === 'true' ||
      stage === 'FINISHED' || undefined,
  }
}

export async function sessionsLoader({
  request,
}: LoaderFunctionArgs): Promise<SessionsLoaderData> {
  const url = new URL(request.url)
  const page = pageParam(url)
  const filters = sessionFilterParams(url)
  const sort = sortParams(url, SESSION_SORT_COLUMNS, DEFAULT_SESSION_SORT)

  const sessions = await getSessions(page, PAGE_SIZE, filters, sort)

  redirectPastLastPage(url, page, sessions.totalPages)

  return { sessions, filters, sort }
}

export interface HomeLoaderData {
  // How many games are on, or null when that can't be told right now.
  liveCount: number | null
}

// The home page works without the game server: it only counts live games.
export async function homeLoader(): Promise<HomeLoaderData> {
  try {
    return { liveCount: (await getSessions(0, 1)).totalElements }
  } catch {
    return { liveCount: null }
  }
}

export interface SessionLoaderData {
  session: GameSession
  player: JoinedPlayer | null
}

// The session code in the URL, normalized the way the backend reads it, so
// it's routed, stored and shown the same however it was typed.
function sessionCodeParam(id: string | undefined): string {
  const code = normalizeSessionCode(id ?? '')

  if (!code) {
    throw new Response('Invalid session code', {
      status: 400,
    })
  }

  return code
}

export async function sessionLoader({
  params,
  request,
}: LoaderFunctionArgs): Promise<SessionLoaderData> {
  const id = sessionCodeParam(params.id)

  // A typed URL such as /sessions/7kq2m goes to /sessions/7KQ2M.
  if (id !== params.id) {
    throw redirect(`/sessions/${id}${new URL(request.url).search}`)
  }

  return {
    session: await getSession(id),
    player: getStoredPlayer(id),
  }
}

export interface JoinActionData {
  error: string
}

const NAME_TOO_LONG = `Names can be at most ${MAX_NAME_LENGTH} characters.`

// Why the backend would refuse this host name, or null. Checked before the
// session exists: a name it rejects would leave an empty session behind.
export function hostNameError(playerName: string): string | null {
  if (!playerName) {
    return 'Enter your name to host.'
  }

  if (textLength(playerName) > MAX_NAME_LENGTH) {
    return NAME_TOO_LONG
  }

  return null
}

// Hosting is creating a session and joining it as its first player, who
// becomes the host.
async function createSessionAction({
  request,
}: ActionFunctionArgs): Promise<JoinActionData | Response> {
  const formData = await request.formData()
  const random = formData.get('random') === 'true'
  const playerName = cleanPlayerName(String(formData.get('playerName') ?? ''))
  const nameError = hostNameError(playerName)

  if (nameError) {
    return { error: nameError }
  }

  // "Host a random game" picks it only now, with a valid name.
  const gameId = random
    ? (await getRandomGame()).id
    : Number(formData.get('gameId'))

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw new Response('Invalid game ID', {
      status: 400,
    })
  }

  let id: string

  try {
    ({ id } = await createSession({ gameId }))
  } catch (error) {
    // The message says why, e.g. a clue no answer could match.
    if (hasErrorCode(error, 'UNPLAYABLE_GAME')) {
      return { error: error.message }
    }

    throw error
  }

  return await joinAsPlayer(id, playerName) ?? redirect(`/sessions/${id}`)
}

// The live games list's route takes two forms: hosting, from a game page,
// the games list or the home page (a random game), and "Join with a code".
export async function sessionsAction(
  args: ActionFunctionArgs,
): Promise<JoinActionData | Response> {
  const formData = await args.request.clone().formData()

  return formData.has('code')
    ? openByCode(String(formData.get('code')))
    : createSessionAction(args)
}

// Opens the session with a typed code, or says on the form why it can't.
async function openByCode(typed: string): Promise<JoinActionData | Response> {
  if (!typed.trim()) {
    return { error: "Enter the game's code." }
  }

  // A pasted share link works too.
  const linked = /\/sessions\/([^/?#\s]+)/.exec(typed)
  const code = normalizeSessionCode(linked ? linked[1] : typed)

  if (!code) {
    return { error: 'A game code is 5 letters and digits, such as 7KQ2M.' }
  }

  try {
    await getSession(code)
  } catch (error) {
    if (hasErrorCode(error, 'SESSION_NOT_FOUND')) {
      return { error: `There's no live game with the code ${code}.` }
    }

    throw error
  }

  return redirect(`/sessions/${code}`)
}

export async function joinSessionAction({
  params,
  request,
}: ActionFunctionArgs): Promise<JoinActionData | Response> {
  const id = sessionCodeParam(params.id)
  const formData = await request.formData()
  const playerName = cleanPlayerName(String(formData.get('playerName') ?? ''))

  if (!playerName) {
    return { error: 'Enter a name to join.' }
  }

  if (textLength(playerName) > MAX_NAME_LENGTH) {
    return { error: NAME_TOO_LONG }
  }

  return await joinAsPlayer(id, playerName) ?? redirect(`/sessions/${id}`)
}

// Joins and keeps the token. Returns null on success, or the error to show
// on the form.
export async function joinAsPlayer(
  id: string,
  playerName: string,
): Promise<JoinActionData | null> {
  try {
    storePlayer(id, await joinSession(id, playerName))
    rememberPlayerName(playerName)
  } catch (error) {
    // A rejected name, or a game that stopped accepting players since the
    // page loaded, is shown on the form; anything else is a route error.
    if (
      hasErrorCode(error, 'INVALID_REQUEST') ||
      hasErrorCode(error, 'SESSION_NOT_JOINABLE')
    ) {
      return { error: error.message }
    }

    throw error
  }

  return null
}
