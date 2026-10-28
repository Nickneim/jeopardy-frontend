import type { ClueAnswer, GameRound, Player } from '../../api/sessions'
import { formatMoney } from '../../format'
import { CheckIcon, CrossIcon } from './icons'

interface ClueAnswersProps {
  answers: ClueAnswer[]
  players: Player[]
  // The round the answers were given in (clueAnswersRound).
  round: GameRound
  me: Player | null
  // What each answer won or lost: the clue's value or Daily Double wager.
  amount?: number
}

function ClueAnswers({
  answers,
  players,
  round,
  me,
  amount,
}: ClueAnswersProps) {
  if (answers.length === 0) {
    return null
  }

  function playerName(id: number): string {
    return players.find(player => player.id === id)?.name ?? `Player ${id}`
  }

  // The question form is optional in the Jeopardy round, so a player who left
  // it out is only warned. From Double Jeopardy on it explains a wrong answer.
  // Trebek rules on the question form too, so nothing is said about it.
  const questionRequired = round !== 'JEOPARDY'
  const warnMe = !questionRequired && me !== null && answers.some(answer =>
    answer.playerId === me.id && !answer.ruledByTrebek &&
    answer.phrasedAsQuestion === false)

  return (
    <>
      <ol className="clue-answers" aria-label="Answers">
        {answers.map((answer, index) => (
          <li
            key={index}
            className={answer.correct
              ? 'clue-answer-row correct'
              : 'clue-answer-row wrong'}
          >
            <span className="clue-answer-name tv-hand">
              {playerName(answer.playerId)}
            </span>

            <span className="clue-answer-text">
              {answer.answer === null
                ? <em>{answer.ruledByTrebek ? 'nothing typed' : 'ran out of time'}</em>
                : answer.answer}
              {questionRequired && !answer.correct && !answer.ruledByTrebek &&
                answer.phrasedAsQuestion === false && (
                <em> (not phrased as a question)</em>
              )}
            </span>

            <span
              className={answer.correct
                ? 'tv-result is-correct'
                : 'tv-result is-wrong'}
            >
              {answer.correct ? <CheckIcon /> : <CrossIcon />}
              {amount === undefined
                ? (answer.correct ? 'Correct' : 'Wrong')
                : `${answer.correct ? '+' : '−'}${formatMoney(amount)}`}
            </span>
          </li>
        ))}
      </ol>

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
