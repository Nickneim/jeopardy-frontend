import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { forgetPlayer, type GameSession } from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { makePlayer, makeSession, SESSION_ID } from '../../test/fixtures'
import FinalJeopardyPanel from './FinalJeopardyPanel'

const alice = makePlayer({ id: 1, name: 'Alice', score: 3000 })

function finalJeopardy(state: GameSession['state']): GameSession {
  return makeSession({
    state,
    round: 'FINAL_JEOPARDY',
    players: [alice],
    hostPlayerId: 1,
    finalJeopardy: {
      category: 'WORLD CAPITALS',
      categoryComments: null,
      question: state === 'FINAL_JEOPARDY_ANSWERING' ? 'Its name means "good air"' : null,
      numberExpected: state === 'FINAL_JEOPARDY_WAGERING' ? null : false,
      answer: null,
      acceptedAnswers: null,
      players: [{
        playerId: 1,
        hasWagered: false,
        hasAnswered: false,
        maxWager: null,
        wager: null,
        answer: null,
        correct: null,
        phrasedAsQuestion: null,
        matchedAnswers: null,
        alsoAccepted: null,
        revealStep: null,
      }],
      revealOrder: null,
    },
  })
}

function renderPanel(session: GameSession, me = alice) {
  const actions = {
    placeFinalJeopardyWager: vi.fn(),
    answerFinalJeopardy: vi.fn(),
  } as unknown as SessionActions

  return {
    actions,
    ...render(<FinalJeopardyPanel session={session} me={me} actions={actions} />),
  }
}

describe('FinalJeopardyPanel', () => {
  test('sends the wager and keeps showing it after a refresh', async () => {
    const { actions, unmount } = renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'))

    const input = screen.getByRole('spinbutton')
    await userEvent.clear(input)
    await userEvent.type(input, '1200')
    await userEvent.click(screen.getByRole('button', { name: 'Place wager' }))

    expect(actions.placeFinalJeopardyWager).toHaveBeenCalledWith(1200)
    expect(screen.getByText(/Your wager: \$1,200/)).toBeInTheDocument()

    // A refresh remounts the panel from scratch.
    unmount()
    renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'))

    expect(screen.getByText(/Your wager: \$1,200/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change wager' })).toBeInTheDocument()
    // The field shows it too, so "Change wager" doesn't quietly send $0.
    expect(screen.getByRole('spinbutton')).toHaveValue(1200)
  })

  test('keeps the answer across a refresh in the answering phase', async () => {
    const { unmount } = renderPanel(finalJeopardy('FINAL_JEOPARDY_ANSWERING'))

    await userEvent.type(screen.getByRole('textbox'), 'What is Buenos Aires?')
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }))

    unmount()
    renderPanel(finalJeopardy('FINAL_JEOPARDY_ANSWERING'))

    expect(screen.getByText(/Your answer: “What is Buenos Aires\?”/)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('What is Buenos Aires?')
  })

  test('a new player in the same session starts with nothing sent', async () => {
    const { unmount } = renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'))
    await userEvent.click(screen.getByRole('button', { name: 'Place wager' }))
    unmount()

    // Alice left and rejoined: same session, new player id.
    const rejoined = makePlayer({ id: 2, name: 'Alice', score: 0 })
    renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'), rejoined)

    expect(screen.queryByText(/Your wager:/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Place wager' })).toBeInTheDocument()
  })

  test('forgetting the player forgets what they sent', async () => {
    const { unmount } = renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'))
    await userEvent.click(screen.getByRole('button', { name: 'Place wager' }))
    unmount()

    forgetPlayer(SESSION_ID)
    renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'))

    expect(screen.queryByText(/Your wager:/)).not.toBeInTheDocument()
  })

  test("shows the correct response in the player's own wording", () => {
    const bob = makePlayer({ id: 2, name: 'Bob', score: 1000 })
    const revealed = (playerId: number, answer: string, matched: string[] | null) => ({
      playerId,
      hasWagered: true,
      hasAnswered: true,
      maxWager: null,
      wager: 0,
      answer,
      correct: matched !== null,
      phrasedAsQuestion: true,
      matchedAnswers: matched,
      alsoAccepted: matched && [],
      revealStep: null,
    })
    const session = makeSession({
      state: 'FINAL_JEOPARDY_REVEALING',
      round: 'FINAL_JEOPARDY',
      players: [alice, bob],
      finalJeopardy: {
        category: 'COUNTRIES',
        categoryComments: null,
        question: 'Its capital is Yangon no more',
        numberExpected: false,
        answer: '[Myanmar | Burma]',
        acceptedAnswers: { required: 1, options: ['Myanmar'] },
        players: [
          revealed(1, 'What is Myanmar?', ['Myanmar']),
          revealed(2, 'What is Burma?', ['Burma']),
        ],
        revealOrder: null,
      },
    })

    const { unmount } = renderPanel(session, bob)
    expect(screen.getByText('Burma', { selector: 'strong' })).toBeInTheDocument()

    unmount()
    renderPanel(session, alice)
    expect(screen.getByText('Myanmar', { selector: 'strong' })).toBeInTheDocument()
  })
})
