import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, redirect, RouterProvider } from 'react-router'
import { describe, expect, test, vi } from 'vitest'
import JoinByCode from './JoinByCode'

// JoinByCode posts to /sessions, so render it inside a router with a stub
// action there.
function renderForm(action: (code: string) => unknown) {
  const router = createMemoryRouter([
    {
      path: '/sessions',
      element: <JoinByCode />,
      action: async ({ request }) =>
        action(String((await request.formData()).get('code'))),
    },
    {
      path: '/sessions/:id',
      element: <p>Session page</p>,
    },
  ], { initialEntries: ['/sessions'] })

  render(<RouterProvider router={router} />)
}

describe('JoinByCode', () => {
  test('sends the typed code and opens the session it redirects to', async () => {
    const action = vi.fn(() => redirect('/sessions/7KQ2M'))
    renderForm(action)

    await userEvent.type(screen.getByRole('textbox', { name: 'Game code' }), '7kq2m')
    await userEvent.click(screen.getByRole('button', { name: 'Join with a code' }))

    expect(await screen.findByText('Session page')).toBeInTheDocument()
    expect(action).toHaveBeenCalledWith('7kq2m')
  })

  test("shows why the code didn't work", async () => {
    renderForm(() => ({ error: "There's no live game with the code 7KQ2M." }))

    await userEvent.type(screen.getByRole('textbox', { name: 'Game code' }), '7KQ2M')
    await userEvent.click(screen.getByRole('button', { name: 'Join with a code' }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent("There's no live game with the code 7KQ2M.")
  })
})
