// Plays the multiplayer rules through the Vite proxy with real STOMP
// clients, the way useGameSession does: host, timers, settings, kick, late
// joining, leave, host handover and cleanup.
//
//   node scripts/e2e/session-flow.mjs     (GAME_ID=735 to pick the game)
import {
  api,
  check,
  connect,
  createSession,
  finish,
  preflight,
  randomSessionCode,
  sessionPath,
  sleep,
  waitFor,
} from './lib.mjs'

const GAME_ID = await preflight()

async function main() {
  const id = randomSessionCode()
  const created = await createSession(GAME_ID, id)
  check('create session under the code the client picked',
    created.status === 201 && created.body.id === id, `status ${created.status}`)
  const again = await createSession(GAME_ID, id)
  check('a taken code → 409 SESSION_ALREADY_EXISTS',
    again.status === 409 && again.body?.code === 'SESSION_ALREADY_EXISTS',
    JSON.stringify(again.body))

  // The backend reads a code in the path leniently: any case, O as 0, I and
  // L as 1. The session parameter is the normalized code, as the app sends
  // it, since load balancers route by its exact value.
  const typed = id.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l')
  const lenient = await api('GET', `/game-sessions/${typed}?session=${id}`)
  check('a code typed in lowercase (O for 0, L for 1) finds the session',
    lenient.status === 200 && lenient.body.id === id, `${typed} → ${lenient.status}`)
  const invalid = await api('GET', sessionPath('7KQ2U'))
  check('an invalid code → 400 INVALID_REQUEST with a message',
    invalid.status === 400 && invalid.body?.code === 'INVALID_REQUEST' &&
    /Invalid session code/.test(invalid.body?.message),
    JSON.stringify(invalid.body))

  let list = await api('GET', '/game-sessions')
  let entry = list.body.content.find(s => s.id === id)
  check('new session in list, joinable, no host',
    entry && entry.joinable === true && entry.hostName === null &&
    entry.playerCount === 0 && entry.allowLateJoin === true && entry.joinScore === 0,
    JSON.stringify(entry))

  const alice = (await api('POST', sessionPath(id, '/players'), { playerName: 'Alice' })).body
  const bob = (await api('POST', sessionPath(id, '/players'), { playerName: 'Bob' })).body

  let state = (await api('GET', sessionPath(id))).body
  check('first joiner is host', state.hostPlayerId === alice.playerId)
  check('snapshot has timers, allowLateJoin, joinScore, leaving, away',
    typeof state.timers?.buzzerMs === 'number' && state.allowLateJoin === true &&
    state.joinScore === 0 && state.players.every(p => p.leaving === false) &&
    state.players.every(p => p.away === true),
    JSON.stringify({ timers: state.timers, allowLateJoin: state.allowLateJoin }))
  check('timers start at their defaults, title card and Daily Double announcement included',
    state.timers.roundIntroMs === 6000 && state.timers.dailyDoubleRevealMs === 6000 &&
    state.timers.clueRevealMs === 8000 && state.timers.answerRevealMs === 8000 &&
    state.timerModes?.roundIntroMs === 'AUTOMATIC' &&
    state.timerModes?.dailyDoubleRevealMs === 'AUTOMATIC',
    JSON.stringify({ timers: state.timers, timerModes: state.timerModes }))

  const watcher = connect(id, null)
  const a = connect(id, alice.token)
  const b = connect(id, bob.token)
  await waitFor(() => watcher.connected && a.connected && b.connected)
  check('all three connected', watcher.connected && a.connected && b.connected)
  // Their broadcasts may go out before the watcher subscribes: ask over REST.
  let players = []
  const end = Date.now() + 3000
  while (Date.now() < end) {
    players = (await api('GET', sessionPath(id))).body.players
    if (players.every(p => p.away === false)) break
    await sleep(100)
  }
  check('connected players are no longer away',
    players.every(p => p.away === false), JSON.stringify(players))

  const longName = await api('POST', sessionPath(id, '/players'), { playerName: 'x'.repeat(31) })
  check('a name over 30 characters → 400 INVALID_REQUEST',
    longName.status === 400 && longName.body?.code === 'INVALID_REQUEST',
    JSON.stringify(longName.body))

  // Non-host actions.
  b.send('start')
  b.send('update-timers', { buzzerMs: 8000 })
  b.send('update-settings', { allowLateJoin: false })
  await waitFor(() => b.errors.length >= 3)
  check('non-host start/update-timers/update-settings → NOT_HOST',
    b.errors.length === 3 && b.errors.every(e => e.code === 'NOT_HOST'),
    JSON.stringify(b.errors.map(e => e.code)))

  // Host timers, as TimerSettings sends them (the full object).
  a.send('update-timers', { ...state.timers, buzzerMs: 8000 })
  await waitFor(() => watcher.latest()?.timers.buzzerMs === 8000)
  check('host update-timers broadcasts', watcher.latest()?.timers.buzzerMs === 8000)

  a.send('update-timers', { buzzerMs: 500 })
  await waitFor(() => a.errors.length > 0)
  check('out-of-range timer → INVALID_REQUEST', a.errors[0]?.code === 'INVALID_REQUEST',
    a.errors[0]?.message)

  // Kick, in the lobby.
  const carol = (await api('POST', sessionPath(id, '/players'), { playerName: 'Carol' })).body
  const c = connect(id, carol.token)
  await waitFor(() => c.connected)
  a.send('kick', { playerId: carol.playerId })
  await waitFor(() => c.stompErrors.length > 0)
  check('kicked player gets ERROR after connect with a reason',
    c.stompErrors[0]?.afterConnect === true && !!c.stompErrors[0]?.message,
    JSON.stringify(c.stompErrors[0]))
  await waitFor(() => !watcher.latest()?.players.some(p => p.id === carol.playerId))
  check('kicked player removed from snapshot',
    !watcher.latest()?.players.some(p => p.id === carol.playerId))

  const c2 = connect(id, carol.token)
  await waitFor(() => c2.stompErrors.length > 0)
  check('kicked token rejected on reconnect (before CONNECT)',
    c2.stompErrors[0]?.afterConnect === false, JSON.stringify(c2.stompErrors[0]))

  // Block late joining, then start.
  a.send('update-settings', { allowLateJoin: false })
  await waitFor(() => watcher.latest()?.allowLateJoin === false)
  check('host update-settings broadcasts', watcher.latest()?.allowLateJoin === false)

  a.send('start')
  await waitFor(() => watcher.latest()?.state === 'ROUND_INTRO')
  state = watcher.latest()
  check("host starts game on Jeopardy's title card",
    state?.state === 'ROUND_INTRO' && state.round === 'JEOPARDY' &&
    state.playerChoosingClue === alice.playerId && state.phaseDurationMs === 6000,
    JSON.stringify({ state: state?.state, round: state?.round, phaseDurationMs: state?.phaseDurationMs }))
  await waitFor(() => watcher.latest()?.state === 'CHOOSING_CLUE', 8000)
  check('the title card ends on its own', watcher.latest()?.state === 'CHOOSING_CLUE')

  const late = await api('POST', sessionPath(id, '/players'), { playerName: 'Dave' })
  check('late join refused with 409 SESSION_NOT_JOINABLE + message',
    late.status === 409 && late.body?.code === 'SESSION_NOT_JOINABLE' &&
    !!late.body?.message, JSON.stringify(late.body))

  list = await api('GET', '/game-sessions')
  entry = list.body.content.find(s => s.id === id)
  check('list shows not joinable after start', entry?.joinable === false,
    JSON.stringify(entry))

  a.send('update-settings', { allowLateJoin: true })
  await waitFor(() => a.errors.length > 1)
  check('update-settings after start → INVALID_STATE',
    a.errors[1]?.code === 'INVALID_STATE', JSON.stringify(a.errors[1]))

  // Bob leaves without a role (Alice is choosing).
  b.send('leave')
  await waitFor(() => b.stompErrors.length > 0)
  check('leaving player gets ERROR after connect with a reason',
    b.stompErrors[0]?.afterConnect === true && !!b.stompErrors[0]?.message,
    JSON.stringify(b.stompErrors[0]))
  await waitFor(() => !watcher.latest()?.players.some(p => p.id === bob.playerId))
  check('player without a role removed at once',
    !watcher.latest()?.players.some(p => p.id === bob.playerId))

  // Alice, the last player, leaves: the session closes.
  a.send('leave')
  await waitFor(() => watcher.latest()?.state === 'CLOSED')
  const last = watcher.latest()
  check('last player leaving → CLOSED, ABANDONED',
    last?.state === 'CLOSED' && last?.closeReason === 'ABANDONED',
    JSON.stringify({ state: last?.state, closeReason: last?.closeReason }))

  const gone = await api('GET', sessionPath(id))
  check('closed session GET → 404', gone.status === 404)

  for (const conn of [watcher, a, b, c, c2]) void conn.client.deactivate()

  // Second session: the leaving chooser, and the host handover. P2 never
  // connects, so they're away, but they're the only one left.
  const s2 = (await createSession(GAME_ID)).body.id
  const p1 = (await api('POST', sessionPath(s2, '/players'), { playerName: 'P1' })).body
  const p2 = (await api('POST', sessionPath(s2, '/players'), { playerName: 'P2' })).body
  const w2 = connect(s2, null)
  const c1 = connect(s2, p1.token)
  await waitFor(() => w2.connected && c1.connected)
  c1.send('start')
  await waitFor(() => w2.latest()?.state === 'CHOOSING_CLUE', 8000)
  c1.send('leave')
  await waitFor(() => w2.latest()?.hostPlayerId === p2.playerId)
  const snap = w2.latest()
  check('host leaves → next player becomes host', snap?.hostPlayerId === p2.playerId)
  check('chooser leaving while choosing passes control at once and is removed',
    !snap?.players.some(p => p.id === p1.playerId) &&
    snap?.playerChoosingClue === p2.playerId,
    JSON.stringify({ players: snap?.players, chooser: snap?.playerChoosingClue }))

  for (const conn of [w2, c1]) void conn.client.deactivate()

  finish('protocol')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
