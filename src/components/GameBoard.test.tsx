import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
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

// The board with the flipping state its page keeps.
function Board({
  categories,
  dailyDoubleClueIds = [],
}: {
  categories: GameCategory[]
  dailyDoubleClueIds?: number[]
}) {
  const [flipped, setFlipped] = useState<number[]>([])

  return (
    <GameBoard
      categories={categories}
      dailyDoubleClueIds={dailyDoubleClueIds}
      isFlipped={id => flipped.includes(id)}
      onFlip={id => setFlipped(current => current.includes(id)
        ? current.filter(other => other !== id)
        : [...current, id])}
    />
  )
}

function values(): string[] {
  return [...document.querySelectorAll('.board-value')]
    .map(value => value.textContent ?? '')
}

describe('GameBoard', () => {
  test('values Jeopardy clues at $200 per row', () => {
    render(<Board categories={[makeCategory(1, [makeClue(1, 1), makeClue(2, 5)])]} />)

    expect(values()).toEqual(['$200', '$400', '$600', '$800', '$1000'])
  })

  test('values Double Jeopardy clues at $400 per row', () => {
    render(<Board categories={[makeCategory(7, [makeClue(1, 1), makeClue(2, 5)])]} />)

    expect(values()).toEqual(['$400', '$800', '$1200', '$1600', '$2000'])
  })

  test('shows every clue, and says when one is not available', () => {
    render(<Board categories={[makeCategory(1, [makeClue(1, 1), makeClue(3, 3)])]} />)

    expect(screen.getByRole('button', { name: /Question 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Question 3/ })).toBeInTheDocument()
    expect(screen.getAllByText('Clue not available')).toHaveLength(3)
  })

  test('flips a clue to its correct response and back', async () => {
    render(<Board categories={[makeCategory(1, [makeClue(1, 1), makeClue(2, 2)])]} />)

    const clue = screen.getByRole('button', { name: /Question 1/ })
    await userEvent.click(clue)

    expect(clue).toHaveAttribute('aria-pressed', 'true')
    expect(clue).toHaveTextContent('Answer 1')
    expect(clue).not.toHaveTextContent('Question 1')
    // Only that one.
    expect(screen.getByRole('button', { name: /Question 2/ })).toBeInTheDocument()

    await userEvent.click(clue)

    expect(clue).toHaveTextContent('Question 1')
    expect(clue).toHaveAttribute('aria-pressed', 'false')
  })

  test('marks Daily Doubles', () => {
    render(
      <Board
        categories={[makeCategory(2, [makeClue(10, 2)])]}
        dailyDoubleClueIds={[10]}
      />,
    )

    expect(screen.getByRole('button', { name: /Daily Double/ }))
      .toHaveTextContent('Question 10')
  })
})
