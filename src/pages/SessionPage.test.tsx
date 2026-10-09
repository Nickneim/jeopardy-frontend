import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getStoredPlayer, type GameSession } from '../api/sessions'
import { makePlayer, makeSession, SESSION_ID } from '../test/fixtures'
import SessionPage from './SessionPage'

// Replace the live connection: the test calls onTokenRejected itself, the
// way the hook does when the server rejects or closes the connection.
const { hook } = vi.hoisted(() => ({
  hook: {} as { onTokenRejected?: (reason: string | null) => void },
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
      status: 'connected',
      error: null,
      actions: {},
    }
  },
}))

const session = makeSession({
  players: [makePlayer({ id: 1, name: 'Alice' }), makePlayer({ id: 2, name: 'Bob' })],
  hostPlayerId: 1,
})

function renderSessionPage() {
  const router = createMemoryRouter([{
    path: '/sessions/:id',
    element: <SessionPage />,
    // Like sessionLoader, without the backend.
    loader: () => ({ session, player: getStoredPlayer(SESSION_ID) }),
  }], { initialEntries: [`/sessions/${SESSION_ID}`] })

  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  localStorage.setItem(
    `jeopardy.session.${SESSION_ID}`,
    JSON.stringify({ playerId: 2, token: 'secret' }),
  )
})

describe('SessionPage', () => {
  test('a kicked player stays on as a spectator and is told why', async () => {
    renderSessionPage()
    expect(await screen.findByText(/Playing as/)).toHaveTextContent('Bob')

    await act(async () =>
      hook.onTokenRejected?.('You were removed from the session by the host'))

    expect(await screen.findByText('You were removed from the session by the host'))
      .toBeInTheDocument()
    expect(screen.getByText(/You're watching as a spectator/)).toBeInTheDocument()
    expect(getStoredPlayer(SESSION_ID)).toBeNull()
  })

  test('a later rejection without a reason keeps the notice', async () => {
    renderSessionPage()
    await screen.findByText(/Playing as/)

    // Leaving, then the old connection's reconnect being rejected.
    await act(async () => hook.onTokenRejected?.('You left the game.'))
    await screen.findByText('You left the game.')
    await act(async () => hook.onTokenRejected?.(null))

    expect(screen.getByText('You left the game.')).toBeInTheDocument()
  })
})
