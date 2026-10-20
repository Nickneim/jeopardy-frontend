// Shared helpers for the end-to-end scripts. They run against the real
// backend through the Vite dev server, the same way the app does.
import { randomInt } from 'node:crypto'

export const APP = process.env.APP_URL ?? 'http://localhost:5173'

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let failures = 0

export function check(name, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

export function finish(label) {
  console.log(failures === 0
    ? `\nAll ${label} checks passed`
    : `\n${failures} ${label} check(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}

export async function api(method, path, body) {
  const res = await fetch(`${APP}/api${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

// A path about one session, with the ?session=<its id> that a load balancer
// in front of several backend instances routes by (a single one ignores it).
export function sessionPath(id, rest = '') {
  return `/game-sessions/${id}${rest}?session=${encodeURIComponent(id)}`
}

// A random session code, like src/sessionCode.ts makes.
export function randomSessionCode() {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  return Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('')
}

// Creates a session the way the "Host live game" action does: under a code
// the client picks, with only { gameId }.
export function createSession(gameId, id = randomSessionCode()) {
  return api('PUT', sessionPath(id), { gameId })
}

// Fails fast, with a hint, when the dev server or the backend is down.
export async function preflight() {
  try {
    await fetch(APP)
  } catch {
    console.error(`No dev server at ${APP}. Start it with: npm run dev`)
    process.exit(2)
  }

  const games = await api('GET', '/games?playable=true&size=1')
    .catch(() => ({ status: 0 }))

  if (games.status !== 200) {
    console.error(`The backend isn't answering through ${APP}/api (status ${games.status}). Start it from ../backend.`)
    process.exit(2)
  }

  const gameId = Number(process.env.GAME_ID) || games.body.content[0]?.id

  if (!gameId) {
    console.error('No playable game in the database. Set GAME_ID.')
    process.exit(2)
  }

  return gameId
}
