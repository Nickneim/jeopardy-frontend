// Shown when the backend can't be reached: it's switched off between game
// nights.
function ServerOffline() {
  return (
    <main>
      <h1>Game server offline</h1>

      <p>
        The game server is offline right now. Ask whoever runs it to start
        it, then reload.
      </p>

      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </main>
  )
}

export default ServerOffline
