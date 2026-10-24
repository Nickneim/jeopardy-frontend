import type { FinalJeopardyPlayer, GameSession } from '../../api/sessions'

// Each player's reveal shows their wager, then their response, then
// whether it was right (and their new score), in equal parts of their time.
export type FinalRevealStep = 'wager' | 'response' | 'result'

export interface FinalRevealProgress {
  // Lowest score before Final Jeopardy first, like the show.
  order: FinalJeopardyPlayer[]
  index: number
  step: FinalRevealStep
  // Shown with the last player's result, until the phase ends.
  showCorrectResponse: boolean
  // New scores of the players revealed so far. The server only applies
  // them after the reveal, so until then they're worked out here.
  scores: Map<number, number>
}

/**
 * Where the one-by-one Final Jeopardy reveal is, `leftMs` before the end of
 * FINAL_JEOPARDY_REVEALING. The server sends every result at once, so the
 * phase is split evenly between the players. Measuring from the phase's
 * duration means a refresh mid-reveal picks up at the right player.
 */
export function finalRevealProgress(
  session: GameSession,
  leftMs: number | null,
): FinalRevealProgress | null {
  const final = session.finalJeopardy

  if (session.state !== 'FINAL_JEOPARDY_REVEALING' || !final) {
    return null
  }

  const scoresBefore = new Map(session.players.map(p => [p.id, p.score]))
  const order = final.players
    .filter(result => scoresBefore.has(result.playerId))
    .sort((a, b) =>
      scoresBefore.get(a.playerId)! - scoresBefore.get(b.playerId)!)

  if (order.length === 0) {
    return null
  }

  const duration = session.phaseDurationMs
  const progress = leftMs === null || !duration
    ? 1
    : Math.min(1, Math.max(0, 1 - leftMs / duration))
  const position = progress * order.length
  const index = Math.min(order.length - 1, Math.floor(position))
  const within = position - index
  const step: FinalRevealStep = within < 1 / 3
    ? 'wager'
    : within < 2 / 3 ? 'response' : 'result'

  const scores = new Map<number, number>()
  order.forEach((result, k) => {
    if (k < index || (k === index && step === 'result')) {
      const change = (result.correct ? 1 : -1) * (result.wager ?? 0)
      scores.set(result.playerId, scoresBefore.get(result.playerId)! + change)
    }
  })

  return {
    order,
    index,
    step,
    showCorrectResponse: index === order.length - 1 && step === 'result',
    scores,
  }
}
