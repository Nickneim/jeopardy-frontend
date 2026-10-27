import { memo, useMemo } from 'react'
import { clueHtmlToReact } from '../clueHtml'

interface ClueQuestionProps {
  // The clue's question, HTML from the backend.
  html: string
}

// A clue's question, safely rendered from its HTML. Memoized, since the live
// game re-renders with every countdown tick.
function ClueQuestion({ html }: ClueQuestionProps) {
  const nodes = useMemo(() => clueHtmlToReact(html), [html])
  return <>{nodes}</>
}

export default memo(ClueQuestion)
