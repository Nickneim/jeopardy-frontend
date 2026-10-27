import { createBrowserRouter } from 'react-router'
import App from './App'
import HomePage from './pages/HomePage'
import GamesPage from './pages/GamesPage'
import GamePage from './pages/GamePage'
import CluePage from './pages/CluePage'
import CustomShowPage from './pages/CustomShowPage'
import ErrorPage from './pages/ErrorPage'
import LoadingPage from './pages/LoadingPage'
import SessionPage from './pages/SessionPage'
import SessionsPage from './pages/SessionsPage'
import {
  gamesLoader,
  gameLoader,
} from './api/games'
import { clueLoader } from './api/clues'
import { customShowAction } from './api/customShows'
import {
  homeLoader,
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
    // Until the first page's loader is done.
    HydrateFallback: LoadingPage,
    children: [
      {
        index: true,
        element: <HomePage />,
        loader: homeLoader,
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
        // The draft is in localStorage: no loader.
        path: 'custom',
        element: <CustomShowPage />,
        action: customShowAction,
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
