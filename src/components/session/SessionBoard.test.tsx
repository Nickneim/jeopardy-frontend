import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { BoardCategory } from '../../api/sessions'
import SessionBoard from './SessionBoard'

const board: BoardCategory[] = [
  {
    name: 'Rivers',
    comments: null,
    slots: [
      { row: 1, clueId: 1, value: 200, status: 'AVAILABLE' },
      { row: 2, clueId: 2, value: 400, status: 'PLAYED' },
    ],
  },
  {
    name: 'Lakes',
    comments: null,
    slots: [
      { row: 1, clueId: 3, value: 200, status: 'PLAYED' },
      { row: 2, clueId: null, value: null, status: 'EMPTY' },
    ],
  },
]

describe('SessionBoard on a phone', () => {
  test('lists the categories with their clues left, then one category', () => {
    const onChoose = vi.fn()
    render(<SessionBoard board={board} canChoose onChoose={onChoose} compact />)

    expect(screen.getByRole('button', { name: 'Lakes, 0 clues left' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Rivers, 1 clue left' }))

    fireEvent.click(screen.getByRole('button', { name: 'Rivers for $200' }))
    expect(onChoose).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('button', { name: 'Rivers for $400' }))
      .not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '‹ Back' }))
    expect(screen.getByText('Categories')).toBeInTheDocument()
  })

  test("opens the clue in play's category behind the clue", () => {
    render(
      <SessionBoard
        board={board}
        canChoose={false}
        onChoose={() => {}}
        compact
        openColumn={0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Rivers for $200' })).toBeDisabled()
  })
})
