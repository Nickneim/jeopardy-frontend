import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import WagerForm from './WagerForm'

describe('WagerForm', () => {
  test('starts at the minimum, or at a wager already placed', () => {
    const { unmount } = render(
      <WagerForm min={5} max={1000} submitLabel="Wager" onSubmit={vi.fn()} />,
    )
    expect(screen.getByRole('spinbutton')).toHaveValue(5)
    unmount()

    render(
      <WagerForm min={0} max={3000} initialWager={1200} submitLabel="Change wager" onSubmit={vi.fn()} />,
    )
    expect(screen.getByRole('spinbutton')).toHaveValue(1200)
  })

  test('with once, a double click sends one wager', async () => {
    const onSubmit = vi.fn()
    render(<WagerForm min={5} max={1000} submitLabel="Wager" allIn once onSubmit={onSubmit} />)

    await userEvent.dblClick(screen.getByRole('button', { name: 'Wager' }))

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(5)
    expect(screen.getByRole('button', { name: /All in/ })).toBeDisabled()
  })
})
