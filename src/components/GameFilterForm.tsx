import { useState, type FormEvent } from 'react'
import type { GameFilters, Season } from '../api/games'

interface GameFilterFormProps {
  filters: GameFilters
  seasons: Season[]
  disabled: boolean
  onSubmit: (filters: GameFilters) => void
}

function seasonLabel(season: Season): string {
  const name = /^\d+$/.test(season.season)
    ? `Season ${season.season}`
    : season.season

  return `${name} (${season.gameCount})`
}

function GameFilterForm({
  filters,
  seasons,
  disabled,
  onSubmit,
}: GameFilterFormProps) {
  // Kept in state so each date input can bound the other (from <= to).
  const [from, setFrom] = useState(filters.from ?? '')
  const [to, setTo] = useState(filters.to ?? '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    onSubmit({
      season: String(formData.get('season') ?? ''),
      title: String(formData.get('title') ?? ''),
      from,
      to,
      includeUnplayable: formData.get('playableOnly') ? '' : 'true',
    })
  }

  return (
    <form
      className="game-filters"
      onSubmit={handleSubmit}
    >
      <label>
        Title
        <input
          type="search"
          name="title"
          defaultValue={filters.title}
        />
      </label>

      <label>
        Season
        <select
          name="season"
          defaultValue={filters.season ?? ''}
        >
          <option value="">All seasons</option>

          {seasons.map(season => (
            <option key={season.season} value={season.season}>
              {seasonLabel(season)}
            </option>
          ))}
        </select>
      </label>

      <label>
        From
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={event => setFrom(event.target.value)}
        />
      </label>

      <label>
        To
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={event => setTo(event.target.value)}
        />
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          name="playableOnly"
          defaultChecked={filters.includeUnplayable !== 'true'}
        />
        Playable games only
      </label>

      <button type="submit" disabled={disabled}>
        Search
      </button>
    </form>
  )
}

export default GameFilterForm
