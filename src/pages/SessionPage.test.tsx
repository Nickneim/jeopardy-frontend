import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getStoredPlayer,
  type GameSession,
  type JoinedPlayer,
} from '../api/sessions'
import type { SessionEnd } from '../hooks/useGameSession'
import { makePlayer, makeSession, SESSION_ID } from '../test/fixtures'
import SessionPage from './SessionPage'

// Replace the live connection: the test calls onEnded itself, the way the
// hook does when the connection ends for good.
const { hook } = vi.hoisted(() => ({
  hook: {} as {
    onEnded?: (ended: SessionEnd) => void
    status?: string
  },
}))

vi.mock('../hooks/useGameSession', () => ({
  useGameSession: (
    initial: GameSession,
    _player: JoinedPlayer | null,
    onEnded: (ended: SessionEnd) => void,
  ) => {
    hook.onEnded = onEnded
    return {
      session: initial,
      receivedAt: 0,
      status: hook.status ?? 'connected',
      error: null,
      actions: {},
    }
  },
}))

const STORAGE_KEY = `jeopardy.session.${SESSION_ID}`

const session = makeSession({
  players: [makePlayer({ id: 1, name: 'Alice' }), makePlayer({ id: 2, name: 'Bob' })],
  hostPlayerId: 1,
})

function renderSessionPage(shown: GameSession = session) {
  const router = createMemoryRouter([{
    path: '/sessions/:id',
    element: <SessionPage />,
    // Like sessionLoader, without the backend.
    loader: () => ({ session: shown, player: getStoredPlayer(SESSION_ID) }),
  }, {
    path: '/sessions',
    element: <p>Live games</p>,
  }], { initialEntries: [`/sessions/${SESSION_ID}`] })

  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  hook.status = undefined
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ playerId: 2, token: 'secret' }),
  )
})

