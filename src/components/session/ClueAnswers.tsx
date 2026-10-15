import type { ClueAnswer, GameRound, Player } from '../../api/sessions'

interface ClueAnswersProps {
  answers: ClueAnswer[]
  players: Player[]
  // The round the answers were given in (clueAnswersRound).
  round: GameRound
  me: Player | null
}

function ClueAnswers({
  answers,
  players,
  round,
  me,
}: ClueAnswersProps) {
  if (answers.length === 0) {
    return null
  }

  function playerName(id: number): string {
    return players.find(player => player.id === id)?.name ?? `Player ${id}`
  }

  // The question form is optional in the Jeopardy round, so a player who left
  // it out is only warned. From Double Jeopardy on it explains a wrong answer.
  const questionRequired = round !== 'JEOPARDY'
  const warnMe = !questionRequired && me !== null && answers.some(answer =>
    answer.playerId === me.id && answer.phrasedAsQuestion === false)

  return (
    <>
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
            {questionRequired && !answer.correct &&
              answer.phrasedAsQuestion === false && (
              <em> (not phrased as a question)</em>
            )}
          </li>
        ))}
      </ul>

      {warnMe && (
        <p className="answer-hint">
          Remember to phrase it as a question (“What is …?”): from Double
          Jeopardy on, answers without it are wrong.
        </p>
      )}
    </>
  )
}

export default ClueAnswers
