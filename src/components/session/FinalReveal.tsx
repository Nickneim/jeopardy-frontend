import type { FinalJeopardy, Player } from '../../api/sessions'
import { formatMoney } from '../../format'
import type { FinalRevealProgress, FinalRevealStep } from './revealProgress'
import { CheckIcon, CrossIcon } from './icons'

const STEPS: FinalRevealStep[] = ['wager', 'response', 'result']

interface FinalRevealProps {
  players: Player[]
  final: FinalJeopardy
  // Null shows the last player with everything revealed.
  reveal: FinalRevealProgress | null
}

// One player at a time: their wager, then their response, then the result.
function FinalReveal({
  players,
  final,
  reveal,
}: FinalRevealProps) {
  const order = reveal?.order ?? final.players
  const index = reveal?.index ?? order.length - 1
  const shown = STEPS.indexOf(reveal?.step ?? 'result')
  const result = order[index]

  if (!result) {
    return null
  }

  const name = players.find(p => p.id === result.playerId)?.name ?? 'Someone'
  const wager = result.wager ?? 0
  const pending = <span className="final-reveal-pending">—</span>

  return (
    <div className="final-reveal">
      <section
        className="final-reveal-panel"
        aria-label={`${name}, player ${index + 1} of ${order.length}`}
        aria-live="polite"
      >
        <div className="final-reveal-dots" aria-hidden="true">
          {order.map((r, k) => (
            <span
              key={r.playerId}
              className={k === index ? 'is-current' : k < index ? 'is-done' : ''}
            />
          ))}
        </div>

        <p className="final-reveal-name tv-hand">{name}</p>

        <dl className="final-reveal-rows">
          <dt>Wager</dt>
          <dd>
            {shown >= 0
              ? <span className="tv-hand tv-gold">{formatMoney(wager)}</span>
              : pending}
          </dd>

          <dt>Response</dt>
          <dd>
            {shown < 1
              ? pending
              : <span className="tv-hand">{result.answer ?? 'No answer'}</span>}
          </dd>

          <dt>Result</dt>
          <dd>
            {shown < 2
              ? pending
              : (
                <>
                  <span
                    className={result.correct
                      ? 'tv-result is-correct'
                      : 'tv-result is-wrong'}
                  >
                    {result.correct ? <CheckIcon /> : <CrossIcon />}
                    {result.correct ? 'Correct' : 'Incorrect'}
                  </span>

                  {!result.correct && result.phrasedAsQuestion === false && (
                    <span className="final-reveal-note">
                      Not phrased as a question
                    </span>
                  )}

                  {wager > 0 && (
                    <span
                      className={result.correct
                        ? 'final-reveal-delta'
                        : 'final-reveal-delta is-wrong'}
                    >
                      {result.correct ? '+' : '−'}{formatMoney(wager)}
                    </span>
                  )}
                </>
              )}
          </dd>
        </dl>
      </section>
    </div>
  )
}

export default FinalReveal
