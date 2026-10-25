import DOMPurify from 'dompurify'

// Clue questions are J-Archive's HTML as scraped, so they're cleaned before
// being rendered: only formatting tags and links survive, the text of
// anything else is kept, and scripts, event handlers and styles are dropped.
const ALLOWED_TAGS = ['a', 'b', 'br', 'em', 'i', 'strong', 'sub', 'sup', 'u']
const ALLOWED_ATTR = ['href']

// Its own instance, so the link hook doesn't apply to other DOMPurify users.
const purify = DOMPurify(window)

// Links (usually to the clue's media on J-Archive) open in a new tab, so they
// never take a player away from a live game.
purify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeClueHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Only absolute http(s) links: no javascript:, data: or relative URLs.
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  })
}
