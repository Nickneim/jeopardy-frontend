import { useState } from 'react'
import { LinkIcon } from './icons'

// Copies the page's link, for inviting players or spectators.
function ShareLinkButton() {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className="tv-action" onClick={copyLink}>
      <LinkIcon />
      {copied ? 'Link copied' : 'Share link'}
    </button>
  )
}

export default ShareLinkButton
