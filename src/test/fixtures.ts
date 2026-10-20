import type { GameSession, Player } from '../api/sessions'

export const SESSION_ID = '7KQ2M'

export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'Alice',
    score: 0,
    leaving: false,
    ...overrides,
  }
}

// A lobby with no players, with the backend's default timers.
export function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: SESSION_ID,
    version: 0,
    round: 'JEOPARDY',
    state: 'WAITING_FOR_START',
    closeReason: null,
    phaseDurationMs: null,
    phaseRemainingMs: null,
    timers: {
      clueChoiceMs: 30000,
      clueRevealMs: 3000,
      dailyDoubleWagerMs: 30000,
      buzzerMs: 10000,
      answerMs: 5000,
      answerRevealMs: 3000,
      finalJeopardyWagerMs: 30000,
      finalJeopardyAnswerMs: 30000,
      finalJeopardyRevealMs: 10000,
    },
    allowLateJoin: true,
    joinScore: 0,
    players: [],
    hostPlayerId: null,
    playerChoosingClue: null,
    playerAnswering: null,
    playersLockedOut: [],
    board: [],
    currentClue: null,
    clueAnswers: [],
    finalJeopardy: null,
    ...overrides,
  }
}
