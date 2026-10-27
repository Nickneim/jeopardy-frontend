// Sorting for the games and live games tables: the column and direction are
// in the `sort` and `direction` search params, and sent to the backend, which
// sorts the whole list before paging (api.md §3.1, §3.2).
export type SortDirection = 'asc' | 'desc'

export interface ListSort<K extends string> {
  sort: K
  direction: SortDirection
}

// The list's sort from the URL. An unknown column or direction is a bad
// link, like an invalid page.
export function sortParams<K extends string>(
  url: URL,
  columns: readonly K[],
  fallback: ListSort<K>,
): ListSort<K> {
  const sort = url.searchParams.get('sort') ?? fallback.sort
  const direction = url.searchParams.get('direction') ??
    (sort === fallback.sort ? fallback.direction : 'asc')

  if (!columns.includes(sort as K)) {
    throw new Response('Invalid sort parameter', { status: 400 })
  }

  if (direction !== 'asc' && direction !== 'desc') {
    throw new Response('Invalid direction parameter', { status: 400 })
  }

  return { sort: sort as K, direction }
}
