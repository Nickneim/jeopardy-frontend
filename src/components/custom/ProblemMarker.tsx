import type { CustomGameProblem } from '../../api/customShows'
import { CrossIcon } from '../session/icons'
import { problemLabel } from './board'

interface ProblemMarkerProps {
  problems: CustomGameProblem[]
}

// Marks a place on the board the backend refused, until it's edited.
function ProblemMarker({ problems }: ProblemMarkerProps) {
  if (problems.length === 0) {
    return null
  }

  const messages = problems.map(problem => problem.message).join(' · ')

  return (
    <span className="custom-problem" title={messages}>
      <CrossIcon size={12} />
      {problemLabel(problems[0].code)}
      <span className="visually-hidden">: {messages}</span>
    </span>
  )
}

export default ProblemMarker
