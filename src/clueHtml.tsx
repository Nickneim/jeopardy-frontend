import { createElement, type ReactNode } from 'react'

// Clue questions are J-Archive's HTML as scraped. They're parsed into an inert
// document (nothing runs or loads) and rebuilt as React elements from a fixed
// list of tags, so a question can't run code or inject styles, and its text is
// escaped by React like any other. Every other string from the backend is
// plain text.

// Formatting tags rendered as themselves, without attributes.
const SAME_TAGS = new Set(['b', 'del', 'i', 'small', 'sub', 'sup', 'u'])

// A `<` that doesn't open or close one of the tags questions use. It's
// escaped before parsing, so anything else that looks like a tag shows as
// text, and the parser never sees a tag that changes how its contents parse
// (<script> or <style> would turn them into raw text).
const OTHER_TAG_START =
  /<(?!\/?(?:a|b|big|br|del|i|small|span|sub|sup|u)[\s/>])/gi

export function clueHtmlToReact(html: string): ReactNode[] {
  const document = new DOMParser().parseFromString(
    html.replace(OTHER_TAG_START, '&lt;'),
    'text/html',
  )
  return convertChildren(document.body)
}

function convertChildren(parent: Node): ReactNode[] {
  return Array.from(parent.childNodes, (node, index) => convert(node, index))
}

function convert(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const element = node as Element
  const tag = element.tagName.toLowerCase()
  const children = convertChildren(element)
  if (tag === 'br') {
    return <br key={key} />
  }
  if (SAME_TAGS.has(tag)) {
    return createElement(tag, { key }, children)
  }
  // <big> is obsolete in HTML5.
  if (tag === 'big') {
    return <span key={key} className="clue-big">{children}</span>
  }
  if (tag === 'span' && element.classList.contains('nobreak')) {
    return <span key={key} className="clue-nobreak">{children}</span>
  }
  if (tag === 'a') {
    const href = linkHref(element.getAttribute('href'))
    if (href) {
      // Media opens in a new tab, never taking a player away from a game.
      return (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    }
  }
  // A span without the nobreak class, or a link without a usable href,
  // keeps only its contents.
  return children
}

// The link's URL, or null if it isn't an absolute http(s) URL (a few stored
// hrefs are relative).
function linkHref(href: string | null): string | null {
  if (href === null) {
    return null
  }
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }
  // J-Archive serves its media over https too.
  if (url.protocol === 'http:' && url.hostname === 'www.j-archive.com') {
    url.protocol = 'https:'
  }
  return url.href
}
