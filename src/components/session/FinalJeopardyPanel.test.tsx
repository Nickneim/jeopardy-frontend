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
      players: [{
        playerId: 1,
        hasWagered: false,
        hasAnswered: false,
        wager: null,
        answer: null,
        correct: null,
        phrasedAsQuestion: null,
      }],
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
  })

  test('keeps the answer across a refresh in the answering phase', async () => {
    const { unmount } = renderPanel(finalJeopardy('FINAL_JEOPARDY_ANSWERING'))

    await userEvent.type(screen.getByRole('textbox'), 'What is Buenos Aires?')
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }))

    unmount()
    renderPanel(finalJeopardy('FINAL_JEOPARDY_ANSWERING'))

    expect(screen.getByText(/Your answer: “What is Buenos Aires\?”/)).toBeInTheDocument()
  })

  test('a new player in the same session starts with nothing sent', async () => {
    const { unmount } = renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'))
    await userEvent.click(screen.getByRole('button', { name: 'Place wager' }))
    unmount()

    // Alice left and rejoined: same session, new player id.
    const rejoined = makePlayer({ id: 2, name: 'Alice', score: 0 })
    renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'), rejoined)

    expect(screen.queryByText(/Your wager/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Place wager' })).toBeInTheDocument()
  })

  test('forgetting the player forgets what they sent', async () => {
    const { unmount } = renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'))
    await userEvent.click(screen.getByRole('button', { name: 'Place wager' }))
    unmount()

    forgetPlayer(SESSION_ID)
    renderPanel(finalJeopardy('FINAL_JEOPARDY_WAGERING'))

    expect(screen.queryByText(/Your wager/)).not.toBeInTheDocument()
  })
})
