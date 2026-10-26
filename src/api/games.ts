import type { LoaderFunctionArgs } from 'react-router'
import { get } from './client'
import { pageParam, redirectPastLastPage } from './paging'
import type { ClueType } from './clues'

export interface GameSummary {
  id: number
  title: string
  gameDate: string
  season: string
  clueCount: number
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
  // 'true' to also list games without clues, which can't be played.
  includeUnplayable?: string
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
  const { includeUnplayable, ...apiFilters } = filters

  return get<PageResponse<GameSummary>>('/games', {
    page,
    size,
    ...apiFilters,
    // Without `playable`, the backend lists both kinds.
    playable: includeUnplayable === 'true' ? undefined : 'true',
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

export const FILTER_PARAMS = [
  'season',
  'title',
  'from',
  'to',
  'includeUnplayable',
] as const

export async function gamesLoader({
  request,
}: LoaderFunctionArgs): Promise<GamesLoaderData> {
  const url = new URL(request.url)
  const page = pageParam(url)

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

  redirectPastLastPage(url, page, games.totalPages)

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
