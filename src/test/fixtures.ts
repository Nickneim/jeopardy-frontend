import { DEFAULT_TIMER_MODES, type GameSession, type Player } from '../api/sessions'

export const SESSION_ID = '7KQ2M'

export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'Alice',
    score: 0,
    leaving: false,
    away: false,
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
      clueRevealMs: 8000,
      dailyDoubleWagerMs: 30000,
      buzzerMs: 10000,
      answerMs: 15000,
      answerRevealMs: 8000,
      finalJeopardyWagerMs: 30000,
      finalJeopardyAnswerMs: 30000,
      finalJeopardyRevealMs: 10000,
      roundIntroMs: 6000,
      dailyDoubleRevealMs: 6000,
    },
    paused: false,
    timerModes: DEFAULT_TIMER_MODES,
    hostMode: 'CONTESTANT',
    trebek: null,
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
