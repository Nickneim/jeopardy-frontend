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