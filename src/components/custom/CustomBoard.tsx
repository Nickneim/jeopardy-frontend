import { useState, type DragEvent } from 'react'
import {
  categoryName,
  clueValue,
  defaultCategoryName,
  type BoardRound,
  type CategoryPosition,
  type CluePosition,
  type CustomGameProblem,
  type DraftCategory,
  type DraftClue,
} from '../../api/customShows'
import { formatMoney } from '../../format'
import ClueQuestion from '../ClueQuestion'
import {
  canDrop,
  categoryElementId,
  clueElementId,
  type DragItem,
} from './board'
import ClueBadges from './ClueBadges'
import { GripIcon, ImportIcon, PlusIcon, StarIcon, TrashIcon } from './icons'
import ProblemMarker from './ProblemMarker'

export interface BoardActions {
  onRename: (position: CategoryPosition, name: string) => void
  onImport: (position: CategoryPosition) => void
  onTrashCategory: (position: CategoryPosition) => void
  onEditClue: (position: CluePosition) => void
  onTrashClue: (position: CluePosition) => void
  onToggleDailyDouble: (position: CluePosition) => void
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
  onDrop: (target: DragItem) => void
}

interface CustomBoardProps extends BoardActions {
  round: BoardRound
  categories: DraftCategory[]
  // Hides every clue and response, for a host who plays their own board.
  blind: boolean
  dragging: DragItem | null
  // Pinning another Daily Double would be one too many.
  dailyDoublesFull: boolean
  // The problems the backend reported at a 0-based column and row.
  problemsAt: (column: number, row: number | null) => CustomGameProblem[]
}

// Starts a drag. Firefox only drags with some data set.
function startDrag(event: DragEvent, item: DragItem, onDragStart: (item: DragItem) => void) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', '')
  onDragStart(item)
}

