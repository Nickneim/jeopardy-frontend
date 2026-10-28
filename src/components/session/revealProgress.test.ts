import { describe, expect, test } from 'vitest'
import type { FinalJeopardyPlayer, FinalRevealStep } from '../../api/sessions'
import { makePlayer, makeSession } from '../../test/fixtures'
import { finalRevealProgress } from './revealProgress'

function result(
  playerId: number,
  revealStep: FinalRevealStep,
): FinalJeopardyPlayer {
  return {
    playerId,
    hasWagered: true,
    hasAnswered: true,
    maxWager: null,
    wager: revealStep === 'HIDDEN' ? null : 500,
    answer: revealStep === 'HIDDEN' || revealStep === 'WAGER'
      ? null
      : 'What is Budapest?',
    correct: revealStep === 'AWARDED' ? true : null,
    phrasedAsQuestion: null,
    matchedAnswers: null,
    alsoAccepted: null,
    revealStep,
  }
}

// Revealed lowest score first: Ben, then Carla, then Ana.
function revealing(steps: Record<number, FinalRevealStep>) {
  return makeSession({
    state: 'FINAL_JEOPARDY_REVEALING',
    round: 'FINAL_JEOPARDY',
    phaseDurationMs: 3333,
    phaseRemainingMs: 3333,
    players: [
      makePlayer({ id: 1, name: 'Ana', score: 2400 }),
      makePlayer({ id: 2, name: 'Ben', score: 100 }),
      makePlayer({ id: 3, name: 'Carla', score: 1200 }),
    ],
    finalJeopardy: {
      category: 'FAMOUS BRIDGES',
      categoryComments: null,
      question: 'Its Chain Bridge opened in 1849',
      numberExpected: false,
      answer: 'Budapest',
      acceptedAnswers: { required: 1, options: ['Budapest'] },
      players: [1, 2, 3].map(id => result(id, steps[id])),
      revealOrder: [2, 3, 1],
    },
  })
}

describe('finalRevealProgress', () => {
  test('starts with everyone hidden, in the reveal order', () => {
    const progress = finalRevealProgress(
      revealing({ 1: 'HIDDEN', 2: 'HIDDEN', 3: 'HIDDEN' }))

    expect(progress?.order.map(r => r.playerId)).toEqual([2, 3, 1])
    expect(progress).toMatchObject({ index: 0, step: 'hidden', showCorrectResponse: false })
  })

  test("follows each player's reveal step", () => {
    expect(finalRevealProgress(revealing({ 1: 'HIDDEN', 2: 'WAGER', 3: 'HIDDEN' })))
      .toMatchObject({ index: 0, step: 'wager' })
    expect(finalRevealProgress(revealing({ 1: 'HIDDEN', 2: 'AWARDED', 3: 'HIDDEN' })))
      .toMatchObject({ index: 0, step: 'result' })
    expect(finalRevealProgress(revealing({ 1: 'HIDDEN', 2: 'AWARDED', 3: 'ANSWER' })))
      .toMatchObject({ index: 1, step: 'response' })
  })

  test('shows the correct response with the last result', () => {
    expect(finalRevealProgress(revealing({ 1: 'ANSWER', 2: 'AWARDED', 3: 'AWARDED' }))
      ?.showCorrectResponse).toBe(false)
    expect(finalRevealProgress(revealing({ 1: 'AWARDED', 2: 'AWARDED', 3: 'AWARDED' })))
      .toMatchObject({ index: 2, step: 'result', showCorrectResponse: true })
  })

  test('is null outside the reveal', () => {
    const session = revealing({ 1: 'HIDDEN', 2: 'HIDDEN', 3: 'HIDDEN' })

    expect(finalRevealProgress({ ...session, state: 'FINAL_JEOPARDY_ANSWERING' }))
      .toBeNull()
  })
})
