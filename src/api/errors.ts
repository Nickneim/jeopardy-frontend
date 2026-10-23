export class ApiError extends Error {
  status: number;
  constructor(
    status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// What a request gets while the backend is switched off: no response at all
// (status 0), or an error page from the proxy in front of it (CloudFront in
// production, Vite's proxy in development).
const OFFLINE_STATUSES = new Set([0, 502, 503, 504])

export function isServerOffline(error: unknown): boolean {
  return error instanceof ApiError && OFFLINE_STATUSES.has(error.status)
}
