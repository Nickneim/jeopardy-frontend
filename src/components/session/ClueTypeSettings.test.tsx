import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { ClueTypeSetting } from '../../api/sessions'
import ClueTypeSettings from './ClueTypeSettings'

const CLUE_TYPES: ClueTypeSetting[] = [
  { type: 'TEXT', clueCount: 48, enabled: true },
  { type: 'IMAGE', clueCount: 12, enabled: true },
  { type: 'VIDEO', clueCount: 1, enabled: false },
]

function renderSettings(clueTypes: ClueTypeSetting[], canEdit = true) {
  const onSave = vi.fn()
  const { rerender } = render(
    <ClueTypeSettings clueTypes={clueTypes} canEdit={canEdit} onSave={onSave} />,
  )
  return { onSave, rerender }
}

describe('ClueTypeSettings', () => {
  test('shows a switch per clue type with its count, text always on', () => {
    renderSettings(CLUE_TYPES)

    expect(screen.getByRole('checkbox', { name: /Text clues \(48\)/ })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Text clues/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Image clues (12)' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Video clues (1)' })).not.toBeChecked()
  })

  test('sends every type left disabled after the change', async () => {
    const { onSave } = renderSettings(CLUE_TYPES)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Image clues (12)' }))
    expect(onSave).toHaveBeenLastCalledWith(['IMAGE', 'VIDEO'])

    await userEvent.click(screen.getByRole('checkbox', { name: 'Video clues (1)' }))
    expect(onSave).toHaveBeenLastCalledWith([])
  })

  test('shows what the server sent, not the click', async () => {
    const { onSave, rerender } = renderSettings(CLUE_TYPES)
    const image = screen.getByRole('checkbox', { name: 'Image clues (12)' })

    await userEvent.click(image)
    expect(image).toBeChecked()

    rerender(
      <ClueTypeSettings
        clueTypes={CLUE_TYPES.map(setting =>
          setting.type === 'IMAGE' ? { ...setting, enabled: false } : setting)}
        canEdit
        onSave={onSave}
      />,
    )
    expect(image).not.toBeChecked()
  })

  test('only shows the other players what the host chose', () => {
    renderSettings(CLUE_TYPES, false)

    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled()
    }
    expect(screen.getByRole('checkbox', { name: 'Video clues (1)' })).not.toBeChecked()
  })

  test('is hidden without media clues', () => {
    renderSettings([{ type: 'TEXT', clueCount: 61, enabled: true }])

    expect(screen.queryByRole('group', { name: 'Clue types' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
