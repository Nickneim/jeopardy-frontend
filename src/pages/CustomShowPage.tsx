import { useEffect, useState, type ChangeEvent } from 'react'
import {
  useFetcher,
  useLoaderData,
  useSearchParams,
  type SubmitTarget,
} from 'react-router'
import {
  BOARD_ROUNDS,
  BOARD_SIZE,
  categoryName,
  clueCount,
  clueValue,
  customGameRequest,
  dailyDoubleCount,
  draftFromGame,
  emptyCategory,
  emptyDraft,
  emptyFinal,
  FINAL_DEFAULT_NAME,
  gameSource,
  hasFinalClue,
  importCategory,
  importedCategoryIds,
  importFinal,
  isEmptyDraft,
  loadBlind,
  MAX_DAILY_DOUBLES,
  openProblems,
  readShowFile,
  saveBlind,
  setClue,
  showFile,
  showFileName,
  swapCategories,
  swapClues,
  toggleDailyDouble,
  updateCategory,
  type BoardRound,
  type CategoryPosition,
  type CluePosition,
  type CustomGameProblem,
  type CustomShowLoaderData,
  type Draft,
  type DraftClue,
  type HostCustomShowData,
  type HostCustomShowRequest,
} from '../api/customShows'
import type { Game } from '../api/games'
import { getRememberedPlayerName, MAX_NAME_LENGTH } from '../api/sessions'
import ClueQuestion from '../components/ClueQuestion'
import BlindSwitch from '../components/custom/BlindSwitch'
import {
  problemElementId,
  SHOW_NAME_ID,
  type DragItem,
} from '../components/custom/board'
import ClueBadges from '../components/custom/ClueBadges'
import ClueDialog, { type ClueFields } from '../components/custom/ClueDialog'
import CustomBoard from '../components/custom/CustomBoard'
import ImportDialog, { type ImportTarget } from '../components/custom/ImportDialog'
import {
  ImportIcon,
  PlusIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
} from '../components/custom/icons'
import ProblemMarker from '../components/custom/ProblemMarker'
import ConfirmButton from '../components/session/ConfirmButton'
import { CrossIcon } from '../components/session/icons'
import { formatMoney, ROUND_NAMES } from '../format'
import { useDraftHistory } from '../hooks/useDraftHistory'
import '../customShow.css'

type EditTarget =
  | { kind: 'clue', position: CluePosition }
  | { kind: 'final' }

// A board waiting for the host to agree to replace theirs: from a file, or
// a game from the catalog.
interface PendingDraft {
  name: string
  draft: Draft
}

const TOAST_MS = 6000

function sameFields(clue: DraftClue, fields: ClueFields): boolean {
  return clue.question === fields.question &&
    clue.answer === fields.answer &&
    clue.clueType === fields.clueType &&
    (clue.mediaUrl ?? '') === (fields.mediaUrl ?? '')
}

// Where a problem is, in words, with the board's current names.
function problemPlace(problem: CustomGameProblem, draft: Draft): string {
  const { round, column, row } = problem

  if (round === null) {
    return 'The show'
  }

  if (round === 'FINAL_JEOPARDY' || column === null) {
    return ROUND_NAMES[round]
  }

  const position = { round, column: column - 1 }
  const category = draft.rounds[round][column - 1]
  const name = category ? categoryName(category, position) : `Column ${column}`

  return row === null
    ? `${name} · ${ROUND_NAMES[round]}`
    : `${name} · ${formatMoney(clueValue(round, row - 1))}`
}

function goToProblem(problem: CustomGameProblem) {
  const element = document.getElementById(problemElementId(problem))

  element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  const focusable = element?.matches('input, button')
    ? element
    : element?.querySelector<HTMLElement>('input, button')
  focusable?.focus({ preventScroll: true })
}

