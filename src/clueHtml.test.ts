import { describe, expect, test } from 'vitest'
import { sanitizeClueHtml } from './clueHtml'

describe('sanitizeClueHtml', () => {
  test('keeps plain text and formatting tags', () => {
    expect(sanitizeClueHtml('A <i>big</i> &amp; <b>bold</b><br>clue')).toBe(
      'A <i>big</i> &amp; <b>bold</b><br>clue',
    )
    expect(sanitizeClueHtml('H<sub>2</sub>O, E = mc<sup>2</sup>')).toBe(
      'H<sub>2</sub>O, E = mc<sup>2</sup>',
    )
  })

  test('opens media links in a new tab', () => {
    expect(
      sanitizeClueHtml(
        'Seen <a href="http://www.j-archive.com/media/x.jpg">here</a>',
      ),
    ).toBe(
      'Seen <a href="http://www.j-archive.com/media/x.jpg" target="_blank" rel="noopener noreferrer">here</a>',
    )
  })

  test('drops event handlers, scripts and styles', () => {
    expect(sanitizeClueHtml('<img src=x onerror="alert(1)">Hi')).toBe('Hi')
    expect(sanitizeClueHtml('Hi<script>alert(1)</script>')).toBe('Hi')
    expect(sanitizeClueHtml('<b onclick="alert(1)" style="color:red">Hi</b>'))
      .toBe('<b>Hi</b>')
  })

  test('keeps the text of tags it removes', () => {
    expect(sanitizeClueHtml('<span class="x">Hi</span> <iframe></iframe>'))
      .toBe('Hi ')
  })

  test('removes the href of links that are not http(s)', () => {
    expect(sanitizeClueHtml('<a href="javascript:alert(1)">here</a>'))
      .toBe('<a>here</a>')
    expect(sanitizeClueHtml('<a href="data:text/html,<script>">here</a>'))
      .toBe('<a>here</a>')
    expect(sanitizeClueHtml('<a href="/elsewhere">here</a>'))
      .toBe('<a>here</a>')
  })

  test('does not open links without an href in a new tab', () => {
    expect(sanitizeClueHtml('<a name="x">here</a>')).toBe('<a>here</a>')
  })
})
