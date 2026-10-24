import { describe, expect, test } from 'vitest'
import type { FinalJeopardyPlayer } from '../../api/sessions'
import { makePlayer, makeSession } from '../../test/fixtures'
import { finalRevealProgress } from './revealProgress'

function result(
  playerId: number,
  wager: number,
  correct: boolean,
): FinalJeopardyPlayer {
  return {
    playerId,
    hasWagered: true,
    hasAnswered: true,
    wager,
    answer: correct ? 'What is Budapest?' : 'What is Vienna?',
    correct,
    phrasedAsQuestion: true,
    matchedAnswers: correct ? ['Budapest'] : null,
    alsoAccepted: correct ? [] : null,
  }
}

// Scores before Final Jeopardy: Ben lowest, then Carla, then Ana.
const session = makeSession({
  state: 'FINAL_JEOPARDY_REVEALING',
  round: 'FINAL_JEOPARDY',
  phaseDurationMs: 9000,
  phaseRemainingMs: 9000,
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
    players: [result(1, 500, false), result(2, 100, false), result(3, 1000, true)],
  },
})

describe('finalRevealProgress', () => {
  test('reveals from the lowest score to the highest', () => {
    const progress = finalRevealProgress(session, 9000)

    expect(progress?.order.map(r => r.playerId)).toEqual([2, 3, 1])
    expect(progress).toMatchObject({ index: 0, step: 'wager', showCorrectResponse: false })
    expect(progress?.scores.size).toBe(0)
  })

  test('splits the phase evenly: wager, response, then result', () => {
    // Each player has 3 s, so a second for each step.
    expect(finalRevealProgress(session, 7500)).toMatchObject({ index: 0, step: 'response' })
    expect(finalRevealProgress(session, 6500)).toMatchObject({ index: 0, step: 'result' })
    expect(finalRevealProgress(session, 5500)).toMatchObject({ index: 1, step: 'wager' })
  })

  test('applies the scores of the players revealed so far', () => {
    const progress = finalRevealProgress(session, 3500)

    expect(progress).toMatchObject({ index: 1, step: 'result' })
    expect(progress?.scores).toEqual(new Map([[2, 0], [3, 2200]]))
  })

  test('shows the correct response with the last result', () => {
    expect(finalRevealProgress(session, 1500)?.showCorrectResponse).toBe(false)

    const end = finalRevealProgress(session, 0)
    expect(end).toMatchObject({ index: 2, step: 'result', showCorrectResponse: true })
    expect(end?.scores.get(1)).toBe(1900)
  })

  test('is null outside the reveal', () => {
    expect(finalRevealProgress({ ...session, state: 'FINAL_JEOPARDY_ANSWERING' }, 5000))
      .toBeNull()
  })
})
