import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import BuzzButton from './BuzzButton'

function renderWith(enabled: boolean) {
  const onBuzz = vi.fn()
  const onOther = vi.fn()

  render(
    <>
      <BuzzButton enabled={enabled} onBuzz={onBuzz} />
      <button type="button" onClick={onOther}>Share link</button>
      <input aria-label="Notes" />
    </>,
  )

  return { onBuzz, onOther }
}

describe('BuzzButton', () => {
  test('Space buzzes while the buzzers are open', async () => {
    const { onBuzz } = renderWith(true)

    await userEvent.keyboard(' ')

    expect(onBuzz).toHaveBeenCalledOnce()
  })

  test('Space buzzes instead of pressing another focused button', async () => {
    const { onBuzz, onOther } = renderWith(true)

    screen.getByRole('button', { name: 'Share link' }).focus()
    await userEvent.keyboard(' ')

    expect(onBuzz).toHaveBeenCalledOnce()
    expect(onOther).not.toHaveBeenCalled()
  })

  test('Space on the focused buzz button buzzes once', async () => {
    const { onBuzz } = renderWith(true)

    screen.getByRole('button', { name: 'Buzz in' }).focus()
    await userEvent.keyboard(' ')

    expect(onBuzz).toHaveBeenCalledOnce()
  })

  test("Space doesn't buzz while typing", async () => {
    const { onBuzz } = renderWith(true)

    await userEvent.type(screen.getByRole('textbox', { name: 'Notes' }), ' ')

    expect(onBuzz).not.toHaveBeenCalled()
  })

  test("Space doesn't buzz while the buzzers are closed", async () => {
    const { onBuzz } = renderWith(false)

    await userEvent.keyboard(' ')

    expect(onBuzz).not.toHaveBeenCalled()
  })
})