// Builds a custom show in the browser, then hosts it: the draft is kept in
// this browser only, and the backend sees the board only when it's hosted.
function CustomShowPage() {
  const { draft, change, undo, redo, canUndo, canRedo } = useDraftHistory()
  const [blind, setBlindState] = useState(loadBlind)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [importing, setImporting] = useState<ImportTarget | null>(null)
  const [dragging, setDragging] = useState<DragItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState(getRememberedPlayerName)
  const fetcher = useFetcher<HostCustomShowData>()
  // The board as it was sent, to tell which problems are fixed since.
  const [hosted, setHosted] = useState<Draft | null>(null)

  const isHosting = fetcher.state !== 'idle'
  const problems = !isHosting && hosted && fetcher.data?.problems
    ? openProblems(fetcher.data.problems, hosted, draft)
    : []

  const { game } = useLoaderData() as CustomShowLoaderData
  const [, setSearchParams] = useSearchParams()
  const [loadedGame, setLoadedGame] = useState<Game | null>(null)

  // A game from the catalog's "Host custom", once per arrival: it fills an
  // empty board right away, and asks before replacing one.
  if (game && game !== loadedGame) {
    const loaded = draftFromGame(game)
    setLoadedGame(game)

    if (isEmptyDraft(draft)) {
      change(() => loaded)
      setToast(`Loaded ${game.title}`)
    } else {
      setPendingDraft({ name: game.title, draft: loaded })
    }
  }

  // The parameter goes, so a reload doesn't load the game again.
  useEffect(() => {
    if (game) {
      setSearchParams({}, { replace: true })
    }
  }, [game, setSearchParams])

  const setBlind = (value: boolean) => {
    setBlindState(value)
    saveBlind(value)
  }

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y), except in a field, which has its own.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const inField = target.closest('input, textarea, select, [role="dialog"]')

      if (inField || !(event.ctrlKey || event.metaKey)) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  const problemsAt = (round: BoardRound) =>
    (column: number, row: number | null) => problems.filter(problem =>
      problem.round === round &&
      problem.column === column + 1 &&
      problem.row === (row === null ? null : row + 1))

  const roundProblems = (round: BoardRound) => problems.filter(problem =>
    problem.round === round && problem.column === null)
  const finalProblems = problems.filter(problem => problem.round === 'FINAL_JEOPARDY')
  const showProblems = problems.filter(problem => problem.round === null)

  function trashCategory(position: CategoryPosition) {
    const name = categoryName(draft.rounds[position.round][position.column], position)
    change(current => updateCategory(current, position, emptyCategory))
    setToast(`${name} trashed`)
  }

  function trashClue(position: CluePosition) {
    change(current => setClue(current, position, null))
    setToast(`The ${formatMoney(clueValue(position.round, position.row))} clue trashed`)
  }

  function drop(target: DragItem) {
    const item = dragging
    setDragging(null)

    if (!item) {
      return
    }

    if (item.kind === 'clue' && target.kind === 'clue') {
      change(current => swapClues(current, item.position, item.position.row, target.position.row))
    } else if (item.kind === 'category' && target.kind === 'category') {
      change(current => swapCategories(current, item.position, target.position))
    }
  }

  function dropInTrash() {
    const item = dragging
    setDragging(null)

    if (item?.kind === 'clue') {
      trashClue(item.position)
    } else if (item?.kind === 'category') {
      trashCategory(item.position)
    }
  }

  function saveClue(position: CluePosition, fields: ClueFields) {
    const current = draft.rounds[position.round][position.column].clues[position.row]
    const empty = !fields.question.trim() && !fields.answer.trim() &&
      fields.clueType === 'TEXT'
    setEditing(null)

    if (current && sameFields(current, fields)) {
      return
    }

    change(draft => setClue(draft, position, empty
      ? null
      : {
        ...fields,
        mediaUrl: fields.clueType === 'TEXT' ? null : fields.mediaUrl,
        dailyDouble: current?.dailyDouble ?? false,
        custom: true,
      }))
  }

  function saveFinal(fields: ClueFields) {
    const final = draft.final
    setEditing(null)

    if (final.question === fields.question && final.answer === fields.answer) {
      return
    }

    change(draft => ({
      ...draft,
      final: { ...draft.final, question: fields.question, answer: fields.answer, custom: true },
    }))
  }

  function host() {
    const body: HostCustomShowRequest = {
      playerName,
      game: customGameRequest(draft),
    }

    setHosted(draft)
    void fetcher.submit(body as unknown as SubmitTarget, {
      method: 'post',
      action: '/custom',
      encType: 'application/json',
    })
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(showFile(draft), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = showFileName(draft)
    link.click()
    URL.revokeObjectURL(url)
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // So choosing the same file again still counts as a change.
    event.target.value = ''

    if (!file) {
      return
    }

    const loaded = readShowFile(await file.text())
    setFileError(null)

    if (!loaded) {
      setFileError(`Can't load ${file.name}: it isn't a custom show exported from here. Your board hasn't changed.`)
    } else if (isEmptyDraft(draft)) {
      change(() => loaded)
      setToast(`Loaded ${file.name}`)
    } else {
      setPendingDraft({ name: file.name, draft: loaded })
    }
  }

  const count = clueCount(draft)
  const usedIds = importedCategoryIds(draft)
  const final = draft.final
  const finalHasClue = hasFinalClue(final)

  const editingClue = editing?.kind === 'clue'
    ? draft.rounds[editing.position.round][editing.position.column].clues[editing.position.row]
    : null

  const boardActions = {
    onRename: (position: CategoryPosition, name: string) => change(
      current => updateCategory(current, position, category => ({ ...category, name })),
      `name ${position.round} ${position.column}`,
    ),
    onImport: (position: CategoryPosition) => setImporting({
      kind: 'category',
      position,
      name: categoryName(draft.rounds[position.round][position.column], position),
    }),
    onTrashCategory: trashCategory,
    onEditClue: (position: CluePosition) => setEditing({ kind: 'clue', position }),
    onTrashClue: trashClue,
    onToggleDailyDouble: (position: CluePosition) =>
      change(current => toggleDailyDouble(current, position)),
    onDragStart: setDragging,
    onDragEnd: () => setDragging(null),
    onDrop: drop,
  }

  return (
    <main className="site-page custom-page">
      <header className="custom-header">
        <div className="custom-header-main">
          <h1>Host a custom show</h1>

          <label className="custom-field">
            <span className="custom-label">Show name</span>
            <span className="custom-show-name-row">
              <input
                id={SHOW_NAME_ID}
                className="custom-show-name"
                value={draft.name}
                placeholder="Name your show"
                onChange={event => {
                  const name = event.target.value
                  change(current => ({ ...current, name }), 'show name')
                }}
              />
              <ProblemMarker problems={showProblems} />
            </span>
          </label>

          <p className="custom-hint">
            {count} of {BOARD_SIZE} clues written · empty clues show as unavailable
            on the board · <span className="custom-badge is-custom">Custom</span>{' '}
            marks clues you wrote or changed
          </p>

          <div className="custom-file-row">
            <button
              type="button"
              className="custom-icon-button"
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              disabled={!canUndo}
              onClick={undo}
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              className="custom-icon-button"
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              disabled={!canRedo}
              onClick={redo}
            >
              <RedoIcon />
            </button>
            <span className="custom-label is-quiet">Saved in this browser</span>

            <label className="outline-button custom-file-button">
              <UploadIcon />
              Import file
              <input
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                onChange={event => void chooseFile(event)}
              />
            </label>
            <button type="button" className="outline-button" onClick={exportFile}>
              <ImportIcon />
              Export file
            </button>
            <ConfirmButton
              label="Start over"
              className="outline-button is-quiet"
              question={isEmptyDraft(draft)
                ? null
                : `Start over with an empty board? All ${count} clues are cleared.`}
              confirmLabel="Yes, start over"
              onConfirm={() => change(() => emptyDraft())}
            />
          </div>

          {fileError && (
            <p className="form-error" role="alert">
              {fileError}{' '}
              <button type="button" className="custom-link-button" onClick={() => setFileError(null)}>
                Dismiss
              </button>
            </p>
          )}

          {pendingDraft && (
            <div className="custom-prompt" role="alertdialog" aria-labelledby="file-prompt-title">
              <h2 id="file-prompt-title">Replace your board?</h2>
              <p>
                {pendingDraft.name} has {clueCount(pendingDraft.draft)} of {BOARD_SIZE} clues.
                Your current board and its {count} clues will be replaced. Export it
                first if you want to keep it.
              </p>
              <div className="custom-prompt-actions">
                <button
                  type="button"
                  className="gold-button"
                  onClick={() => {
                    change(() => pendingDraft.draft)
                    setPendingDraft(null)
                  }}
                >
                  Yes, replace it
                </button>
                <button type="button" className="outline-button" onClick={exportFile}>
                  Export mine first
                </button>
                <button type="button" className="outline-button" onClick={() => setPendingDraft(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="custom-header-side">
          <BlindSwitch blind={blind} onChange={setBlind} />

          <form
            className="host-form"
            onSubmit={event => {
              event.preventDefault()
              host()
            }}
          >
            <label>
              Your name
              <input
                name="playerName"
                required
                maxLength={MAX_NAME_LENGTH}
                autoComplete="nickname"
                value={playerName}
                onChange={event => setPlayerName(event.target.value)}
              />
            </label>
            <button type="submit" className="gold-button" disabled={isHosting}>
              {isHosting ? 'Hosting…' : 'Host live game'}
            </button>
          </form>

          {!isHosting && fetcher.data?.error && !fetcher.data.problems && (
            <p className="form-error" role="alert">{fetcher.data.error}</p>
          )}
        </div>
      </header>

      {problems.length > 0 && (
        <section className="custom-rejected" role="alert" aria-labelledby="rejected-title">
          <h2 id="rejected-title">
            <CrossIcon size={22} />
            Your show couldn't be hosted
          </h2>
          <p>
            Fix {problems.length === 1 ? 'this problem' : `these ${problems.length} problems`},
            then host again. Each stays marked on the board until you edit it.
          </p>
          <ul className="custom-problem-list">
            {problems.map((problem, index) => (
              <li key={index}>
                <CrossIcon size={18} />
                <span>
                  <strong>{problemPlace(problem, draft)}</strong>
                  {problem.message}
                </span>
                <button type="button" className="outline-button" onClick={() => goToProblem(problem)}>
                  Go to
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {BOARD_ROUNDS.map(round => {
        const pinned = dailyDoubleCount(draft.rounds[round])
        const max = MAX_DAILY_DOUBLES[round]

        return (
          <section
            key={round}
            id={`custom-${round.toLowerCase()}`}
            className="round-section"
            aria-labelledby={`custom-${round}-title`}
          >
            <div className="custom-round-heading">
              <h2 id={`custom-${round}-title`} className="round-title">{ROUND_NAMES[round]}</h2>
              <p className="custom-hint">
                <span className={`custom-badge is-daily-double ${pinned > max ? 'is-over' : ''}`}>
                  {pinned} of {max} Daily Double{max > 1 ? 's' : ''} pinned
                </span>{' '}
                {formatMoney(clueValue(round, 0))} to {formatMoney(clueValue(round, 4))} ·
                drag a clue to another row to change its value, drag a category to swap it
              </p>
              <ProblemMarker problems={roundProblems(round)} />
            </div>

            <CustomBoard
              {...boardActions}
              round={round}
              categories={draft.rounds[round]}
              blind={blind}
              dragging={dragging}
              dailyDoublesFull={pinned >= max}
              problemsAt={problemsAt(round)}
            />
          </section>
        )
      })}

      <section
        id="custom-final_jeopardy"
        className="round-section"
        aria-labelledby="custom-final-title"
      >
        <div className="custom-round-heading">
          <h2 id="custom-final-title" className="round-title">Final Jeopardy!</h2>
          <p className="custom-hint">One category, one clue · players wager before they see it</p>
        </div>

        <div className={`custom-final ${finalProblems.length > 0 ? 'has-problem' : ''}`}>
          <div className="custom-category is-final">
            <div className="custom-tools">
              <span className="custom-label">Category</span>
              <button
                type="button"
                className="custom-tool-button"
                aria-label="Import a Final Jeopardy!"
                onClick={() => setImporting({ kind: 'final' })}
              >
                <ImportIcon />
                Import
              </button>
              <button
                type="button"
                className="custom-icon-button"
                aria-label="Trash Final Jeopardy!"
                title="Trash Final Jeopardy!"
                onClick={() => {
                  change(current => ({ ...current, final: emptyFinal() }))
                  setToast('Final Jeopardy! trashed')
                }}
              >
                <TrashIcon />
              </button>
            </div>
            <input
              className="custom-category-name"
              aria-label="Final Jeopardy! category name"
              placeholder={FINAL_DEFAULT_NAME}
              value={final.name ?? ''}
              onChange={event => {
                const name = event.target.value
                change(current => ({ ...current, final: { ...current.final, name } }), 'final name')
              }}
            />
            {final.source && <p className="custom-source">From {final.source}</p>}
            <ProblemMarker problems={finalProblems} />
          </div>

          <div className={`custom-cell is-final ${finalHasClue ? '' : 'is-empty'}`}>
            <button
              type="button"
              className="custom-clue"
              aria-label={finalHasClue ? 'Edit the Final Jeopardy! clue' : 'Write the Final Jeopardy! clue'}
              onClick={() => setEditing({ kind: 'final' })}
            >
              {finalHasClue
                ? (
                  <>
                    <span className="custom-cell-top">
                      <span className="custom-label">Clue</span>
                      <ClueBadges clue={final} />
                    </span>
                    {blind
                      ? (
                        <>
                          <span className="custom-hidden is-large" aria-label="Clue hidden">
                            <span />
                            <span />
                            <span />
                          </span>
                          <span className="custom-answer is-hidden">Response hidden</span>
                        </>
                      )
                      : (
                        <>
                          <span className="custom-question">
                            <ClueQuestion html={final.question} />
                          </span>
                          <span className="custom-answer">{final.answer}</span>
                        </>
                      )}
                  </>
                )
                : (
                  <span className="custom-write">
                    <PlusIcon />
                    Write clue
                  </span>
                )}
            </button>
          </div>
        </div>
      </section>

      {dragging && (
        <div
          className="custom-trash-bar"
          onDragOver={event => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={event => {
            event.preventDefault()
            dropInTrash()
          }}
        >
          <TrashIcon size={26} />
          Drop here to trash
        </div>
      )}

      {toast && (
        <div className="custom-toast" role="status">
          <span>{toast}</span>
          <button
            type="button"
            className="gold-button"
            onClick={() => {
              undo()
              setToast(null)
            }}
          >
            <UndoIcon size={18} />
            Undo
          </button>
        </div>
      )}

      {editing?.kind === 'clue' && (
        <ClueDialog
          context={[
            categoryName(draft.rounds[editing.position.round][editing.position.column], editing.position),
            ROUND_NAMES[editing.position.round],
            `row ${editing.position.row + 1}`,
          ].join(' · ')}
          title={`${editingClue ? 'Edit' : 'Write'} the ${formatMoney(clueValue(editing.position.round, editing.position.row))} clue`}
          initial={editingClue ?? { question: '', answer: '', clueType: 'TEXT', mediaUrl: null }}
          allowMedia
          onSave={fields => saveClue(editing.position, fields)}
          onTrash={() => {
            setEditing(null)

            if (editingClue) {
              trashClue(editing.position)
            }
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {editing?.kind === 'final' && (
        <ClueDialog
          context={final.name?.trim() || FINAL_DEFAULT_NAME}
          title="Final Jeopardy! clue"
          initial={{ question: final.question, answer: final.answer, clueType: 'TEXT', mediaUrl: null }}
          allowMedia={false}
          onSave={saveFinal}
          onTrash={() => {
            setEditing(null)
            change(current => ({
              ...current,
              final: { ...current.final, question: '', answer: '', custom: false },
            }))
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {importing && (
        <ImportDialog
          target={importing}
          usedCategoryIds={usedIds}
          blind={blind}
          onBlindChange={setBlind}
          onImport={(category, game) => {
            const target = importing
            setImporting(null)
            change(current => target.kind === 'final'
              ? importFinal(current, category, gameSource(game))
              : importCategory(current, target.position, category, gameSource(game)))
          }}
          onClose={() => setImporting(null)}
        />
      )}
    </main>
  )
}

export default CustomShowPage
