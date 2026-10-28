import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type {
  FinalJeopardyPlayer,
  GameSession,
  TrebekFinalPlayer,
  TrebekView,
} from '../../api/sessions'
import type { SessionActions } from '../../hooks/useGameSession'
import { makePlayer, makeSession } from '../../test/fixtures'
import TrebekDesk from './TrebekDesk'

const alice = makePlayer({ id: 1, name: 'Alice', score: 400 })
const bob = makePlayer({ id: 2, name: 'Bob', score: 1200 })

const CLUE = {
  clueId: 7,
  value: 800,
  dailyDouble: false,
  categoryName: 'World capitals',
  question: 'This capital sits on the Danube between Vienna and Budapest',
  clueType: 'TEXT' as const,
  mediaUrl: null,
  numberExpected: false,
  answer: '[Bratislava | Pressburg]',
  acceptedAnswers: { required: 1, options: ['Bratislava'] },
}

function trebekSession(overrides: Partial<GameSession>): GameSession {
  return makeSession({
    hostMode: 'TREBEK',
    trebek: { id: 9, name: 'Alex', away: false },
    hostPlayerId: 9,
    players: [alice, bob],
    playerChoosingClue: 1,
    currentClue: {
      clueId: 7,
      value: 800,
      dailyDouble: null,
      wager: null,
      minWager: null,
      maxWager: null,
      question: null,
      clueType: null,
      mediaUrl: null,
      numberExpected: null,
      answer: null,
      acceptedAnswers: null,
    },
    ...overrides,
  })
}

function view(overrides: Partial<TrebekView> = {}): TrebekView {
  return { version: 0, clue: CLUE, pendingAnswer: null, finalJeopardy: null, ...overrides }
}

function renderDesk(session: GameSession, trebekView: TrebekView | null = view()) {
  const actions = {
    advance: vi.fn(),
    returnClue: vi.fn(),
    rule: vi.fn(),
    ruleFinal: vi.fn(),
    adjustScore: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    placeDailyDoubleWager: vi.fn(),
  }

  render(
    <TrebekDesk
      session={session}
      view={trebekView}
      actions={actions as unknown as SessionActions}
    />,
  )
  return actions
}

describe('TrebekDesk', () => {
  test('shows a picked clue to Trebek alone, to show or put back', async () => {
    const actions = renderDesk(trebekSession({ state: 'CLUE_PICKED' }))

    expect(screen.getByText(CLUE.question)).toBeInTheDocument()
    expect(screen.getByText('Bratislava')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show the clue to everyone' }))
    await userEvent.click(screen.getByRole('button', { name: 'Put it back' }))

    expect(actions.advance).toHaveBeenCalledOnce()
    expect(actions.returnClue).toHaveBeenCalledOnce()
  })

  test("doesn't show the clue of a view that lags behind", () => {
    renderDesk(
      trebekSession({ state: 'CLUE_PICKED' }),
      view({ clue: { ...CLUE, clueId: 3, question: 'An older clue' } }),
    )

    expect(screen.queryByText('An older clue')).not.toBeInTheDocument()
  })

  test('rules early, before an answer is submitted', async () => {
    const actions = renderDesk(trebekSession({ state: 'WAITING_FOR_ANSWER', playerAnswering: 2 }))

    expect(screen.getByText(/You'll see the answer once it's submitted/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Wrong −$800' }))

    expect(actions.rule).toHaveBeenCalledWith(false)
  })

  test("shows the submitted answer with the check's suggestion", async () => {
    const actions = renderDesk(
      trebekSession({ state: 'WAITING_FOR_RULING', playerAnswering: 2 }),
      view({
        pendingAnswer: {
          playerId: 2,
          answer: 'What is Bratislava?',
          suggestedCorrect: true,
          phrasedAsQuestion: true,
          matchedAnswers: ['Bratislava'],
        },
      }),
    )

    expect(screen.getByText('What is Bratislava?')).toBeInTheDocument()
    expect(screen.getByText(/Looks right · matches Bratislava/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Correct +$800' }))
    expect(actions.rule).toHaveBeenCalledWith(true)
  })

  test('pauses and resumes the clock', async () => {
    const actions = renderDesk(trebekSession({
      state: 'WAITING_FOR_BUZZER',
      phaseDurationMs: 10000,
      phaseRemainingMs: 8000,
    }))
    await userEvent.click(screen.getByRole('button', { name: 'Pause the clock' }))
    expect(actions.pause).toHaveBeenCalledOnce()
  })

  test("has nothing to pause in a phase that waits for Trebek, but can resume", async () => {
    renderDesk(trebekSession({ state: 'REVEALING_CLUE' }))
    expect(screen.queryByRole('button', { name: 'Pause the clock' })).not.toBeInTheDocument()
    cleanup()

    // A pause holds across phases, also into one without a clock.
    const actions = renderDesk(trebekSession({ state: 'REVEALING_CLUE', paused: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Resume the clock' }))
    expect(actions.resume).toHaveBeenCalledOnce()
  })

  test('picks for the chooser on the board, without a button of its own', () => {
    renderDesk(trebekSession({ state: 'CHOOSING_CLUE', currentClue: null }))

    expect(screen.getByText(/pick it for them on the board/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pick/i })).not.toBeInTheDocument()
  })

  test('gives and takes away points', async () => {
    const actions = renderDesk(trebekSession({ state: 'CHOOSING_CLUE', currentClue: null }))

    await userEvent.selectOptions(screen.getByLabelText('Player'), '2')
    await userEvent.type(screen.getByLabelText('Amount'), '300')
    await userEvent.click(screen.getByRole('button', { name: 'Take away' }))

    expect(actions.adjustScore).toHaveBeenCalledWith(2, -300)
  })

  test('steps through the Final Jeopardy reveal, waiting for each ruling', async () => {
    function publicPlayer(playerId: number, revealStep: FinalJeopardyPlayer['revealStep']): FinalJeopardyPlayer {
      return {
        playerId,
        hasWagered: true,
        hasAnswered: true,
        maxWager: null,
        wager: null,
        answer: null,
        correct: null,
        phrasedAsQuestion: null,
        matchedAnswers: null,
        alsoAccepted: null,
        revealStep,
      }
    }

    function secret(playerId: number, ruling: boolean | null): TrebekFinalPlayer {
      return {
        playerId,
        wager: 400,
        answer: 'What is Vienna?',
        suggestedCorrect: false,
        phrasedAsQuestion: true,
        matchedAnswers: null,
        ruling,
      }
    }

    const session = trebekSession({
      state: 'FINAL_JEOPARDY_REVEALING',
      currentClue: null,
      finalJeopardy: {
        category: 'RIVERS',
        categoryComments: null,
        question: 'It flows through four capitals',
        numberExpected: false,
        answer: 'the Danube',
        acceptedAnswers: { required: 1, options: ['the Danube'] },
        players: [publicPlayer(1, 'ANSWER'), publicPlayer(2, 'HIDDEN')],
        revealOrder: [1, 2],
      },
    })
    const final = {
      question: 'It flows through four capitals',
      answer: 'the Danube',
      acceptedAnswers: { required: 1, options: ['the Danube'] },
      numberExpected: false,
      players: [secret(1, null), secret(2, null)],
    }

    const actions = renderDesk(session, view({ clue: null, finalJeopardy: final }))

    expect(screen.getByRole('button', { name: 'Award Alice' })).toBeDisabled()
    expect(screen.getByText('Rule on Alice’s answer first.')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Wrong' })[0])
    expect(actions.ruleFinal).toHaveBeenCalledWith(1, false)
  })
})
