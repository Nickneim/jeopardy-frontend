import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import AnswerForm from './AnswerForm'

describe('AnswerForm', () => {
  test('sends the trimmed answer', async () => {
    const onSubmit = vi.fn()
    render(<AnswerForm label="Your answer" submitLabel="Answer" onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText('Your answer'), '  What is Paris?  ')
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }))

    expect(onSubmit).toHaveBeenCalledWith('What is Paris?')
  })

  test('with once, sends a single answer however often Enter is pressed', async () => {
    const onSubmit = vi.fn()
    render(<AnswerForm label="Your answer" submitLabel="Answer" once onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText('Your answer'), 'What is Paris?{Enter}{Enter}')

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Answer' })).toBeDisabled()
  })

  test('without once, the answer can be sent again (changed)', async () => {
    const onSubmit = vi.fn()
    render(<AnswerForm label="Your answer" submitLabel="Answer" initialAnswer="Rome" onSubmit={onSubmit} />)

    expect(screen.getByLabelText('Your answer')).toHaveValue('Rome')
    await userEvent.type(screen.getByLabelText('Your answer'), '{Enter}{Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  test('shows no hints by default', () => {
    render(<AnswerForm label="Your answer" submitLabel="Answer" onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Your answer')).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByText(/exact number/)).not.toBeInTheDocument()
  })

  test('warns that only the exact number counts', () => {
    render(
      <AnswerForm
        label="Your answer"
        submitLabel="Answer"
        numberExpected
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Your answer'))
      .toHaveAccessibleDescription(/only the exact number counts/)
  })
})
