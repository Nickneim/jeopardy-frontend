import { Navigate, Route, Routes } from 'react-router'
import GamesPage from './pages/GamesPage'
import GamePage from './pages/GamePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/games" replace />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/games/:id" element={<GamePage />} />
    </Routes>
  )
}

export default App
