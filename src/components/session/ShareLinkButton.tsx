import { useState } from 'react'
import { CheckIcon, LinkIcon } from './icons'

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
      {copied ? <CheckIcon size={20} /> : <LinkIcon />}
      {/* Only the icon on a phone. */}
      <span className="tv-action-label">{copied ? 'Link copied' : 'Share link'}</span>
    </button>
  )
}

export default ShareLinkButton
