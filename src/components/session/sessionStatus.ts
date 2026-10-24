import type { GameSession, Player } from '../../api/sessions'

// What the status bar says: who it's about (shown in handwriting, like the
// podium names) and what's happening.
export interface SessionStatus {
  who: string | null
  message: string
}

export function sessionStatus(
  session: GameSession,
  me: Player | null,
): SessionStatus {
  function name(id: number | null): string {
    return session.players.find(player => player.id === id)?.name ?? 'Someone'
  }

  function isMe(id: number | null): boolean {
    return me !== null && id === me.id
  }

  const chooser = session.playerChoosingClue

  switch (session.state) {
    case 'WAITING_FOR_START':
      if (session.hostPlayerId === null) {
        return { who: null, message: 'Waiting for players to join' }
      }
      return isMe(session.hostPlayerId)
        ? { who: null, message: 'Start the game when everyone is here' }
        : { who: name(session.hostPlayerId), message: 'will start the game' }

    case 'CHOOSING_CLUE':
      return isMe(chooser)
        ? { who: null, message: 'Your pick · choose a clue' }
        : { who: name(chooser), message: 'is choosing a clue' }

    case 'WAITING_FOR_DAILY_DOUBLE_WAGER':
      return isMe(chooser)
        ? { who: null, message: 'Daily Double · place your wager' }
        : { who: name(chooser), message: 'is making a Daily Double wager' }

    case 'REVEALING_CLUE':
      return {
        who: null,
        message: session.currentClue?.dailyDouble
          ? 'Daily Double'
          : 'Get ready to buzz',
      }

    case 'WAITING_FOR_BUZZER':
      if (me === null) {
        return { who: null, message: 'Buzzers open' }
      }
      if (session.playersLockedOut.includes(me.id)) {
        return { who: null, message: 'You already buzzed on this clue' }
      }
      return {
        who: null,
        message: session.clueAnswers.length > 0
          ? 'Still open · buzz in now'
          : 'Buzzers open · buzz in now',
      }

    case 'WAITING_FOR_ANSWER':
      return isMe(session.playerAnswering)
        ? { who: null, message: 'Your answer' }
        : { who: name(session.playerAnswering), message: 'is answering' }

    case 'REVEALING_ANSWER':
      if (chooser === null) {
        return { who: null, message: 'The correct response' }
      }
      return isMe(chooser)
        ? { who: null, message: 'You pick next' }
        : { who: name(chooser), message: 'picks next' }

    case 'FINAL_JEOPARDY_WAGERING':
      return { who: null, message: me ? 'Place your wager' : 'The players are wagering' }

    case 'FINAL_JEOPARDY_ANSWERING':
      return { who: null, message: me ? 'Write your response' : 'The players are answering' }

    case 'FINAL_JEOPARDY_REVEALING':
      return { who: null, message: 'The reveal' }

    case 'FINISHED_GAME':
    case 'CLOSED':
      return { who: null, message: 'Game over' }
  }
}
