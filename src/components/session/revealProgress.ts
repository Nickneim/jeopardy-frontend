import type {
  FinalJeopardy,
  FinalJeopardyPlayer,
  FinalRevealStep,
  GameSession,
} from '../../api/sessions'

// Each player's reveal shows their wager, then their response, then
// whether it was right (and their new score), in equal parts of their time.
// In a Trebek session it can also be `hidden`: Trebek hasn't shown the
// current player's wager yet.
export type RevealShown = 'hidden' | 'wager' | 'response' | 'result'

const SHOWN_BY_STEP: Record<FinalRevealStep, RevealShown> = {
  HIDDEN: 'hidden',
  WAGER: 'wager',
  ANSWER: 'response',
  AWARDED: 'result',
}

export interface FinalRevealProgress {
  // Lowest score before Final Jeopardy first, like the show.
  order: FinalJeopardyPlayer[]
  index: number
  step: RevealShown
  // Shown with the last player's result, until the phase ends.
  showCorrectResponse: boolean
  // New scores of the players revealed so far. The server only applies
  // them after the reveal, so until then they're worked out here. Empty in
  // a Trebek session, where the server applies each award as it happens.
  scores: Map<number, number>
}

// A Trebek session's reveal goes as Trebek (or the clock) steps through it:
// the current player is the last one whose reveal has begun.
function trebekRevealProgress(
  final: FinalJeopardy,
  revealOrder: number[],
): FinalRevealProgress | null {
  const order = revealOrder
    .map(id => final.players.find(result => result.playerId === id))
    .filter(result => result !== undefined)

  if (order.length === 0) {
    return null
  }

  const started = order.findLastIndex(result =>
    result.revealStep !== null && result.revealStep !== 'HIDDEN')
  const index = Math.max(0, started)
  const step = SHOWN_BY_STEP[order[index].revealStep ?? 'HIDDEN']

  return {
    order,
    index,
    step,
    showCorrectResponse: index === order.length - 1 && step === 'result',
    scores: new Map(),
  }
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

  if (final.revealOrder) {
    return trebekRevealProgress(final, final.revealOrder)
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
  const step: RevealShown = within < 1 / 3
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
