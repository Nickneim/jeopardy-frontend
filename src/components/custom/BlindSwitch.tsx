interface BlindSwitchProps {
  blind: boolean
  onChange: (blind: boolean) => void
}

// Hides clues and responses on the board and in the import dialogs, so the
// host can play their own show. One setting, shared everywhere.
function BlindSwitch({ blind, onChange }: BlindSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={blind}
      className="custom-switch"
      onClick={() => onChange(!blind)}
    >
      <span className={`custom-switch-track ${blind ? 'is-on' : ''}`}>
        <span className="custom-switch-knob" />
      </span>
      Blind editing
    </button>
  )
}

export default BlindSwitch
