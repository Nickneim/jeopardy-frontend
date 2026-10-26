import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, test } from 'vitest'
import { ApiError } from '../api/errors'
import ErrorPage from './ErrorPage'

function renderError(error: unknown) {
  const router = createMemoryRouter([{
    path: '/',
    element: <p>Page</p>,
    errorElement: <ErrorPage />,
    loader: () => { throw error },
    HydrateFallback: () => null,
  }])

  render(<RouterProvider router={router} />)
}

describe('ErrorPage', () => {
  test.each([0, 502, 503, 504])('says the server is offline for status %i', async status => {
    renderError(new ApiError(status, 'Request failed with status code 504'))

    expect(await screen.findByText(/The game server is offline right now/))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument()
  })

  test('shows any other API error as it is', async () => {
    renderError(new ApiError(404, 'Game not found'))

    expect(await screen.findByText('Error 404')).toBeInTheDocument()
    expect(screen.getByText('Game not found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
  })

  test('says a game that no longer exists has ended, with a way to live games', async () => {
    renderError(new ApiError(404, 'Game session not found', 'SESSION_NOT_FOUND'))

    expect(await screen.findByText(/This game has ended/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See the live games' }))
      .toHaveAttribute('href', '/sessions')
    expect(screen.queryByText('Error 404')).not.toBeInTheDocument()
  })

  test('shows a thrown Response as it is', async () => {
    renderError(new Response('Bad page number', { status: 400 }))

    expect(await screen.findByText('Error 400')).toBeInTheDocument()
    expect(screen.getByText('Bad page number')).toBeInTheDocument()
  })
})
