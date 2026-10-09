import { useLoaderData } from 'react-router'
import type { SessionLoaderData } from '../api/sessions'
import JoinForm from '../components/session/JoinForm'

function SessionPage() {
  const { session, player } = useLoaderData() as SessionLoaderData

  const me = session.players.find(p => p.id === player?.playerId)

  return (
    <main>
      <h1>Live game</h1>

      <p>
        Share this page's link to invite players:{' '}
        <code>{window.location.href}</code>
      </p>

      {me
        ? <p>You joined as <strong>{me.name}</strong>.</p>
        : <JoinForm />}

      <h2>Players</h2>

      <ul>
        {session.players.map(p => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </main>
  )
}

export default SessionPage
