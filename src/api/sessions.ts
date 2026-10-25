import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'
import { get, post, put } from './client'
import type { ClueType } from './clues'
import { ApiError } from './errors'
import type { PageResponse } from './games'
import { normalizeSessionCode, randomSessionCode } from '../sessionCode'

export type GameRound = 'JEOPARDY' | 'DOUBLE_JEOPARDY' | 'FINAL_JEOPARDY'

export type GameSessionState =
  | 'WAITING_FOR_START'
  | 'CHOOSING_CLUE'
  | 'WAITING_FOR_DAILY_DOUBLE_WAGER'
  | 'REVEALING_CLUE'
  | 'WAITING_FOR_BUZZER'
  | 'WAITING_FOR_ANSWER'
  | 'REVEALING_ANSWER'
  | 'FINAL_JEOPARDY_WAGERING'
  | 'FINAL_JEOPARDY_ANSWERING'
  | 'FINAL_JEOPARDY_REVEALING'
  | 'FINISHED_GAME'
  // Only in a removed session's last broadcast.
  | 'CLOSED'

export type SessionCloseReason = 'ABANDONED' | 'IDLE' | 'FINISHED'

export type GameErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'NOT_YOUR_TURN'
  | 'INVALID_STATE'
  | 'CLUE_NOT_FOUND'
  | 'CLUE_ALREADY_PLAYED'
  | 'PLAYER_NOT_IN_SESSION'
  | 'INVALID_WAGER'
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'NOT_HOST'
  | 'PLAYER_NOT_FOUND'

export interface Player {
  id: number
  name: string
  score: number
  // Left (or was kicked) but still holds a role; removed when it ends.
  leaving: boolean
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

export const MIN_TIMER_MS = 1000
export const MAX_TIMER_MS = 300000

// Every session starts with these (api.md §6.3).
export const DEFAULT_TIMERS: SessionTimers = {
  clueChoiceMs: 30000,
  clueRevealMs: 3000,
  dailyDoubleWagerMs: 30000,
  buzzerMs: 10000,
  answerMs: 5000,
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
  dailyDouble: boolean
  wager: number | null
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
}

export interface FinalJeopardyPlayer {
  playerId: number
  hasWagered: boolean
  hasAnswered: boolean
  wager: number | null
  answer: string | null
  correct: boolean | null
  // Revealed with `correct`, null without an answer.
  phrasedAsQuestion: boolean | null
  // Revealed, correct answers only (as in ClueAnswer).
  matchedAnswers: string[] | null
  alsoAccepted: string[] | null
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
}

export interface GameSession {
  id: string
  version: number
  round: GameRound
  state: GameSessionState
  closeReason: SessionCloseReason | null
  phaseDurationMs: number | null
  phaseRemainingMs: number | null
  timers: SessionTimers
  // Whether players can join after the start. Only the host changes it,
  // before the start.
  allowLateJoin: boolean
  // The score a player who joins now starts with, never above 0.
  joinScore: number
  players: Player[]
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

// Whether nobody else is still playing, so this player leaving closes the
// session.
export function isLastPlayer(
  session: GameSession,
  playerId: number | undefined,
): boolean {
  return !session.players.some(p => p.id !== playerId && !p.leaving)
}

export interface GameSessionError {
  code: GameErrorCode
  message: string
}

export interface GameSessionSummary {
  id: string
  gameId: number | null
  gameTitle: string | null
  state: GameSessionState
  round: GameRound
  playerCount: number
  hostName: string | null
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

// The client picks the new session's code, so the create can already be
// routed by it. A 409 means another session has that code: pick another.
export async function createSession(gameId: number): Promise<{ id: string }> {
  for (let attempt = 1; ; attempt++) {
    const id = randomSessionCode()

    try {
      return await put<{ id: string }>(
        `/game-sessions/${id}`,
        { gameId },
        routedTo(id),
      )
    } catch (error) {
      const taken = error instanceof ApiError && error.status === 409

      if (!taken || attempt === CREATE_ATTEMPTS) {
        throw error
      }
    }
  }
}

export function getSessions(
  page = 0,
  size = 20,
  includeFinished = false,
): Promise<PageResponse<GameSessionSummary>> {
  return get<PageResponse<GameSessionSummary>>('/game-sessions', {
    page,
    size,
    // Without it, the backend leaves finished games out.
    includeFinished: includeFinished ? 'true' : undefined,
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

export async function sessionsLoader({
  request,
}: LoaderFunctionArgs): Promise<PageResponse<GameSessionSummary>> {
  const url = new URL(request.url)
  const pageParam = url.searchParams.get('page')

  const page = pageParam === null
    ? 0
    : Number(pageParam)

  if (!Number.isInteger(page) || page < 0) {
    throw new Response('Invalid page parameter', {
      status: 400,
    })
  }

  const sessions = await getSessions(
    page,
    PAGE_SIZE,
    url.searchParams.get('finished') === 'true',
  )

  // Past the last page (e.g. sessions closed since): go to the last page.
  if (sessions.totalPages > 0 && page >= sessions.totalPages) {
    url.searchParams.set('page', String(sessions.totalPages - 1))
    throw redirect(`${url.pathname}?${url.searchParams}`)
  }

  return sessions
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

// Hosting is creating a session and joining it as its first player, who
// becomes the host.
async function createSessionAction({
  request,
}: ActionFunctionArgs): Promise<JoinActionData | Response> {
  const formData = await request.formData()
  const gameId = Number(formData.get('gameId'))
  const playerName = String(formData.get('playerName') ?? '').trim()

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw new Response('Invalid game ID', {
      status: 400,
    })
  }

  if (!playerName) {
    return { error: 'Enter your name to host.' }
  }

  const { id } = await createSession(gameId)

  return await joinAsPlayer(id, playerName) ?? redirect(`/sessions/${id}`)
}

// The live games list's route takes two forms: hosting, from a game page,
// and "Join with a code".
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

  const code = normalizeSessionCode(typed)

  if (!code) {
    return { error: 'A game code is 5 letters and digits, such as 7KQ2M.' }
  }

  try {
    await getSession(code)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
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
  const playerName = String(formData.get('playerName') ?? '').trim()

  if (!playerName) {
    return { error: 'Enter a name to join.' }
  }

  return await joinAsPlayer(id, playerName) ?? redirect(`/sessions/${id}`)
}

// Joins and keeps the token. Returns null on success, or the error to show
// on the form.
async function joinAsPlayer(
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
      error instanceof ApiError &&
      (error.status === 400 || error.status === 409)
    ) {
      return { error: error.message }
    }

    throw error
  }

  return null
}