describe('SessionPage', () => {
  test('a kicked player stays on as a spectator and is told why', async () => {
    renderSessionPage()
    // Bob's own podium is the one with the buzzer.
    expect(await screen.findByRole('button', { name: 'Buzz in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument()

    // Home opens in a new tab, so the game carries on in this one.
    expect(screen.getByRole('link', { name: /Jeopardy! home/ }))
      .toHaveAttribute('target', '_blank')

    await act(async () => hook.onEnded?.({
      reason: 'removed',
      message: 'You were removed from the session by the host',
    }))

    expect(await screen.findByText('You were removed from the session by the host'))
      .toBeInTheDocument()
    expect(screen.getByText(/You're watching as a spectator/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buzz in' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join as player' })).toBeInTheDocument()
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('a player who left stays on as a spectator', async () => {
    renderSessionPage()
    await screen.findByRole('button', { name: 'Leave' })

    await act(async () => hook.onEnded?.({ reason: 'left' }))

    expect(await screen.findByText('You left the game.')).toBeInTheDocument()
    expect(screen.getByText(/You're watching as a spectator/)).toBeInTheDocument()
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('a second tab whose token another tab already forgot still moves on', async () => {
    renderSessionPage()
    await screen.findByRole('button', { name: 'Leave' })

    // The other tab left first and forgot the shared token.
    localStorage.removeItem(STORAGE_KEY)
    await act(async () => hook.onEnded?.({
      reason: 'removed',
      message: 'You left the session',
    }))

    expect(await screen.findByText('You left the session')).toBeInTheDocument()
    expect(screen.getByText(/You're watching as a spectator/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buzz in' })).not.toBeInTheDocument()
  })

  test("keeps the token another tab joined again with", async () => {
    renderSessionPage()
    await screen.findByRole('button', { name: 'Leave' })

    const rejoined = { playerId: 3, token: 'newer' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rejoined))
    await act(async () => hook.onEnded?.({
      reason: 'removed',
      message: 'You left the session',
    }))

    expect(getStoredPlayer(SESSION_ID)).toEqual(rejoined)
  })

  test('a token rejected on CONNECT offers to join again', async () => {
    renderSessionPage()
    await screen.findByRole('button', { name: 'Leave' })

    await act(async () => hook.onEnded?.({
      reason: 'rejected',
      message: 'Unknown player token',
    }))

    expect(await screen.findByRole('button', { name: /Join this game/ }))
      .toBeInTheDocument()
    expect(screen.queryByText('Unknown player token')).not.toBeInTheDocument()
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('the last player leaving goes back to the live games', async () => {
    renderSessionPage()
    await screen.findByRole('button', { name: 'Leave' })

    await act(async () => hook.onEnded?.({ reason: 'abandoned' }))

    expect(await screen.findByText('Live games')).toBeInTheDocument()
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('a closed session forgets the token and stays on its final view', async () => {
    renderSessionPage({ ...session, state: 'CLOSED', closeReason: 'FINISHED' })
    await screen.findByText('This game has ended.')

    await act(async () => hook.onEnded?.({ reason: 'closed' }))

    expect(screen.getByText('This game has ended.')).toBeInTheDocument()
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test.each([
    'FINAL_JEOPARDY_REVEALING',
    'FINISHED_GAME',
  ] as const)('nobody can leave or join once the game is decided (%s)', async state => {
    const decided = { ...session, state, round: 'FINAL_JEOPARDY' as const }
    const { unmount } = renderSessionPage(decided)

    expect(await screen.findByRole('button', { name: 'Share link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buzz in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()

    // A spectator isn't offered to join either.
    unmount()
    localStorage.clear()
    renderSessionPage(decided)

    expect(await screen.findByRole('button', { name: 'Share link' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Join/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/spectator/)).not.toBeInTheDocument()
  })

  test.each([
    ['reconnecting', true],
    ['connected', false],
  ])('game buttons wait for the live connection (%s)', async (status, disabled) => {
    hook.status = status
    renderSessionPage({
      ...session,
      state: 'CHOOSING_CLUE',
      playerChoosingClue: 2,
      board: [{
        name: 'POTENT POTABLES',
        comments: null,
        slots: [{ row: 1, clueId: 7, value: 200, status: 'AVAILABLE' }],
      }],
    })

    const buttons = [
      await screen.findByRole('button', { name: 'POTENT POTABLES for $200' }),
      screen.getByRole('button', { name: 'Buzz in' }),
      screen.getByRole('button', { name: 'Leave' }),
    ]

    // The clue cell is disabled through its fieldset, so check :disabled.
    for (const button of buttons) {
      expect(button.matches(':disabled')).toBe(disabled)
    }
    // Sharing the link doesn't need the connection.
    expect(screen.getByRole('button', { name: 'Share link' })).toBeEnabled()
  })

  test("shows only the round's title card before the round", async () => {
    renderSessionPage({
      ...session,
      state: 'ROUND_INTRO',
      round: 'DOUBLE_JEOPARDY',
      playerChoosingClue: 1,
      phaseDurationMs: 6000,
      phaseRemainingMs: 6000,
      board: [{
        name: 'Rivers',
        comments: null,
        slots: [{ row: 1, clueId: 5, value: 400, status: 'AVAILABLE' }],
      }],
    })

    const title = await screen.findByRole('heading', { level: 2 })
    expect(title).toHaveTextContent('DoubleJeopardy!')
    expect(screen.queryByText('Rivers')).not.toBeInTheDocument()
  })

  test('announces a Daily Double before the wager', async () => {
    renderSessionPage({
      ...session,
      state: 'REVEALING_DAILY_DOUBLE',
      playerChoosingClue: 1,
      board: [{
        name: 'Rivers',
        comments: null,
        slots: [{ row: 1, clueId: 5, value: 400, status: 'AVAILABLE' }],
      }],
      currentClue: {
        clueId: 5,
        value: 400,
        dailyDouble: true,
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
    })

    expect(await screen.findByRole('heading', { level: 2 }))
      .toHaveTextContent('DailyDouble!')
    // In the heading, besides the board left behind the screen.
    expect(screen.getByText('Rivers', { selector: '.tv-heading span' }))
      .toBeInTheDocument()
    // Nothing to wager yet.
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  test('shows the offline message when the server is unreachable', async () => {
    hook.status = 'offline'
    renderSessionPage()

    expect(await screen.findByText(/The game server is offline right now/))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
  })
})
