import type {
  FinalJeopardyPlayer,
  FinalRevealStep,
  GameSession,
} from '../../api/sessions'

// Each player's reveal shows their wager, then their response, then
// whether it was right (and their new score). Before the first step it's
// `hidden`.
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
}

/**
 * Where the one-by-one Final Jeopardy reveal is. The server takes the steps
 * (on its clock, or Trebek's advance) and sends each player's `revealStep`:
 * the current player is the last one whose reveal has begun. Scores are
 * already applied at each player's award.
 */
export function finalRevealProgress(
  session: GameSession,
): FinalRevealProgress | null {
  const final = session.finalJeopardy

  if (session.state !== 'FINAL_JEOPARDY_REVEALING' || !final?.revealOrder) {
    return null
  }

  const order = final.revealOrder
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
  }
}
