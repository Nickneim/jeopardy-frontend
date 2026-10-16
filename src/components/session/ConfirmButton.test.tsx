import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import ConfirmButton from './ConfirmButton'

describe('ConfirmButton', () => {
  test('asks on the page before acting', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmButton
        label="Leave game"
        question="Leave the game?"
        confirmLabel="Yes, leave"
        onConfirm={onConfirm}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Leave game' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'Leave the game?' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Yes, leave' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Leave game' })).toBeInTheDocument()
  })

  test('does nothing when cancelled', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmButton
        label="Kick"
        question="Remove Bob from the game?"
        confirmLabel="Yes, kick"
        onConfirm={onConfirm}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Kick' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Kick' })).toBeInTheDocument()
  })

  test('acts at once without a question', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmButton
        label="Leave game"
        question={null}
        confirmLabel="Yes, leave"
        onConfirm={onConfirm}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Leave game' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
