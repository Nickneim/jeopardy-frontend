import { NavLink, Outlet, useMatch } from 'react-router'

function App() {
  // A live game uses the whole page; its status bar links home instead.
  const inSession = useMatch('/sessions/:id')

  return (
    <>
      {!inSession && (
        <nav className="site-nav">
          <NavLink to="/games">Games</NavLink>
          <NavLink to="/sessions" end>Live games</NavLink>
        </nav>
      )}

      <Outlet />
    </>
  )
}

export default App
