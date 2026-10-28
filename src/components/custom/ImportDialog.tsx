import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  clueValue,
  ROWS,
  type BoardRound,
  type CategoryPosition,
} from '../../api/customShows'
import {
  getGame,
  getGames,
  type Game,
  type GameCategory,
  type GameSummary,
  type PageResponse,
} from '../../api/games'
import { formatAirDate, formatMoney } from '../../format'
import { PHONE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery'
import ClueQuestion from '../ClueQuestion'
import { CrossIcon } from '../session/icons'
import { MediaBadge } from './ClueBadges'
import BlindSwitch from './BlindSwitch'
import { SearchIcon } from './icons'

export type ImportTarget =
  | { kind: 'category', position: CategoryPosition, name: string }
  | { kind: 'final' }

interface ImportDialogProps {
  target: ImportTarget
  // Categories already on the board, which can't be imported again.
  usedCategoryIds: Set<number>
  blind: boolean
  onBlindChange: (blind: boolean) => void
  onImport: (category: GameCategory, game: Game) => void
  onClose: () => void
}

const PAGE_SIZE = 8

interface Results {
  key: string
  games?: PageResponse<GameSummary>
  error?: string
}

// Picks a stored game, then one of its categories (or its Final Jeopardy),
// to fill a place on the board. Only the backend's existing game endpoints
// are used.
function ImportDialog({
  target,
  usedCategoryIds,
  blind,
  onBlindChange,
  onImport,
  onClose,
}: ImportDialogProps) {
  const isFinal = target.kind === 'final'
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [results, setResults] = useState<Results | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [loadingGameId, setLoadingGameId] = useState<number | null>(null)
  const [gameError, setGameError] = useState<string | null>(null)
  const [category, setCategory] = useState<GameCategory | null>(null)
  // A phone shows the games, then the picked game's categories.
  const isPhone = useMediaQuery(PHONE_QUERY)
  const showsDetail = !isPhone || game !== null || gameError !== null
  const showsGames = !isPhone || !showsDetail

  const resultsKey = `${search}|${page}`

  useEffect(() => {
    let current = true
    const filters = isFinal
      ? { finalCategory: search || undefined }
      : { title: search || undefined }

    getGames(page, PAGE_SIZE, filters)
      .then(games => current && setResults({ key: resultsKey, games }))
      .catch((error: Error) => current && setResults({ key: resultsKey, error: error.message }))

    return () => {
      current = false
    }
  }, [isFinal, page, resultsKey, search])

  const loading = results?.key !== resultsKey
  const games = loading ? null : results?.games

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setSearch(query.trim())
    setPage(0)
  }

  async function pickGame(summary: GameSummary) {
    setLoadingGameId(summary.id)
    setGameError(null)
    setCategory(null)

    try {
      const loaded = await getGame(summary.id)
      setGame(loaded)

      if (isFinal) {
        setCategory(loaded.finalJeopardy)
      }
    } catch (error) {
      setGameError((error as Error).message)
    } finally {
      setLoadingGameId(null)
    }
  }

  function backToGames() {
    setGame(null)
    setGameError(null)
    setCategory(null)
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  const targetName = target.kind === 'final' ? 'Final Jeopardy!' : target.name
  const finalClue = isFinal ? category?.clues[0] : undefined
  const canImport = category !== null &&
    !usedCategoryIds.has(category.id) &&
    (!isFinal || finalClue !== undefined)

  return (
    <div className="custom-overlay" onKeyDown={closeOnEscape}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        className="custom-dialog is-wide"
      >
        <div className="custom-dialog-header">
          <div>
            <span className="custom-label">Into {targetName}</span>
            <h2 id="import-dialog-title" className="custom-dialog-title">
              {isFinal ? 'Import a Final Jeopardy!' : 'Import a category'}
            </h2>
          </div>
          <BlindSwitch blind={blind} onChange={onBlindChange} />
          <button
            type="button"
            className="custom-icon-button is-framed"
            aria-label="Close"
            onClick={onClose}
          >
            <CrossIcon size={20} />
          </button>
        </div>

        <div className="custom-import-body">
          {showsGames && (
            <div className="custom-import-games">
              <form className="custom-search" role="search" onSubmit={submitSearch}>
                <label className="custom-field">
                  <span className="custom-label">
                    {isFinal ? 'Search Final Jeopardy! categories' : 'Search games'}
                  </span>
                  <span className="custom-media-row">
                    <input
                      type="search"
                      autoFocus
                      value={query}
                      placeholder={isFinal ? 'Word origins' : 'Show #8612'}
                      onChange={event => setQuery(event.target.value)}
                    />
                    <button type="submit" className="outline-button" aria-label="Search">
                      <SearchIcon />
                    </button>
                  </span>
                </label>
              </form>

              {loading && <p className="custom-help">Loading games…</p>}
              {results?.error && !loading && (
                <p className="form-error" role="alert">{results.error}</p>
              )}

              {games && (
                <>
                  {games.content.length === 0 && (
                    <p className="custom-help">No games match.</p>
                  )}
                  <ul className="custom-game-list">
                    {games.content.map(summary => (
                      <li key={summary.id}>
                        <button
                          type="button"
                          className={`custom-game ${game?.id === summary.id ? 'is-picked' : ''}`}
                          aria-pressed={game?.id === summary.id}
                          disabled={isFinal && summary.finalCategory === null}
                          onClick={() => void pickGame(summary)}
                        >
                          <span className="custom-game-title">{summary.title.split(' - ')[0]}</span>
                          <span className="custom-game-meta">
                            Season {summary.season} · {formatAirDate(summary.gameDate)}
                          </span>
                          {isFinal && (
                            <span className="custom-game-final">
                              {summary.finalCategory ?? 'No Final Jeopardy!'}
                            </span>
                          )}
                          {loadingGameId === summary.id && (
                            <span className="custom-game-meta">Loading…</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="custom-pages">
                    <button
                      type="button"
                      className="outline-button"
                      disabled={games.page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      Newer
                    </button>
                    <span className="custom-help">
                      Page {games.page + 1} of {Math.max(games.totalPages, 1)}
                    </span>
                    <button
                      type="button"
                      className="outline-button"
                      disabled={games.page + 1 >= games.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Older
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {showsDetail && (
            <div className="custom-import-detail">
              {isPhone && (
                <button type="button" className="outline-button custom-import-back" onClick={backToGames}>
                  ‹ Games
                </button>
              )}

              {gameError && <p className="form-error" role="alert">{gameError}</p>}

              {!game && !gameError && (
                <p className="custom-help">
                  {isFinal
                    ? 'Pick a game to see its Final Jeopardy!.'
                    : 'Pick a game to see its categories.'}
                </p>
              )}

              {game && !isFinal && (
                <CategoryPicker
                  game={game}
                  picked={category}
                  usedCategoryIds={usedCategoryIds}
                  onPick={setCategory}
                />
              )}

              {game && category && target.kind === 'category' && (
                <CategoryPreview
                  category={category}
                  round={target.position.round}
                  blind={blind}
                />
              )}

              {game && isFinal && (
                category && finalClue
                  ? (
                    <FinalPreview
                      category={category}
                      question={finalClue.question}
                      answer={finalClue.answer}
                      used={usedCategoryIds.has(category.id)}
                      blind={blind}
                    />
                  )
                  : <p className="custom-help">This game has no Final Jeopardy! clue.</p>
              )}
            </div>
          )}
        </div>

        <div className="custom-dialog-footer">
          <span className="custom-help">
            {category && canImport && `${category.name} replaces what's in ${targetName}.`}
          </span>
          <button type="button" className="outline-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="gold-button"
            disabled={!canImport}
            onClick={() => game && category && onImport(category, game)}
          >
            {isFinal ? 'Use this Final Jeopardy!' : `Fill ${targetName}`}
          </button>
        </div>
      </section>
    </div>
  )
}

interface CategoryPickerProps {
  game: Game
  picked: GameCategory | null
  usedCategoryIds: Set<number>
  onPick: (category: GameCategory) => void
}

function CategoryPicker({ game, picked, usedCategoryIds, onPick }: CategoryPickerProps) {
  const rounds = [
    { name: 'Jeopardy!', categories: game.jeopardyRound },
    { name: 'Double Jeopardy!', categories: game.doubleJeopardyRound },
  ]

  return (
    <div className="custom-category-picker">
      {rounds.map(round => (
        <div key={round.name} className="custom-picker-round">
          <h3 className="custom-section-title">{round.name}</h3>
          {round.categories.length === 0 && (
            <p className="custom-help">No categories in this round.</p>
          )}
          <div className="custom-tiles">
            {round.categories.map(category => {
              const used = usedCategoryIds.has(category.id)

              return (
                <button
                  key={category.id}
                  type="button"
                  className={`custom-tile ${picked?.id === category.id ? 'is-picked' : ''}`}
                  aria-pressed={picked?.id === category.id}
                  disabled={used || category.clues.length === 0}
                  onClick={() => onPick(category)}
                >
                  <span className="custom-tile-name">{category.name}</span>
                  <span className="custom-tile-count">
                    {used ? 'On your board' : `${category.clues.length} clues`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

interface CategoryPreviewProps {
  category: GameCategory
  // The round it goes into: values follow the rows there.
  round: BoardRound
  blind: boolean
}

function CategoryPreview({ category, round, blind }: CategoryPreviewProps) {
  const fromRound: BoardRound = category.columnNumber > 6 ? 'DOUBLE_JEOPARDY' : 'JEOPARDY'

  return (
    <div className="custom-preview">
      <h3 className="custom-preview-title">{category.name}</h3>
      {Array.from({ length: ROWS }, (_, row) => {
        const clue = category.clues.find(clue => clue.rowNumber === row + 1)
        const value = formatMoney(clueValue(round, row))
        const was = formatMoney(clueValue(fromRound, row))

        return (
          <div key={row} className={`custom-preview-row ${clue ? '' : 'is-missing'}`}>
            <span className="custom-value">
              {value}
              {was !== value && <s>{was}</s>}
            </span>
            {!clue && <span className="custom-help">No clue in this row</span>}
            {clue && blind && (
              <>
                <span className="custom-hidden" aria-label="Clue hidden"><span /></span>
                <span className="custom-answer is-hidden">Response hidden</span>
              </>
            )}
            {clue && !blind && (
              <>
                <span className="custom-question">
                  <ClueQuestion html={clue.question} />
                </span>
                <span className="custom-answer">{clue.answer}</span>
              </>
            )}
            <span>{clue && <MediaBadge clueType={clue.clueType} />}</span>
          </div>
        )
      })}
    </div>
  )
}

interface FinalPreviewProps {
  category: GameCategory
  question: string
  answer: string
  used: boolean
  blind: boolean
}

function FinalPreview({ category, question, answer, used, blind }: FinalPreviewProps) {
  return (
    <div className="custom-final-preview">
      <div className="custom-final-preview-category">
        <span className="custom-label">Category</span>
        <strong>{category.name}</strong>
        {used && <span className="custom-help">Already on your board</span>}
      </div>
      <div className="custom-screen">
        {blind
          ? <span className="custom-hidden is-large" aria-label="Clue hidden"><span /><span /><span /></span>
          : <p className="custom-screen-clue"><ClueQuestion html={question} /></p>}
        <span className="custom-label">Correct response</span>
        <span className="custom-screen-response">{blind ? 'Hidden' : answer}</span>
      </div>
    </div>
  )
}

export default ImportDialog
