import type { LoaderFunctionArgs } from 'react-router'
import { get } from './client'

export interface GameSummary {
  id: number
  title: string
  gameDate: string
  season: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type ClueType = 'TEXT' | 'IMAGE' | 'SOUND' | 'VIDEO'

export interface GameClue {
  id: number
  question: string
  answer: string
  rowNumber: number
  clueType: ClueType
  mediaUrl: string | null
}

export interface GameCategory {
  id: number
  name: string
  columnNumber: number
  comments: string | null
  clues: GameClue[]
}

export interface Game {
  id: number
  title: string
  gameDate: string
  season: string
  jeopardyRound: GameCategory[]
  doubleJeopardyRound: GameCategory[]
  finalJeopardy: GameCategory | null
  dailyDoubleClueIds: number[]
}

export function getGames(
  page = 0,
  size = 20,
  season?: string,
): Promise<PageResponse<GameSummary>> {
  return get<PageResponse<GameSummary>>('/games', {
    page,
    size,
    season,
  })
}

export function getGame(id: number): Promise<Game> {
  return get<Game>(`/games/${id}`)
}

export function gamesLoader({
  request,
}: LoaderFunctionArgs) {
  const url = new URL(request.url)

  const page = Math.max(
    0,
    Number(url.searchParams.get('page') ?? '0'),
  )

  const season = url.searchParams.get('season') ?? undefined

  return getGames(page, 20, season)
}

export function gameLoader({
  params,
}: LoaderFunctionArgs) {
  const id = Number(params.id)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Response('Invalid game ID', {
      status: 400,
    })
  }

  return getGame(id)
}
