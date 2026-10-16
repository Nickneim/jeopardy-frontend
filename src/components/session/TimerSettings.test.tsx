import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeSession } from '../../test/fixtures'
import TimerSettings from './TimerSettings'

const { timers } = makeSession()

function renderEditable() {
  const onSave = vi.fn()
  render(<TimerSettings timers={timers} canEdit onSave={onSave} />)
  return { onSave, buzzer: screen.getByLabelText('Buzzer') }
}

describe('TimerSettings', () => {
  test('saves a field when the host leaves it, without a save button', async () => {
    const { onSave, buzzer } = renderEditable()

    await userEvent.clear(buzzer)
    await userEvent.type(buzzer, '8')
    expect(onSave).not.toHaveBeenCalled()

    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ buzzerMs: 8000 })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('saves on Enter too', async () => {
    const { onSave, buzzer } = renderEditable()

    await userEvent.clear(buzzer)
    await userEvent.type(buzzer, '12{Enter}')

    expect(onSave).toHaveBeenCalledWith({ buzzerMs: 12000 })
  })

  test('keeps values within the bounds and ignores empty or unchanged ones', async () => {
    const { onSave, buzzer } = renderEditable()

    await userEvent.clear(buzzer)
    await userEvent.type(buzzer, '0.2')
    await userEvent.tab()
    expect(onSave).toHaveBeenLastCalledWith({ buzzerMs: 1000 })
    expect(buzzer).toHaveValue(1)

    onSave.mockClear()
    await userEvent.click(screen.getByLabelText('Answer'))
    await userEvent.clear(screen.getByLabelText('Answer'))
    await userEvent.tab()
    expect(screen.getByLabelText('Answer')).toHaveValue(5)

    await userEvent.click(screen.getByLabelText('Clue reveal'))
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
  })
})
