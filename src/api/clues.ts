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
  categoryId: number
  categoryName: string
  categoryComments: string | null
}

export function getClue(id: number): Promise<Clue> {
  return get<Clue>(`/clues/${id}`)
}
