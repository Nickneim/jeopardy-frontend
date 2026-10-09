import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { makePlayer } from '../../test/fixtures'
import GameResult from './GameResult'

describe('GameResult', () => {
  test('names the player with the highest score', () => {
    render(
      <GameResult
        players={[
          makePlayer({ id: 1, name: 'Alice', score: 4000 }),
          makePlayer({ id: 2, name: 'Bob', score: 9600 }),
        ]}
      />,
    )

    expect(screen.getByText('Bob wins with $9,600!')).toBeInTheDocument()
  })

  test('reports a tie between everyone on the top score', () => {
    render(
      <GameResult
        players={[
          makePlayer({ id: 1, name: 'Alice', score: 2000 }),
          makePlayer({ id: 2, name: 'Bob', score: 2000 }),
          makePlayer({ id: 3, name: 'Carol', score: 400 }),
        ]}
      />,
    )

    expect(screen.getByText("It's a tie between Alice and Bob at $2,000!"))
      .toBeInTheDocument()
  })

  test('still finds a winner when every score is negative', () => {
    render(
      <GameResult
        players={[
          makePlayer({ id: 1, name: 'Alice', score: -800 }),
          makePlayer({ id: 2, name: 'Bob', score: -200 }),
        ]}
      />,
    )

    expect(screen.getByText('Bob wins with -$200!')).toBeInTheDocument()
  })

  test('renders nothing without players', () => {
    const { container } = render(<GameResult players={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
