import { NavLink, Outlet } from 'react-router'

function App() {
  return (
    <>
      <nav className="site-nav">
        <NavLink to="/games">Games</NavLink>
        <NavLink to="/sessions" end>Live games</NavLink>
      </nav>

      <Outlet />
    </>
  )
}

export default App
