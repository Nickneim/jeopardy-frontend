import { useSearchParams } from 'react-router'
import type { ListSort, SortDirection } from '../api/listSort'

interface SortHeaderProps<K extends string> {
  column: K
  label: string
  sort: ListSort<K>
  defaultSort: ListSort<K>
  // The direction of a first click: newest or most first for dates and counts.
  firstDirection?: SortDirection
  disabled: boolean
}

const ARIA_SORT = {
  asc: 'ascending',
  desc: 'descending',
} as const

// A table column header that sorts the list by its column, through the
// `sort` and `direction` search params. Clicking the sorted column again
// reverses it.
function SortHeader<K extends string>({
  column,
  label,
  sort,
  defaultSort,
  firstDirection = 'asc',
  disabled,
}: SortHeaderProps<K>) {
  const [searchParams, setSearchParams] = useSearchParams()
  const isSorted = sort.sort === column

  function sortByColumn() {
    const direction: SortDirection = isSorted
      ? (sort.direction === 'asc' ? 'desc' : 'asc')
      : firstDirection
    const newParams = new URLSearchParams(searchParams)

    // A new order starts again from the first page.
    newParams.delete('page')

    if (column === defaultSort.sort && direction === defaultSort.direction) {
      newParams.delete('sort')
      newParams.delete('direction')
    } else {
      newParams.set('sort', column)
      newParams.set('direction', direction)
    }

    setSearchParams(newParams)
  }

  return (
    <th scope="col" aria-sort={isSorted ? ARIA_SORT[sort.direction] : 'none'}>
      <button
        type="button"
        className="sort-button"
        disabled={disabled}
        onClick={sortByColumn}
      >
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {isSorted ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}

export default SortHeader
