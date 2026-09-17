import { useEffect, useState } from 'react'

function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('/api/games?page=0&size=5')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        return response.json()
      })
      .then(data => {
        setMessage(`Found ${data.totalElements} games`)
      })
      .catch(error => {
        setMessage(`Error: ${error.message}`)
      })
  }, [])

  return (
    <main>
      <h1>Jeopardy</h1>
      <p>{message}</p>
    </main>
  )
}

export default App