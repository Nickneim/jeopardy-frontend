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

export interface GameClue {
  id: number
  question: string
  answer: string
  clueType: 'TEXT' | 'IMAGE' | 'SOUND' | 'VIDEO'
  mediaUrl: string | null
  value: number
}

export interface GameCategory {
  id: number
  name: string
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