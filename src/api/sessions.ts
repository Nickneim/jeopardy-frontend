import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'
import { get, post } from './client'
import type { ClueType } from './clues'
import { ApiError } from './errors'

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

export interface Player {
  id: number
  name: string
  score: number
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
  answer: string | null
}

export interface ClueAnswer {
  playerId: number
  answer: string | null
  correct: boolean
}

export interface FinalJeopardyPlayer {
  playerId: number
  hasWagered: boolean
  hasAnswered: boolean
  wager: number | null
  answer: string | null
  correct: boolean | null
}

export interface FinalJeopardy {
  category: string
  categoryComments: string | null
  question: string | null
  answer: string | null
  players: FinalJeopardyPlayer[]
}

export interface GameSession {
  id: string
  version: number
  round: GameRound
  state: GameSessionState
  phaseDurationMs: number | null
  phaseRemainingMs: number | null
  players: Player[]
  playerChoosingClue: number | null
  playerAnswering: number | null
  playersLockedOut: number[]
  board: BoardCategory[]
  currentClue: CurrentClue | null
  clueAnswers: ClueAnswer[]
  finalJeopardy: FinalJeopardy | null
}

export interface GameSessionError {
  code: GameErrorCode
  message: string
}

export interface JoinedPlayer {
  playerId: number
  token: string
}

export function createSession(gameId: number): Promise<{ id: string }> {
  return post<{ id: string }>('/game-sessions', { gameId })
}

export function getSession(id: string): Promise<GameSession> {
  return get<GameSession>(`/game-sessions/${id}`)
}

export function joinSession(
  id: string,
  playerName: string,
): Promise<JoinedPlayer> {
  return post<JoinedPlayer>(`/game-sessions/${id}/players`, { playerName })
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

export function forgetPlayer(sessionId: string) {
  try {
    localStorage.removeItem(storageKey(sessionId))
  } catch {
    // Nothing to forget.
  }
}

export interface SessionLoaderData {
  session: GameSession
  player: JoinedPlayer | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sessionIdParam(id: string | undefined): string {
  if (!id || !UUID_PATTERN.test(id)) {
    throw new Response('Invalid session ID', {
      status: 400,
    })
  }

  return id
}

export async function sessionLoader({
  params,
}: LoaderFunctionArgs): Promise<SessionLoaderData> {
  const id = sessionIdParam(params.id)

  return {
    session: await getSession(id),
    player: getStoredPlayer(id),
  }
}

export async function createSessionAction({
  request,
}: ActionFunctionArgs) {
  const formData = await request.formData()
  const gameId = Number(formData.get('gameId'))

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw new Response('Invalid game ID', {
      status: 400,
    })
  }

  const { id } = await createSession(gameId)

  return redirect(`/sessions/${id}`)
}

export interface JoinActionData {
  error: string
}

export async function joinSessionAction({
  params,
  request,
}: ActionFunctionArgs): Promise<JoinActionData | Response> {
  const id = sessionIdParam(params.id)
  const formData = await request.formData()
  const playerName = String(formData.get('playerName') ?? '').trim()

  if (!playerName) {
    return { error: 'Enter a name to join.' }
  }

  try {
    storePlayer(id, await joinSession(id, playerName))
  } catch (error) {
    // A rejected name is shown on the form; anything else is a route error.
    if (error instanceof ApiError && error.status === 400) {
      return { error: error.message }
    }

    throw error
  }

  return redirect(`/sessions/${id}`)
}
