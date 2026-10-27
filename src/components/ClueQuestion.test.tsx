import { render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import ClueQuestion from './ClueQuestion'

// The question's rendered markup.
function renderQuestion(html: string): HTMLElement {
  const { container } = render(<ClueQuestion html={html} />)
  return container
}

describe('ClueQuestion', () => {
  test('renders links, line breaks, entities and formatting', () => {
    const question = renderQuestion(
      'The type of statement seen <a href="http://www.j-archive.com/media/2000-03-27_DJ_18.jpg" target="_blank">here</a>, or the relationship between rich &amp; poor:<br/><br/><i>x</i><sup>3</sup> - 23 &lt; 91',
    )

    expect(question.innerHTML).toBe(
      'The type of statement seen <a href="https://www.j-archive.com/media/2000-03-27_DJ_18.jpg" target="_blank" rel="noopener noreferrer">here</a>, or the relationship between rich &amp; poor:<br><br><i>x</i><sup>3</sup> - 23 &lt; 91',
    )
    expect(question.textContent).toContain('rich & poor')
    expect(question.textContent).toContain('23 < 91')
  })

  test('renders subscripts', () => {
    const question = renderQuestion(
      'Process illustrated by the equation seen <a href="https://www.j-archive.com/media/1995-10-09_DJ_29.jpg" target="_blank">here</a>: 6CO<sub>2</sub> + 6H<sub>2</sub>O light &gt; C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6O<sub>2</sub>',
    )

    expect(question.querySelectorAll('sub')).toHaveLength(6)
    expect(question.textContent).toBe(
      'Process illustrated by the equation seen here: 6CO2 + 6H2O light > C6H12O6 + 6O2',
    )
    expect(question.querySelector('a')).toHaveAttribute(
      'href',
      'https://www.j-archive.com/media/1995-10-09_DJ_29.jpg',
    )
  })

  test('renders <big> inside a link as a larger span', () => {
    const question = renderQuestion(
      '<a href="http://www.j-archive.com/media/2001-09-17_J_07.jpg" target="_blank"><big>&lt;</big></a>',
    )

    expect(question.innerHTML).toBe(
      '<a href="https://www.j-archive.com/media/2001-09-17_J_07.jpg" target="_blank" rel="noopener noreferrer"><span class="clue-big">&lt;</span></a>',
    )
  })

  test('renders a link inside <big>', () => {
    const question = renderQuestion(
      'This musical about Huck &amp; Jim made safe passage to Broadway<br/><br/><big><a href="https://www.j-archive.com/media/2022-02-04_DJ_21.jpg" target="_blank">RIVER</a></big>',
    )

    expect(question.innerHTML).toBe(
      'This musical about Huck &amp; Jim made safe passage to Broadway<br><br><span class="clue-big"><a href="https://www.j-archive.com/media/2022-02-04_DJ_21.jpg" target="_blank" rel="noopener noreferrer">RIVER</a></span>',
    )
  })

  test('keeps nobreak spans from wrapping', () => {
    const question = renderQuestion(
      'Massachusetts elected its first governor in 1780<span class="nobreak">--</span><big>this man</big>',
    )

    expect(question.innerHTML).toBe(
      'Massachusetts elected its first governor in 1780<span class="clue-nobreak">--</span><span class="clue-big">this man</span>',
    )
  })

  test('renders strikethrough', () => {
    const question = renderQuestion(
      '"In Xanadu did <del>Hugh Hefner</del> a stately pleasure-dome decree"',
    )

    expect(question.innerHTML).toBe(
      '"In Xanadu did <del>Hugh Hefner</del> a stately pleasure-dome decree"',
    )
  })

  test('renders only the text of relative links', () => {
    expect(
      renderQuestion('<a href="1999-11-30_J_25.jpg" target="_blank">this</a>')
        .innerHTML,
    ).toBe('this')
  })

  test('runs nothing from hostile input', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})

    const image = renderQuestion('<img src=x onerror=alert(1)>')
    expect(image.querySelector('img')).toBeNull()
    expect(image.textContent).toBe('<img src=x onerror=alert(1)>')
    const script = renderQuestion('<script>alert(1)</script>')
    expect(script.querySelector('script')).toBeNull()
    expect(script.textContent).toBe('<script>alert(1)</script>')
    expect(renderQuestion('<a href="javascript:alert(1)">x</a>').innerHTML)
      .toBe('x')
    expect(
      renderQuestion('<i onclick="alert(1)" style="color:red">x</i>').innerHTML,
    ).toBe('<i>x</i>')

    expect(alert).not.toHaveBeenCalled()
    alert.mockRestore()
  })

  test('shows tags not on the list as text, rendering what they contain', () => {
    const question = renderQuestion('<script>This is <i>italic</i><script>')

    expect(question.innerHTML).toBe(
      '&lt;script&gt;This is <i>italic</i>&lt;script&gt;',
    )
  })

  test('decodes entities once', () => {
    const question = renderQuestion('Tom &amp; Jerry')

    expect(question.textContent).toBe('Tom & Jerry')
    expect(question.innerHTML).toBe('Tom &amp; Jerry')
  })
})
