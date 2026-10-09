// Shared helpers for the end-to-end scripts. They run against the real
// backend through the Vite dev server, the same way the app does.

export const APP = process.env.APP_URL ?? 'http://localhost:5173'

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let failures = 0
let warnings = 0

export function check(name, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// For behavior the backend doesn't deliver reliably yet: reported, but
// doesn't fail the run.
export function expectBestEffort(name, ok, detail = '') {
  if (!ok) warnings++
  console.log(`${ok ? 'PASS' : 'WARN'} ${name}${detail ? ` — ${detail}` : ''}`)
}

export function finish(label) {
  const warned = warnings ? `, ${warnings} warning(s)` : ''
  console.log(failures === 0
    ? `\nAll ${label} checks passed${warned}`
    : `\n${failures} ${label} check(s) failed${warned}`)
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
