import type { CustomGameProblem } from './customShows'
import type { GameErrorCode } from './sessions'

// What went wrong, in an ApiErrorResponse (api.md §3). React to it rather
// than to the status: two different 409s can answer one request.
export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'GAME_NOT_FOUND'
  | 'CLUE_NOT_FOUND'
  | 'UNPLAYABLE_GAME'
  | 'INVALID_CUSTOM_GAME'
  | 'SESSION_ALREADY_EXISTS'
  | 'SESSION_NOT_JOINABLE'

export class ApiError extends Error {
  status: number;
  // Null without an ApiErrorResponse body: no response, a proxy's error
  // page, or Spring's default body for an unexpected error.
  code: ApiErrorCode | GameErrorCode | null;
  // Why a custom show can't be played (INVALID_CUSTOM_GAME), otherwise [].
  problems: CustomGameProblem[];
  constructor(
    status: number,
    message: string,
    code: ApiErrorCode | GameErrorCode | null = null,
    problems: CustomGameProblem[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.problems = problems
  }
}

export function hasErrorCode(
  error: unknown,
  code: ApiErrorCode | GameErrorCode,
): error is ApiError {
  return error instanceof ApiError && error.code === code
}

// What a request gets while the backend is switched off: no response at all
// (status 0), or an error page from the proxy in front of it (CloudFront in
// production, Vite's proxy in development).
const OFFLINE_STATUSES = new Set([0, 502, 503, 504])

export function isServerOffline(error: unknown): boolean {
  return error instanceof ApiError && OFFLINE_STATUSES.has(error.status)
}
