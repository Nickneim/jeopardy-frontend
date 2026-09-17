import {
  createBrowserRouter,
  Navigate,
} from 'react-router'
import App from './App'
import GamesPage from './pages/GamesPage'
import GamePage from './pages/GamePage'
import CluePage from './pages/CluePage'
import ErrorPage from './pages/ErrorPage'
import {
  gamesLoader,
  gameLoader,
} from './api/games'
import { clueLoader } from './api/clues'

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
    ],
  },
])

export default router
