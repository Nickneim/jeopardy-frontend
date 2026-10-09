// Location state carried from the games list to game and clue pages,
// so their back links return to the same page and filters.
export interface BrowseState {
  gamesSearch?: string
}

export function gamesListPath(state: unknown): string {
  const gamesSearch = (state as BrowseState | null)?.gamesSearch ?? ''

  return `/games${gamesSearch}`
}

// How someone without a token first sees a live game: choosing between
// playing and watching, or already decided (from the live games list).
export type JoinMode = 'choose' | 'join' | 'watch'

// Location state carried from the live games list to a session page.
export interface SessionLinkState {
  joinMode?: JoinMode
}

export function linkedJoinMode(state: unknown): JoinMode | undefined {
  return (state as SessionLinkState | null)?.joinMode
}
