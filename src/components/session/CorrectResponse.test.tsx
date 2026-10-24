import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import CorrectResponse from './CorrectResponse'

const gifts = { required: 2, options: ['gold', 'frankincense', 'myrrh'] }

describe('CorrectResponse', () => {
  test('shows what the player named and the options they left out', () => {
    render(
      <CorrectResponse
        accepted={gifts}
        match={{ matchedAnswers: ['myrrh', 'gold'], alsoAccepted: ['frankincense'] }}
      />,
    )

    expect(screen.getByText('myrrh and gold')).toBeInTheDocument()
    expect(screen.getByText('We would also have accepted frankincense'))
      .toBeInTheDocument()
  })

  test('shows only the wording the player used for anything but a list', () => {
    render(
      <CorrectResponse
        accepted={{ required: 1, options: ['a linen closet'] }}
        match={{ matchedAnswers: ['a linen cupboard'], alsoAccepted: [] }}
      />,
    )

    expect(screen.getByText('a linen cupboard')).toBeInTheDocument()
    expect(screen.queryByText(/closet/)).not.toBeInTheDocument()
    expect(screen.queryByText(/also have accepted/)).not.toBeInTheDocument()
  })

  test('shows the accepted answers when nobody got it right', () => {
    render(<CorrectResponse accepted={gifts} match={null} />)

    expect(screen.getByText('Any 2 of: gold, frankincense, myrrh')).toBeInTheDocument()
    expect(screen.queryByText(/also have accepted/)).not.toBeInTheDocument()
  })

  test('shows nothing before the answer is revealed', () => {
    const { container } = render(<CorrectResponse accepted={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
