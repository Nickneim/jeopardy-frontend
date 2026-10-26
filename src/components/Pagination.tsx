import { useSearchParams } from 'react-router'

interface PaginationProps {
  // Zero-based, as the backend counts pages.
  page: number
  totalPages: number
  disabled: boolean
  label: string
}

// Previous and next buttons for a list whose page is in the `page` search
// param, keeping the other params (filters).
function Pagination({
  page,
  totalPages,
  disabled,
  label,
}: PaginationProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  if (totalPages <= 1) {
    return null
  }

  function goToPage(newPage: number) {
    const newParams = new URLSearchParams(searchParams)

    if (newPage === 0) {
      newParams.delete('page')
    } else {
      newParams.set('page', String(newPage))
    }

    setSearchParams(newParams)
  }

  return (
    <nav aria-label={label}>
      <button
        type="button"
        disabled={disabled || page === 0}
        onClick={() => goToPage(page - 1)}
      >
        Previous
      </button>

      <span>
        {' '}
        Page {page + 1} of {totalPages}{' '}
      </span>

      <button
        type="button"
        disabled={disabled || page >= totalPages - 1}
        onClick={() => goToPage(page + 1)}
      >
        Next
      </button>
    </nav>
  )
}

export default Pagination
