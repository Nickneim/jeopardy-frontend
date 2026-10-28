import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { FinalJeopardy } from '../../api/sessions'
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

    expect(screen.getByRole('heading')).toHaveTextContent('Bob')
    expect(screen.getByText('Wins with $9,600')).toBeInTheDocument()
  })

  test('ranks everyone, tied scores sharing a place', () => {
    render(
      <GameResult
        players={[
          makePlayer({ id: 1, name: 'Alice', score: 2000 }),
          makePlayer({ id: 2, name: 'Bob', score: 400 }),
          makePlayer({ id: 3, name: 'Carol', score: 2000 }),
        ]}
      />,
    )

    expect(screen.getByRole('heading')).toHaveTextContent('Alice & Carol')
    expect(screen.getByText('Tie for first with $2,000')).toBeInTheDocument()

    const rows = screen.getAllByRole('listitem')
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringMatching(/^1stAlice/),
      expect.stringMatching(/^1stCarol/),
      expect.stringMatching(/^3rdBob/),
    ])
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

    expect(screen.getByText('Wins with -$200')).toBeInTheDocument()
  })

  test("shows what Final Jeopardy changed and marks the player's own row", () => {
    const final: FinalJeopardy = {
      category: 'WORLD CAPITALS',
      categoryComments: null,
      question: 'Its name means "good air"',
      numberExpected: false,
      answer: 'Buenos Aires',
      acceptedAnswers: { required: 1, options: ['Buenos Aires'] },
      players: [
        { playerId: 1, hasWagered: true, hasAnswered: true, maxWager: null, wager: 1000, answer: 'What is Buenos Aires?', correct: true, phrasedAsQuestion: true, matchedAnswers: ['Buenos Aires'], alsoAccepted: [], revealStep: null },
        { playerId: 2, hasWagered: true, hasAnswered: true, maxWager: null, wager: 500, answer: 'Lima', correct: false, phrasedAsQuestion: false, matchedAnswers: null, alsoAccepted: null, revealStep: null },
      ],
      revealOrder: null,
    }

    render(
      <GameResult
        players={[
          makePlayer({ id: 1, name: 'Alice', score: 3000 }),
          makePlayer({ id: 2, name: 'Bob', score: 1500 }),
        ]}
        final={final}
        myPlayerId={2}
      />,
    )

    const [alice, bob] = screen.getAllByRole('listitem')
    expect(alice).toHaveTextContent('Final +$1,000')
    expect(bob).toHaveTextContent('Final −$500')
    expect(bob).toHaveTextContent('You')
    expect(alice).not.toHaveTextContent('You')
  })

  test('renders nothing without players', () => {
    const { container } = render(<GameResult players={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
