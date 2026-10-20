import {
  createBrowserRouter,
  Navigate,
} from 'react-router'
import App from './App'
import GamesPage from './pages/GamesPage'
import GamePage from './pages/GamePage'
import CluePage from './pages/CluePage'
import ErrorPage from './pages/ErrorPage'
import SessionPage from './pages/SessionPage'
import SessionsPage from './pages/SessionsPage'
import {
  gamesLoader,
  gameLoader,
} from './api/games'
import { clueLoader } from './api/clues'
import {
  joinSessionAction,
  sessionLoader,
  sessionsAction,
  sessionsLoader,
} from './api/sessions'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/games" replace />,
      },
      {
        path: 'games',
        element: <GamesPage />,
        loader: gamesLoader,
      },
      {
        path: 'games/:id',
        element: <GamePage />,
        loader: gameLoader,
      },
      {
        path: 'clues/:id',
        element: <CluePage />,
        loader: clueLoader,
      },
      {
        path: 'sessions',
        element: <SessionsPage />,
        loader: sessionsLoader,
        action: sessionsAction,
      },
      {
        path: 'sessions/:id',
        element: <SessionPage />,
        loader: sessionLoader,
        action: joinSessionAction,
      },
    ],
  },
])

export default router
