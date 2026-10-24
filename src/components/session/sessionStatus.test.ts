import { describe, expect, test } from 'vitest'
import { makePlayer, makeSession } from '../../test/fixtures'
import { sessionStatus } from './sessionStatus'

const alice = makePlayer({ id: 1, name: 'Alice' })
const bob = makePlayer({ id: 2, name: 'Bob' })

describe('sessionStatus', () => {
  test("says whose pick it is", () => {
    const session = makeSession({
      state: 'CHOOSING_CLUE',
      players: [alice, bob],
      playerChoosingClue: 1,
    })

    expect(sessionStatus(session, alice))
      .toEqual({ who: null, message: 'Your pick · choose a clue' })
    expect(sessionStatus(session, bob))
      .toEqual({ who: 'Alice', message: 'is choosing a clue' })
  })

  test('tells a locked-out player they already buzzed', () => {
    const session = makeSession({
      state: 'WAITING_FOR_BUZZER',
      players: [alice, bob],
      playersLockedOut: [2],
      clueAnswers: [{ playerId: 2, answer: 'Paris', correct: false, phrasedAsQuestion: false, matchedAnswers: null, alsoAccepted: null }],
    })

    expect(sessionStatus(session, alice).message).toBe('Still open · buzz in now')
    expect(sessionStatus(session, bob).message).toBe('You already buzzed on this clue')
    expect(sessionStatus(session, null).message).toBe('Buzzers open')
  })

  test('names who is answering', () => {
    const session = makeSession({
      state: 'WAITING_FOR_ANSWER',
      players: [alice, bob],
      playerAnswering: 2,
    })

    expect(sessionStatus(session, alice)).toEqual({ who: 'Bob', message: 'is answering' })
    expect(sessionStatus(session, bob)).toEqual({ who: null, message: 'Your answer' })
  })
})
