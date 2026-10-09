import type { LoaderFunctionArgs } from 'react-router'
import { get } from './client'

export type ClueType = 'TEXT' | 'IMAGE' | 'SOUND' | 'VIDEO'

export interface Clue {
  id: number
  question: string
  answer: string
  clueType: ClueType
  mediaUrl: string | null
  value: number
  isFinalClue: boolean
  gameId: number
  categoryId: number
  categoryName: string
  categoryComments: string | null
}

export function getClue(id: number): Promise<Clue> {
  return get<Clue>(`/clues/${id}`)
}

export function clueLoader({ params }: LoaderFunctionArgs) {
  const id = Number(params.id)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Response('Invalid clue ID', {
      status: 400,
    })
  }

  return getClue(id)
}
