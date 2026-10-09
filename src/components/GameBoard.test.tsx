import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GameCategory, GameClue } from '../api/games'
import GameBoard from './GameBoard'

function makeClue(id: number, rowNumber: number): GameClue {
  return {
    id,
    question: `Question ${id}`,
    answer: `Answer ${id}`,
    rowNumber,
    clueType: 'TEXT',
    mediaUrl: null,
  }
}

function makeCategory(
  columnNumber: number,
  clues: GameClue[],
): GameCategory {
  return {
    id: columnNumber,
    name: `Category ${columnNumber}`,
    columnNumber,
    comments: null,
    clues,
  }
}

function column(name: string): HTMLElement {
  const header = screen.getByText(name)
  return header.closest('.category-column') as HTMLElement
}

describe('GameBoard', () => {
  test('values Jeopardy clues at $200 per row', () => {
    render(
      <GameBoard
        categories={[makeCategory(1, [makeClue(1, 1), makeClue(2, 5)])]}
        dailyDoubleClueIds={[]}
        onClueClick={() => {}}
      />,
    )

    const clues = within(column('Category 1')).getAllByRole('button')
    expect(clues.map(clue => clue.textContent)).toEqual(['$200', '$1000'])
  })

  test('values Double Jeopardy clues at $400 per row', () => {
    render(
      <GameBoard
        categories={[makeCategory(7, [makeClue(1, 1), makeClue(2, 5)])]}
        dailyDoubleClueIds={[]}
        onClueClick={() => {}}
      />,
    )

    const clues = within(column('Category 7')).getAllByRole('button')
    expect(clues.map(clue => clue.textContent)).toEqual(['$400', '$2000'])
  })

  test('always renders 5 rows, with empty cells for gaps', () => {
    render(
      <GameBoard
        categories={[makeCategory(1, [makeClue(1, 1), makeClue(3, 3)])]}
        dailyDoubleClueIds={[]}
        onClueClick={() => {}}
      />,
    )

    const cells = column('Category 1').querySelectorAll('.clue-cell')
    expect(cells).toHaveLength(5)
    expect([...cells].map(cell => cell.textContent))
      .toEqual(['$200', '', '$600', '', ''])
  })

  test('marks Daily Doubles and reports clicks with the category', async () => {
    const onClueClick = vi.fn()
    const category = makeCategory(2, [makeClue(10, 2)])

    render(
      <GameBoard
        categories={[category]}
        dailyDoubleClueIds={[10]}
        onClueClick={onClueClick}
      />,
    )

    const clue = screen.getByRole('button', { name: /Daily Double/ })
    await userEvent.click(clue)

    expect(onClueClick).toHaveBeenCalledWith(category.clues[0], category)
  })
})
