import type { ActionFunctionArgs } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SESSION_ID } from '../test/fixtures'
import { randomSessionCode } from '../sessionCode'
import { post, put } from './client'
import {
  customGameRequest,
  customShowAction,
  defaultCategoryName,
  emptyDraft,
  importCategory,
  importedCategoryIds,
  isEmptyDraft,
  loadDraft,
  mediaLink,
  openProblems,
  readShowFile,
  saveDraft,
  setClue,
  showFile,
  swapCategories,
  swapClues,
  toggleDailyDouble,
  updateCategory,
  type CustomGameProblem,
  type DraftClue,
} from './customShows'
import { ApiError } from './errors'
import type { GameCategory } from './games'

vi.mock('./client', () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('../sessionCode', async importOriginal => ({
  ...await importOriginal<typeof import('../sessionCode')>(),
  randomSessionCode: vi.fn(),
}))

function clue(question: string, changes: Partial<DraftClue> = {}): DraftClue {
  return {
    question,
    answer: `${question} answer`,
    clueType: 'TEXT',
    mediaUrl: null,
    dailyDouble: false,
    custom: true,
    ...changes,
  }
}

const J0 = { round: 'JEOPARDY', column: 0 } as const
const DJ2 = { round: 'DOUBLE_JEOPARDY', column: 2 } as const

const islands: GameCategory = {
  id: 77,
  name: 'Islands',
  columnNumber: 10,
  comments: '(Alex: Big ones.)',
  clues: [
    { id: 1, question: 'Its capital is <i>Reykjavik</i>', answer: 'Iceland', rowNumber: 1, clueType: 'TEXT', mediaUrl: null },
    { id: 2, question: 'Off Africa', answer: 'Madagascar', rowNumber: 2, clueType: 'IMAGE', mediaUrl: 'http://j-archive.com/a.jpg' },
    { id: 3, question: 'The largest', answer: 'Greenland', rowNumber: 5, clueType: 'TEXT', mediaUrl: null },
  ],
}

describe('the draft', () => {
  test('a new draft is empty, with default names numbered across both rounds', () => {
    const draft = emptyDraft()

    expect(isEmptyDraft(draft)).toBe(true)
    expect(defaultCategoryName(J0)).toBe('Category #1')
    expect(defaultCategoryName(DJ2)).toBe('Category #9')
  })

  test('importing a category puts each clue on its own row, as imported', () => {
    const draft = importCategory(emptyDraft(), J0, islands, 'Show #8612 · Mar 4, 2022')
    const category = draft.rounds.JEOPARDY[0]

    expect(category).toMatchObject({
      name: 'Islands',
      comments: '(Alex: Big ones.)',
      sourceCategoryId: 77,
      source: 'Show #8612 · Mar 4, 2022',
    })
    expect(category.clues.map(clue => clue?.answer ?? null))
      .toEqual(['Iceland', 'Madagascar', null, null, 'Greenland'])
    // Tags are kept as they are: only the live game renders them.
    expect(category.clues[0]).toMatchObject({ question: 'Its capital is <i>Reykjavik</i>', custom: false })
    expect(category.clues[1]).toMatchObject({ clueType: 'IMAGE', mediaUrl: 'http://j-archive.com/a.jpg' })
    expect(importedCategoryIds(draft)).toEqual(new Set([77]))
  })

  test('clues swap rows within their column', () => {
    let draft = setClue(emptyDraft(), { ...J0, row: 0 }, clue('A'))
    draft = setClue(draft, { ...J0, row: 3 }, clue('B'))

    const swapped = swapClues(draft, J0, 0, 3).rounds.JEOPARDY[0].clues

    expect(swapped[0]?.question).toBe('B')
    expect(swapped[3]?.question).toBe('A')
  })

  test('categories swap places across rounds, with their clues', () => {
    const draft = importCategory(emptyDraft(), J0, islands, 'Show')
    const swapped = swapCategories(draft, J0, DJ2)

    expect(swapped.rounds.JEOPARDY[0].name).toBeNull()
    expect(swapped.rounds.DOUBLE_JEOPARDY[2].name).toBe('Islands')
    expect(swapped.rounds.DOUBLE_JEOPARDY[2].clues[0]?.answer).toBe('Iceland')
  })

  test('pinning a Daily Double toggles it on the clue', () => {
    const position = { ...J0, row: 2 }
    const draft = toggleDailyDouble(setClue(emptyDraft(), position, clue('A')), position)

    expect(draft.rounds.JEOPARDY[0].clues[2]?.dailyDouble).toBe(true)
    expect(toggleDailyDouble(draft, position).rounds.JEOPARDY[0].clues[2]?.dailyDouble).toBe(false)
  })

  test('it survives a reload', () => {
    const draft = { ...setClue(emptyDraft(), { ...J0, row: 1 }, clue('A')), name: 'Family night' }

    saveDraft(draft)

    expect(loadDraft()).toEqual(draft)
  })

  test('a broken stored draft gives an empty one', () => {
    localStorage.setItem('jeopardy.customShow', '{nope')

    expect(loadDraft()).toEqual(emptyDraft())
  })
})

describe('customGameRequest', () => {
  test('sends the board with 1-based columns and rows, leaving out empty places', () => {
    let draft = { ...emptyDraft(), name: 'Family night' }
    draft = setClue(draft, { round: 'JEOPARDY', column: 2, row: 3 }, clue('A', { dailyDouble: true }))
    draft = updateCategory(draft, DJ2, category => ({ ...category, name: 'Named, no clues' }))

    expect(customGameRequest(draft)).toEqual({
      name: 'Family night',
      jeopardyRound: [{
        column: 3,
        // A default name is sent as null.
        name: null,
        comments: null,
        sourceCategoryId: null,
        clues: [{
          row: 4,
          question: 'A',
          answer: 'A answer',
          clueType: 'TEXT',
          mediaUrl: null,
          dailyDouble: true,
        }],
      }],
      doubleJeopardyRound: [{
        column: 3,
        name: 'Named, no clues',
        comments: null,
        sourceCategoryId: null,
        clues: [],
      }],
      finalJeopardy: null,
    })
  })

  test('sends media links encoded, and none for a text clue', () => {
    const draft = setClue(emptyDraft(), { ...J0, row: 0 }, clue('A', {
      clueType: 'VIDEO',
      mediaUrl: ' https://cdn.example.com/my clip.mp4 ',
    }))

    expect(customGameRequest(draft).jeopardyRound[0].clues[0].mediaUrl)
      .toBe('https://cdn.example.com/my%20clip.mp4')
    expect(mediaLink('https://example.com/a%20b.png')).toBe('https://example.com/a%20b.png')
    expect(mediaLink('   ')).toBeNull()
  })

  test('sends Final Jeopardy only when something is written, with blanks as null', () => {
    const draft = emptyDraft()

    expect(customGameRequest(draft).finalJeopardy).toBeNull()

    const named = { ...draft, final: { ...draft.final, name: 'Presidents', question: '  ' } }

    expect(customGameRequest(named).finalJeopardy).toEqual({
      name: 'Presidents',
      comments: null,
      question: null,
      answer: null,
    })
  })
})

describe('openProblems', () => {
  const problem = (changes: Partial<CustomGameProblem>): CustomGameProblem => ({
    code: 'ANSWER_MISSING',
    round: 'JEOPARDY',
    column: 1,
    row: 1,
    message: 'This clue has no correct response',
    ...changes,
  })

  test('keeps a problem until its place is edited', () => {
    const refused = setClue(emptyDraft(), { ...J0, row: 0 }, clue('A', { answer: '' }))
    const problems = [
      problem({}),
      problem({ code: 'CATEGORY_NAME_MISSING', row: null }),
      problem({ code: 'SHOW_NAME_MISSING', round: null, column: null, row: null }),
    ]

    expect(openProblems(problems, refused, refused)).toEqual(problems)

    // Another clue of the same category: the other problems stay.
    const elsewhere = setClue(refused, { ...J0, row: 4 }, clue('B'))
    expect(openProblems(problems, refused, elsewhere)).toEqual(problems)

    const fixed = setClue(refused, { ...J0, row: 0 }, clue('A'))
    expect(openProblems(problems, refused, fixed)).toEqual(problems.slice(1))

    const named = { ...fixed, name: 'Family night' }
    expect(openProblems(problems, refused, named)).toEqual([problems[1]])
  })
})

describe('show files', () => {
  test('an exported file loads back as the same draft', () => {
    const draft = { ...importCategory(emptyDraft(), J0, islands, 'Show'), name: 'Family night' }

    expect(readShowFile(JSON.stringify(showFile(draft)))).toEqual(draft)
  })

  test('anything else is refused', () => {
    expect(readShowFile('not json')).toBeNull()
    expect(readShowFile(JSON.stringify({ name: 'x', rounds: {} }))).toBeNull()
    expect(readShowFile(JSON.stringify({ format: 'jeopardy-custom-show', version: 2, show: {} })))
      .toBeNull()
  })
})

describe('customShowAction', () => {
  function hostArgs(playerName: string): ActionFunctionArgs {
    const request = new Request('http://localhost/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, game: customGameRequest(emptyDraft()) }),
    })

    return { request, params: {} } as unknown as ActionFunctionArgs
  }

  beforeEach(() => {
    vi.mocked(put).mockReset()
    vi.mocked(post).mockReset()
    vi.mocked(randomSessionCode).mockReset().mockReturnValue(SESSION_ID)
  })

  test('creates the session from the board, joins it and goes there', async () => {
    vi.mocked(put).mockResolvedValue({ id: SESSION_ID })
    vi.mocked(post).mockResolvedValue({ playerId: 1, token: 'secret' })

    const response = await customShowAction(hostArgs('Nico')) as Response

    expect(put).toHaveBeenCalledWith(
      `/game-sessions/${SESSION_ID}`,
      { customGame: customGameRequest(emptyDraft()) },
      { session: SESSION_ID },
    )
    expect(response.headers.get('Location')).toBe(`/sessions/${SESSION_ID}`)
  })

  test("returns the backend's problems when it refuses the show", async () => {
    const problems: CustomGameProblem[] = [
      { code: 'NO_CLUES', round: null, column: null, row: null, message: 'This show has no clues' },
    ]
    vi.mocked(put).mockRejectedValue(new ApiError(
      422,
      "This custom show can't be played: 1 problem",
      'INVALID_CUSTOM_GAME',
      problems,
    ))

    expect(await customShowAction(hostArgs('Nico'))).toEqual({
      error: "This custom show can't be played: 1 problem",
      problems,
    })
    expect(post).not.toHaveBeenCalled()
  })

  test('asks for a name before creating anything', async () => {
    expect(await customShowAction(hostArgs('  '))).toEqual({ error: 'Enter your name to host.' })
    expect(put).not.toHaveBeenCalled()
  })
})
