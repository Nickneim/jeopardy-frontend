import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, test, vi } from 'vitest'
import type { JoinMode } from '../../navigation'
import JoinChoice from './JoinChoice'

interface Options {
  canJoin?: boolean
  joinScore?: number
  defaultMode?: JoinMode
  action?: (playerName: string) => unknown
}

// The page keeps the mode, and has the "Join as player" button spectators use.
function Page({
  canJoin,
  joinScore,
  defaultMode,
}: Required<Omit<Options, 'action'>>) {
  const [mode, setMode] = useState(defaultMode)

  return (
    <>
      <JoinChoice
        canJoin={canJoin}
        joinScore={joinScore}
        mode={mode}
        onModeChange={setMode}
      />

      {canJoin && mode === 'watch' && (
        <button type="button" onClick={() => setMode('join')}>Join as player</button>
      )}
    </>
  )
}

// JoinForm posts to its route's action, so render inside a router.
function renderChoice({
  canJoin = true,
  joinScore = 0,
  defaultMode = 'choose',
  action = () => null,
}: Options = {}) {
  const router = createMemoryRouter([{
    path: '/',
    element: (
      <Page canJoin={canJoin} joinScore={joinScore} defaultMode={defaultMode} />
    ),
    action: async ({ request }) =>
      action(String((await request.formData()).get('playerName'))),
  }])

  render(<RouterProvider router={router} />)
}

const joinButton = () => screen.queryByRole('button', { name: 'Join this game' })
const nameInput = () => screen.queryByRole('textbox', { name: 'Your name' })

describe('JoinChoice', () => {
  test('offers joining or watching, without the form yet', () => {
    renderChoice()

    expect(joinButton()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Watch as spectator' }))
      .toBeInTheDocument()
    expect(nameInput()).not.toBeInTheDocument()
  })

  test('a spectator can join later, and go back to watching', async () => {
    renderChoice()

    await userEvent.click(screen.getByRole('button', { name: 'Watch as spectator' }))
    expect(screen.getByText(/You're watching as a spectator/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Join as player' }))
    expect(nameInput()).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Just watch' }))
    expect(nameInput()).not.toBeInTheDocument()
    expect(screen.getByText(/You're watching as a spectator/)).toBeInTheDocument()
  })

  test.each<[JoinMode, boolean]>([
    ['join', true],
    ['watch', false],
  ])('starts in %s mode when asked to', (defaultMode, showsForm) => {
    renderChoice({ defaultMode })

    expect(nameInput() !== null).toBe(showsForm)
  })

  test('only lets you watch when joining is closed', () => {
    renderChoice({ canJoin: false, defaultMode: 'join' })

    expect(screen.getByText(/doesn't accept new players/)).toBeInTheDocument()
    expect(joinButton()).not.toBeInTheDocument()
    expect(nameInput()).not.toBeInTheDocument()
  })

  test('tells you a negative starting score before joining', () => {
    renderChoice({ defaultMode: 'join', joinScore: -400 })

    expect(screen.getByText("You'll start with -$400.")).toBeInTheDocument()
  })

  test('submits the name and shows the action error', async () => {
    const action = vi.fn(() => ({ error: 'This game has already started' }))
    renderChoice({ defaultMode: 'join', action })

    await userEvent.type(nameInput()!, 'Dave')
    await userEvent.click(screen.getByRole('button', { name: 'Join game' }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('This game has already started')
    expect(action).toHaveBeenCalledWith('Dave')
  })
})
