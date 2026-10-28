import type { ClueType } from '../../api/clues'
import type { ClueTypeSetting } from '../../api/sessions'

const LABELS: Record<ClueType, string> = {
  TEXT: 'Text clues',
  IMAGE: 'Image clues',
  SOUND: 'Sound clues',
  VIDEO: 'Video clues',
}

interface ClueTypeSettingsProps {
  // The session's clueTypes, in the server's order.
  clueTypes: ClueTypeSetting[]
  canEdit: boolean
  onSave: (disabledClueTypes: ClueType[]) => void
}

// Lets the host leave out media clues, which often no longer load
// (api.md §6.9). The switches show the last snapshot: a change only sticks
// once the server broadcasts it.
function ClueTypeSettings({ clueTypes, canEdit, onSave }: ClueTypeSettingsProps) {
  if (!clueTypes.some(({ type }) => type !== 'TEXT')) {
    return null
  }

  function toggle(type: ClueType, enabled: boolean) {
    onSave(clueTypes
      .filter(setting => setting.type === type ? !enabled : !setting.enabled)
      .map(setting => setting.type))
  }

  return (
    <fieldset className="clue-types">
      <legend>Clue types</legend>

      {clueTypes.map(({ type, clueCount, enabled }) => {
        const locked = !canEdit || type === 'TEXT'

        return (
          <label
            key={type}
            className={locked ? 'checkbox-label is-locked' : 'checkbox-label'}
          >
            <input
              type="checkbox"
              checked={enabled}
              disabled={locked}
              onChange={event => toggle(type, event.target.checked)}
            />
            {LABELS[type]} ({clueCount})
            {type === 'TEXT' && <span className="clue-types-note">always on</span>}
          </label>
        )
      })}

      {canEdit && (
        <p className="lobby-note">
          Generally, only the text part of media clues loads correctly.
        </p>
      )}
    </fieldset>
  )
}

export default ClueTypeSettings
