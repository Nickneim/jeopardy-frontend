import { Link, useLoaderData } from 'react-router'
import type { HomeLoaderData } from '../api/sessions'
import HostGameForm from '../components/HostGameForm'
import JoinByCode from '../components/session/JoinByCode'

function liveLabel(liveCount: number | null): string {
  if (liveCount === null) {
    return 'Play or watch'
  }

  return liveCount === 1 ? '1 game on air' : `${liveCount} games on air`
}

function HomePage() {
  const { liveCount } = useLoaderData() as HomeLoaderData

  return (
    <main className="home">
      <header className="home-header">
        <h1 className="home-title">Jeopardy!</h1>
        <p className="home-tagline">Pick a category. Any category.</p>
      </header>

      <div className="home-tiles">
        <section className="home-tile" aria-labelledby="home-random">
          <span className="home-kicker">Feeling lucky</span>
          <h2 id="home-random" className="home-tile-title is-gold">
            Host a random game
          </h2>
          <HostGameForm submitLabel="Host" />
        </section>

        <Link to="/games" className="home-tile">
          <span className="home-kicker">Choose an episode</span>
          <span className="home-tile-title is-gold">Host a show</span>
        </Link>

        <Link to="/custom" className="home-tile">
          <span className="home-kicker">Build your own</span>
          <span className="home-tile-title is-gold">Host a custom show</span>
        </Link>

        <section className="home-tile" aria-labelledby="home-join">
          <span className="home-kicker">Got a code?</span>
          <h2 id="home-join" className="home-tile-title is-gold">
            Join a game
          </h2>
          <JoinByCode />
        </section>

        <Link to="/games" className="home-tile">
          <span className="home-kicker">Every season, every clue</span>
          <span className="home-tile-title">Browse catalog</span>
        </Link>

        <Link to="/sessions" className="home-tile">
          <span className="home-kicker">
            {liveCount !== null && liveCount > 0 && (
              <span className="live-dot" aria-hidden="true" />
            )}
            {liveLabel(liveCount)}
          </span>
          <span className="home-tile-title">Browse live games</span>
        </Link>
      </div>
    </main>
  )
}

export default HomePage
