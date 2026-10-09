// Drives the real UI in headless Chrome over the DevTools protocol, with
// one isolated browser context (own localStorage) per player: hosting, the
// live games list, timers, late joining, spectating, kick, leave, and
// joining mid-game. Screenshots go to OUT_DIR (default: a temp folder).
//
//   node scripts/e2e/ui-flow.mjs     (GAME_ID=735, CHROME=<path>, OUT_DIR=<dir>)
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { APP, check, finish, preflight, sleep } from './lib.mjs'

const CHROME = process.env.CHROME ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(path => existsSync(path))
const OUT = process.env.OUT_DIR ?? join(tmpdir(), 'jeopardy-e2e')
const PORT = 9333

if (!CHROME) {
  console.error('No Chrome or Edge found. Set CHROME to its path.')
  process.exit(2)
}

const GAME_ID = await preflight()
mkdirSync(OUT, { recursive: true })

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(OUT, 'chrome-profile')}`,
  '--no-first-run', '--window-size=1200,1000', 'about:blank',
], { stdio: 'ignore' })

let version
for (let i = 0; i < 50 && !version; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch { await sleep(200) }
}

const ws = new WebSocket(version.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let nextId = 1
const pending = new Map()
const listeners = []
ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
  } else {
    for (const l of listeners) l(msg)
  }
})
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = nextId++
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params, sessionId }))
})

async function newPlayer(name) {
  const { browserContextId } = await send('Target.createBrowserContext')
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const page = { name, sessionId, problems: [] }
  listeners.push(msg => {
    if (msg.sessionId !== sessionId) return
    if (msg.method === 'Runtime.exceptionThrown') {
      page.problems.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      page.problems.push(msg.params.args.map(a => a.value ?? a.description).join(' '))
    }
  })
  await send('Runtime.enable', {}, sessionId)
  await send('Page.enable', {}, sessionId)
  // window.confirm would block a headless page: always answer OK.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm = () => true' }, sessionId)
  page.eval = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description)
    return r.result.value
  }
  page.goto = async url => {
    await send('Page.navigate', { url }, sessionId)
    await sleep(300)
  }
  page.text = () => page.eval('document.body.innerText')
  page.waitText = async (needle, ms = 5000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if ((await page.text()).includes(needle)) return true
      await sleep(100)
    }
    return false
  }
  page.click = label => page.eval(`(() => {
    const el = [...document.querySelectorAll('button, a')].find(e => e.textContent.trim().startsWith(${JSON.stringify(label)}))
    if (!el) throw new Error('No button or link: ' + ${JSON.stringify(label)})
    el.click()
  })()`)
  page.join = async playerName => {
    await page.eval(`document.querySelector('input[name=playerName]').value = ${JSON.stringify(playerName)}`)
    await page.click('Join game')
  }
  page.screenshot = async file => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId)
    writeFileSync(join(OUT, file), Buffer.from(data, 'base64'))
  }
  return page
}

try {
  const alice = await newPlayer('Alice')
  const bob = await newPlayer('Bob')
  const carol = await newPlayer('Carol')

  // Host from the game page, like a user.
  await alice.goto(`${APP}/games/${GAME_ID}`)
  check('game page has Host live game', await alice.waitText('Host live game'))
  await alice.click('Host live game')
  check('hosting lands on the session page', await alice.waitText('Your name'))
  const sessionUrl = await alice.eval('location.href')

  await alice.join('Alice')
  check('host sees "(host)", Start game and timer form',
    await alice.waitText('Playing as Alice (host)') &&
    (await alice.text()).includes('Start game') &&
    (await alice.text()).includes('Save timers') &&
    (await alice.text()).includes('Let players join after the game starts'))

  // The live games list.
  await bob.goto(`${APP}/sessions`)
  check('live games list shows the session hosted by Alice with Join',
    await bob.waitText('hosted by Alice') && (await bob.text()).includes('Join'))
  await bob.eval(`[...document.querySelectorAll('a')].find(a => a.textContent === 'Join' && a.href === ${JSON.stringify(sessionUrl)}).click()`)
  check('Join link opens the session', await bob.waitText('Your name'))
  await bob.join('Bob')
  check('non-host sees waiting message and read-only timers',
    await bob.waitText('Waiting for Alice to start the game') &&
    !(await bob.text()).includes('Save timers') &&
    (await bob.text()).includes('Buzzer'))
  check('host sees Kick on Bob', await alice.waitText('Kick'))

  // Timers.
  await alice.eval(`document.querySelector('input[name=buzzerMs]').value = '8'`)
  await alice.click('Save timers')
  check('timer change reaches the other player', await bob.waitText('8s'))
  check('host form shows the saved value',
    await alice.eval(`document.querySelector('input[name=buzzerMs]').value`) === '8')

  // Late join setting.
  await alice.eval(`document.querySelector('.lobby input[type=checkbox]').click()`)
  check('late-join setting reaches the other player',
    await bob.waitText('Nobody can join after the game starts'))

  await alice.screenshot('host-lobby.png')
  await bob.screenshot('player-lobby.png')

  // Kick.
  // A shared link: choose, watch first, then join.
  await carol.goto(sessionUrl)
  check('shared link offers Join / Watch', await carol.waitText('Watch as spectator') &&
    (await carol.text()).includes('Join this game') &&
    !(await carol.text()).includes('Your name'))
  await carol.click('Watch as spectator')
  check('spectator mode', await carol.waitText("You're watching as a spectator"))
  await carol.click('Join this game')
  check('spectator can open the join form', await carol.waitText('Your name'))
  await carol.click('Just watch')
  check('"Just watch" goes back to spectating', await carol.waitText("You're watching as a spectator"))
  await carol.click('Join this game')
  await carol.waitText('Your name')
  await carol.join('Carol')
  check('Carol joins', await carol.waitText('Playing as Carol'))
  await alice.waitText('Carol')
  await alice.eval(`(() => {
    const li = [...document.querySelectorAll('.scoreboard-player')].find(li => li.textContent.includes('Carol'))
    li.querySelector('.kick-button').click()
  })()`)
  check('kicked player stays on as a spectator and is told why',
    await carol.waitText("You're watching as a spectator", 8000) &&
    (await carol.text()).includes('You were removed from the session by the host'))
  check('kicked player disappears from the host scoreboard',
    await (async () => { await sleep(500); return !(await alice.text()).includes('Carol') })())

  // Start; late joining is off.
  await alice.click('Start game')
  check('game starts for both', await alice.waitText('Your turn: choose a clue') &&
    await bob.waitText('Alice is choosing a clue'))
  check('outsider sees "doesn\'t accept new players"',
    await carol.waitText("doesn't accept new players"))

  // Bob leaves mid-game.
  await bob.click('Leave game')
  check('leaving player sees the notice and no join form',
    await bob.waitText('You left the game.') &&
    await bob.waitText("doesn't accept new players"))
  check('Bob disappears from the host scoreboard',
    await (async () => { await sleep(500); return !(await alice.text()).includes('Bob') })())

  // Alice, the last player, leaves: back to the list, session gone.
  await alice.click('Leave game')
  check('last player leaving goes to the live games list',
    await alice.waitText('Live Games') && (await alice.eval('location.pathname')) === '/sessions')
  check('watcher sees the closed view', await carol.waitText('Everyone left, so this game has ended.'))
  await carol.screenshot('closed.png')

  // Late joining allowed: a spectator from the list joins mid-game.
  const frank = await newPlayer('Frank')
  await alice.goto(`${APP}/games/${GAME_ID}`)
  await alice.waitText('Host live game')
  await alice.click('Host live game')
  await alice.waitText('Your name')
  await alice.join('Alice')
  await alice.waitText('Start game')
  await alice.click('Start game')
  await alice.waitText('Your turn: choose a clue')
  const url2 = await alice.eval('location.href')
  await frank.goto(`${APP}/sessions`)
  await frank.waitText('hosted by Alice')
  await frank.eval(`[...document.querySelectorAll('a')].find(a => a.textContent === 'Watch' && a.href === ${JSON.stringify(url2)}).click()`)
  check('list Watch link opens in spectator mode, game visible',
    await frank.waitText("You're watching as a spectator") &&
    await frank.waitText('Alice is choosing a clue'))
  await frank.click('Join this game')
  await frank.waitText('Your name')
  await frank.join('Frank')
  check('spectator joins mid-game', await frank.waitText('Playing as Frank'))
  check('host sees the new player', await alice.waitText('Frank'))
  await frank.screenshot('joined-mid-game.png')
  await carol.goto(url2)
  await carol.waitText('Watch as spectator')
  await carol.screenshot('choice.png')

  for (const p of [alice, bob, carol, frank]) {
    check(`no console errors for ${p.name}`, p.problems.length === 0, p.problems.join(' | '))
  }
  console.log(`\nScreenshots: ${OUT}`)
} catch (error) {
  check('UI flow ran to the end', false, error.stack)
} finally {
  chrome.kill()
  finish('UI')
}
