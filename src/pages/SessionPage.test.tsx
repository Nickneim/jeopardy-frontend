import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getStoredPlayer, type GameSession } from '../api/sessions'
import { makePlayer, makeSession, SESSION_ID } from '../test/fixtures'
import SessionPage from './SessionPage'

// Replace the live connection: the test calls onTokenRejected itself, the
// way the hook does when the server rejects or closes the connection.
const { hook } = vi.hoisted(() => ({
  hook: {} as {
    onTokenRejected?: (reason: string | null) => void
    status?: string
  },
}))

vi.mock('../hooks/useGameSession', () => ({
  useGameSession: (
    initial: GameSession,
    _token: string | null,
    onTokenRejected: (reason: string | null) => void,
  ) => {
    hook.onTokenRejected = onTokenRejected
    return {
      session: initial,
      receivedAt: 0,
      status: hook.status ?? 'connected',
      error: null,
      actions: {},
    }
  },
}))

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
  }], { initialEntries: [`/sessions/${SESSION_ID}`] })

  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  hook.status = undefined
  localStorage.setItem(
    `jeopardy.session.${SESSION_ID}`,
    JSON.stringify({ playerId: 2, token: 'secret' }),
  )
})

describe('SessionPage', () => {
  test('a kicked player stays on as a spectator and is told why', async () => {
    renderSessionPage()
    // Bob's own podium is the one with the buzzer. The file's first render is
    // slow on a busy machine, so wait longer than the default second.
    expect(await screen.findByRole('button', { name: 'Buzz in' }, { timeout: 5000 }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument()

    // Home opens in a new tab, so the game carries on in this one.
    expect(screen.getByRole('link', { name: /Jeopardy! home/ }))
      .toHaveAttribute('target', '_blank')

    await act(async () =>
      hook.onTokenRejected?.('You were removed from the session by the host'))

    expect(await screen.findByText('You were removed from the session by the host'))
      .toBeInTheDocument()
    expect(screen.getByText(/You're watching as a spectator/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buzz in' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join as player' })).toBeInTheDocument()
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('a later rejection without a reason keeps the notice', async () => {
    renderSessionPage()
    await screen.findByRole('button', { name: 'Leave' })

    // Leaving, then the old connection's reconnect being rejected.
    await act(async () => hook.onTokenRejected?.('You left the game.'))
    await screen.findByText('You left the game.')
    await act(async () => hook.onTokenRejected?.(null))

    expect(screen.getByText('You left the game.')).toBeInTheDocument()
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

  test('shows the offline message when the server is unreachable', async () => {
    hook.status = 'offline'
    renderSessionPage()

    expect(await screen.findByText(/The game server is offline right now/))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
  })
})
