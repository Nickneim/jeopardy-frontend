import type { ClueAnswer, Player } from '../../api/sessions'

interface ClueAnswersProps {
  answers: ClueAnswer[]
  players: Player[]
}

function ClueAnswers({
  answers,
  players,
}: ClueAnswersProps) {
  if (answers.length === 0) {
    return null
  }

  function playerName(id: number): string {
    return players.find(player => player.id === id)?.name ?? `Player ${id}`
  }

  return (
    <ul className="clue-answers">
      {answers.map((answer, index) => (
        <li
          key={index}
          className={answer.correct ? 'correct' : 'wrong'}
        >
          {answer.correct ? '✓' : '✗'} {playerName(answer.playerId)}:{' '}
          {answer.answer === null
            ? <em>ran out of time</em>
            : `“${answer.answer}”`}
        </li>
      ))}
    </ul>
  )
}

export default ClueAnswers
