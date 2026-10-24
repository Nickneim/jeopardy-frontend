import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { ClueAnswer } from '../../api/sessions'
import { makePlayer } from '../../test/fixtures'
import ClueAnswers from './ClueAnswers'

const alice = makePlayer({ id: 1, name: 'Alice' })
const bob = makePlayer({ id: 2, name: 'Bob' })

const notAQuestion: ClueAnswer = {
  playerId: 1,
  answer: 'Paris',
  correct: false,
  phrasedAsQuestion: false,
  matchedAnswers: null,
  alsoAccepted: null,
}

describe('ClueAnswers', () => {
  test('warns only the player who left out the question form in the Jeopardy round', () => {
    const answers = [{ ...notAQuestion, correct: true }]
    const { unmount } = render(
      <ClueAnswers answers={answers} players={[alice, bob]} round="JEOPARDY" me={alice} />,
    )

    expect(screen.getByText(/Remember to phrase it as a question/)).toBeInTheDocument()
    expect(screen.queryByText(/not phrased as a question/)).not.toBeInTheDocument()

    unmount()
    render(<ClueAnswers answers={answers} players={[alice, bob]} round="JEOPARDY" me={bob} />)

    expect(screen.queryByText(/Remember to phrase it/)).not.toBeInTheDocument()
  })

  test('explains a wrong answer without the question form from Double Jeopardy on', () => {
    render(
      <ClueAnswers
        answers={[notAQuestion]}
        players={[alice, bob]}
        round="DOUBLE_JEOPARDY"
        me={alice}
      />,
    )

    expect(screen.getByRole('listitem')).toHaveTextContent('(not phrased as a question)')
    expect(screen.queryByText(/Remember to phrase it/)).not.toBeInTheDocument()
  })

  test('says nothing about the question form when it was used or time ran out', () => {
    render(
      <ClueAnswers
        answers={[
          { ...notAQuestion, answer: 'What is Paris?', phrasedAsQuestion: true },
          { playerId: 2, answer: null, correct: false, phrasedAsQuestion: null, matchedAnswers: null, alsoAccepted: null },
        ]}
        players={[alice, bob]}
        round="DOUBLE_JEOPARDY"
        me={alice}
      />,
    )

    expect(screen.queryByText(/not phrased as a question/)).not.toBeInTheDocument()
    expect(screen.getByText('ran out of time')).toBeInTheDocument()
  })
})
