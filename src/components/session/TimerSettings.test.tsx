import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_TIMER_MODES, DEFAULT_TIMERS } from '../../api/sessions'
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
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
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
    expect(screen.getByLabelText('Answer')).toHaveValue(15)

    await userEvent.click(screen.getByLabelText('Clue reveal'))
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('TimerSettings reset', () => {
  test('has a reset next to every timer, enabled only when it differs from the default', async () => {
    const onSave = vi.fn()
    render(
      <TimerSettings
        timers={{ ...DEFAULT_TIMERS, buzzerMs: 8000 }}
        canEdit
        onSave={onSave}
      />,
    )

    const resets = screen.getAllByRole('button', { name: /^Reset / })
    expect(resets).toHaveLength(11)
    expect(resets.filter(button => !(button as HTMLButtonElement).disabled))
      .toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Reset Answer to the default, 15s' }))
      .toBeDisabled()

    await userEvent.click(
      screen.getByRole('button', { name: 'Reset Buzzer to the default, 10s' }),
    )

    expect(onSave).toHaveBeenCalledWith({ buzzerMs: 10000 })
  })

  test("switches a Trebek game's timer between automatic and waiting for Trebek", async () => {
    const onSaveModes = vi.fn()
    render(
      <TimerSettings
        timers={timers}
        modes={DEFAULT_TIMER_MODES}
        canEdit
        onSave={() => {}}
        onSaveModes={onSaveModes}
      />,
    )

    // The clue reveal waits for Trebek by default: no clock to set.
    const reveal = screen.getByRole('group', { name: 'Clue reveal mode' })
    expect(within(reveal).getByRole('button', { name: 'Trebek' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('Clue reveal')).not.toBeInTheDocument()

    await userEvent.click(within(reveal).getByRole('button', { name: 'Automatic' }))
    expect(onSaveModes).toHaveBeenCalledWith({ clueRevealMs: 'AUTOMATIC' })
  })
})
