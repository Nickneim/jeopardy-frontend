import { Navigate, Route, Routes } from 'react-router'
import GamesPage from './pages/GamesPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/games" replace />} />
      <Route path="/games" element={<GamesPage />} />
    </Routes>
  )
}

export default App