// One round's board in the editor: each category's header, then its five
// rows, every one editable.
function CustomBoard(props: CustomBoardProps) {
  const { round, categories } = props

  return (
    <div className="board-scroll">
      <div className="custom-board">
        {categories.map((category, column) => (
          <div key={column} className="custom-column">
            <CategoryHeader
              {...props}
              category={category}
              position={{ round, column }}
            />

            {category.clues.map((clue, row) => (
              <ClueCell
                key={row}
                {...props}
                clue={clue}
                categoryLabel={categoryName(category, { round, column })}
                position={{ round, column, row }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Highlights a drop target while a drag is over it, and drops there.
function useDropTarget(
  target: DragItem,
  dragging: DragItem | null,
  onDrop: (target: DragItem) => void,
) {
  const [over, setOver] = useState(false)
  const accepts = dragging !== null && canDrop(dragging, target)

  return {
    isOver: accepts && over,
    handlers: accepts
      ? {
        onDragOver: (event: DragEvent) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setOver(true)
        },
        onDragLeave: () => setOver(false),
        onDrop: (event: DragEvent) => {
          event.preventDefault()
          setOver(false)
          onDrop(target)
        },
      }
      : {},
  }
}

interface CategoryHeaderProps extends CustomBoardProps {
  category: DraftCategory
  position: CategoryPosition
}

function CategoryHeader({
  category,
  position,
  dragging,
  problemsAt,
  onRename,
  onImport,
  onTrashCategory,
  onDragStart,
  onDragEnd,
  onDrop,
}: CategoryHeaderProps) {
  const name = categoryName(category, position)
  const problems = problemsAt(position.column, null)
  const { isOver, handlers } = useDropTarget(
    { kind: 'category', position },
    dragging,
    onDrop,
  )
  const isDragged = dragging?.kind === 'category' &&
    dragging.position.round === position.round &&
    dragging.position.column === position.column

  return (
    <div
      id={categoryElementId(position.round, position.column)}
      className={[
        'custom-category',
        isOver ? 'is-drop-target' : '',
        isDragged ? 'is-dragged' : '',
        problems.length > 0 ? 'has-problem' : '',
      ].join(' ')}
      {...handlers}
    >
      <div className="custom-tools">
        <button
          type="button"
          className="custom-icon-button is-grip"
          draggable
          aria-label={`Drag ${name}`}
          title="Drag onto another category to swap them"
          onDragStart={event => startDrag(event, { kind: 'category', position }, onDragStart)}
          onDragEnd={onDragEnd}
        >
          <GripIcon />
        </button>
        <button
          type="button"
          className="custom-tool-button"
          aria-label={`Import a category into ${name}`}
          onClick={() => onImport(position)}
        >
          <ImportIcon />
          Import
        </button>
        <button
          type="button"
          className="custom-icon-button"
          aria-label={`Trash ${name}`}
          title="Trash this category"
          onClick={() => onTrashCategory(position)}
        >
          <TrashIcon />
        </button>
      </div>

      <input
        className="custom-category-name"
        aria-label={`${defaultCategoryName(position)} name`}
        placeholder={defaultCategoryName(position)}
        value={category.name ?? ''}
        onChange={event => onRename(position, event.target.value)}
      />

      {category.source && <p className="custom-source">From {category.source}</p>}
      <ProblemMarker problems={problems} />
    </div>
  )
}

interface ClueCellProps extends CustomBoardProps {
  clue: DraftClue | null
  categoryLabel: string
  position: CluePosition
}

function ClueCell({
  clue,
  categoryLabel,
  position,
  blind,
  dragging,
  dailyDoublesFull,
  problemsAt,
  onEditClue,
  onTrashClue,
  onToggleDailyDouble,
  onDragStart,
  onDragEnd,
  onDrop,
}: ClueCellProps) {
  const value = formatMoney(clueValue(position.round, position.row))
  const problems = problemsAt(position.column, position.row)
  const { isOver, handlers } = useDropTarget(
    { kind: 'clue', position },
    dragging,
    onDrop,
  )
  const isDragged = dragging?.kind === 'clue' &&
    dragging.position.round === position.round &&
    dragging.position.column === position.column &&
    dragging.position.row === position.row

  const className = [
    'custom-cell',
    clue ? '' : 'is-empty',
    clue?.dailyDouble ? 'is-daily-double' : '',
    isOver ? 'is-drop-target' : '',
    isDragged ? 'is-dragged' : '',
    problems.length > 0 ? 'has-problem' : '',
  ].join(' ')

  const id = clueElementId(position.round, position.column, position.row)

  if (!clue) {
    return (
      <div id={id} className={className} {...handlers}>
        <button
          type="button"
          className="custom-clue"
          aria-label={`Write the ${value} clue in ${categoryLabel}`}
          onClick={() => onEditClue(position)}
        >
          <span className="custom-value">{value}</span>
          <span className="custom-write">
            <PlusIcon />
            Write clue
          </span>
        </button>
        <ProblemMarker problems={problems} />
      </div>
    )
  }

  const pinLabel = clue.dailyDouble
    ? `Unpin the ${value} Daily Double`
    : `Pin the ${value} clue as a Daily Double`

  return (
    <div id={id} className={className} {...handlers}>
      <button
        type="button"
        className="custom-clue"
        aria-label={`Edit the ${value} clue in ${categoryLabel}`}
        onClick={() => onEditClue(position)}
      >
        <span className="custom-cell-top">
          <span className="custom-value">{value}</span>
          <ClueBadges clue={clue} />
        </span>

        {blind
          ? (
            <>
              <span className="custom-hidden" aria-label="Clue hidden">
                <span />
                <span />
              </span>
              <span className="custom-answer is-hidden">Response hidden</span>
            </>
          )
          : (
            <>
              <span className="custom-question">
                <ClueQuestion html={clue.question} />
              </span>
              <span className="custom-answer">{clue.answer}</span>
            </>
          )}
      </button>

      <div className="custom-cell-tools">
        <button
          type="button"
          className="custom-icon-button is-grip"
          draggable
          aria-label={`Drag the ${value} clue`}
          title="Drag to another row to change its value"
          onDragStart={event => startDrag(event, { kind: 'clue', position }, onDragStart)}
          onDragEnd={onDragEnd}
        >
          <GripIcon />
        </button>
        <button
          type="button"
          className="custom-icon-button"
          aria-label={pinLabel}
          aria-pressed={clue.dailyDouble}
          title={!clue.dailyDouble && dailyDoublesFull
            ? 'Every Daily Double of this round is pinned: unpin one first'
            : pinLabel}
          disabled={!clue.dailyDouble && dailyDoublesFull}
          onClick={() => onToggleDailyDouble(position)}
        >
          <StarIcon filled={clue.dailyDouble} />
        </button>
        <button
          type="button"
          className="custom-icon-button"
          aria-label={`Trash the ${value} clue`}
          title="Trash this clue"
          onClick={() => onTrashClue(position)}
        >
          <TrashIcon />
        </button>
      </div>

      <ProblemMarker problems={problems} />
    </div>
  )
}

export default CustomBoard
