import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, test, vi } from 'vitest'
import type { CustomGameProblem, HostCustomShowRequest } from '../api/customShows'
import CustomShowPage from './CustomShowPage'

const problems: CustomGameProblem[] = [
  { code: 'SHOW_NAME_MISSING', round: null, column: null, row: null, message: 'This show has no name' },
  {
    code: 'CATEGORY_NAME_MISSING',
    round: 'JEOPARDY',
    column: 3,
    row: null,
    message: 'Category 3 has clues but no name',
  },
]

function renderPage(action: (body: HostCustomShowRequest) => unknown) {
  const router = createMemoryRouter([
    {
      path: '/custom',
      element: <CustomShowPage />,
      action: async ({ request }) => action(await request.json() as HostCustomShowRequest),
    },
  ], { initialEntries: ['/custom'] })

  render(<RouterProvider router={router} />)
}

describe('CustomShowPage', () => {
  test('posts the board to host it, and marks each problem the backend reports', async () => {
    const user = userEvent.setup()
    const action = vi.fn().mockResolvedValue({ error: "This custom show can't be played: 2 problems", problems })
    renderPage(action)

    await user.type(screen.getByLabelText('Your name'), 'Nico')
    await user.click(screen.getByRole('button', { name: 'Host live game' }))

    const rejected = await screen.findByRole('alert')
    expect(within(rejected).getByText("Your show couldn't be hosted")).toBeInTheDocument()
    expect(within(rejected).getByText('This show has no name')).toBeInTheDocument()
    expect(within(rejected).getByText('Category 3 has clues but no name')).toBeInTheDocument()

    expect(action).toHaveBeenCalledWith(expect.objectContaining({
      playerName: 'Nico',
      game: expect.objectContaining({ name: '', finalJeopardy: null }),
    }))

    // Marked on the category itself, until it's named.
    const category = document.getElementById('custom-jeopardy-2')!
    expect(within(category).getByText('No name')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Category #3 name'), 'Our family')

    expect(within(category).queryByText('No name')).not.toBeInTheDocument()
    expect(screen.queryByText('Category 3 has clues but no name')).not.toBeInTheDocument()
    expect(screen.getByText('This show has no name')).toBeInTheDocument()
  })

  test('keeps the draft, and blind editing hides clues but not their badges', async () => {
    const user = userEvent.setup()
    renderPage(vi.fn())

    await user.click(screen.getByRole('button', { name: 'Write the $200 clue in Category #1' }))
    const dialog = screen.getByRole('dialog')
    const [clue, response] = within(dialog).getAllByRole('textbox')
    await user.type(clue, 'The cousin from <i>Lisbon</i>')
    await user.type(response, 'Marta')
    await user.click(within(dialog).getByRole('button', { name: 'Save clue' }))

    const cell = document.getElementById('custom-jeopardy-0-0')!

    // The question's tags render, as in a live game.
    expect(cell.querySelector('.custom-question')).toContainHTML(
      'The cousin from <i>Lisbon</i>',
    )
    expect(within(cell).getByText('Custom')).toBeInTheDocument()
    expect(localStorage.getItem('jeopardy.customShow')).toContain('Marta')

    await user.click(screen.getByRole('switch', { name: 'Blind editing' }))

    expect(within(cell).queryByText('Marta')).not.toBeInTheDocument()
    expect(within(cell).getByText('Response hidden')).toBeInTheDocument()
    expect(within(cell).getByText('Custom')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.queryByText('Response hidden')).not.toBeInTheDocument()
  })
})
