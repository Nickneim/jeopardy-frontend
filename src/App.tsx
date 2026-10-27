import { Link, NavLink, Outlet, useMatch } from 'react-router'

function App() {
  // A live game uses the whole page; its status bar links home instead. The
  // home page is the menu itself.
  const inSession = useMatch('/sessions/:id')
  const atHome = useMatch('/')

  return (
    <>
      {!inSession && !atHome && (
        <nav className="site-nav">
          <Link to="/" className="site-logo" aria-label="Home">J!</Link>
          <NavLink to="/games">Catalog</NavLink>
          <NavLink to="/custom">Custom show</NavLink>
          <NavLink to="/sessions" end>Live games</NavLink>
        </nav>
      )}

      <Outlet />
    </>
  )
}

export default App
