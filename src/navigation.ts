// Location state carried from the games list to game and clue pages,
// so their back links return to the same page and filters.
export interface BrowseState {
  gamesSearch?: string
}

export function gamesListPath(state: unknown): string {
  const gamesSearch = (state as BrowseState | null)?.gamesSearch ?? ''

  return `/games${gamesSearch}`
}
