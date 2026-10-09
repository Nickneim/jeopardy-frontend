import { redirect, type LoaderFunctionArgs } from 'react-router'
import { get } from './client'
import type { ClueType } from './clues'

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

export interface Season {
  season: string
  gameCount: number
}

export interface GameFilters {
  season?: string
  title?: string
  from?: string
  to?: string
}

export interface GamesLoaderData {
  games: PageResponse<GameSummary>
  seasons: Season[]
  filters: GameFilters
}

export function getGames(
  page = 0,
  size = 20,
  filters: GameFilters = {},
): Promise<PageResponse<GameSummary>> {
  return get<PageResponse<GameSummary>>('/games', {
    page,
    size,
    ...filters,
  })
}

// Seasons only change when games are imported, so fetch them once per page load.
let seasonsPromise: Promise<Season[]> | undefined

export function getSeasons(): Promise<Season[]> {
  seasonsPromise ??= get<Season[]>('/games/seasons').catch(error => {
    // Don't cache a failure: let the next navigation retry.
    seasonsPromise = undefined
    throw error
  })

  return seasonsPromise
}

export function getGame(id: number): Promise<Game> {
  return get<Game>(`/games/${id}`)
}

const PAGE_SIZE = 20

export const FILTER_PARAMS = ['season', 'title', 'from', 'to'] as const

export async function gamesLoader({
  request,
}: LoaderFunctionArgs): Promise<GamesLoaderData> {
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

  const filters: GameFilters = {}

  for (const name of FILTER_PARAMS) {
    const value = url.searchParams.get(name)?.trim()

    if (value) {
      filters[name] = value
    }
  }

  const [games, seasons] = await Promise.all([
    getGames(page, PAGE_SIZE, filters),
    getSeasons(),
  ])

  // Past the last page (e.g. a stale link): go to the last page instead.
  if (games.totalPages > 0 && page >= games.totalPages) {
    url.searchParams.set('page', String(games.totalPages - 1))
    throw redirect(`${url.pathname}?${url.searchParams}`)
  }

  return { games, seasons, filters }
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
