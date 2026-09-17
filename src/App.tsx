import { Navigate, Route, Routes } from 'react-router'
import GamesPage from './pages/GamesPage'
import GamePage from './pages/GamePage'
import CluePage from './pages/CluePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/games" replace />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/games/:id" element={<GamePage />} />
      <Route path="/clues/:id" element={<CluePage />} />
    </Routes>
  )
}

export default App
