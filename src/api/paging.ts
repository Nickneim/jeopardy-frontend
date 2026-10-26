import { redirect } from 'react-router'

// The zero-based `page` search param of a list route, 0 without one.
export function pageParam(url: URL): number {
  const param = url.searchParams.get('page')
  const page = param === null ? 0 : Number(param)

  if (!Number.isInteger(page) || page < 0) {
    throw new Response('Invalid page parameter', {
      status: 400,
    })
  }

  return page
}

// Past the last page (a stale link, or items gone since): go to the last
// page instead.
export function redirectPastLastPage(
  url: URL,
  page: number,
  totalPages: number,
) {
  if (totalPages > 0 && page >= totalPages) {
    url.searchParams.set('page', String(totalPages - 1))
    throw redirect(`${url.pathname}?${url.searchParams}`)
  }
}
