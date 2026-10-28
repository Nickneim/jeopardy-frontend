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
  // Some browsers answer window.confirm with false without showing it, so the
  // app asks on the page instead. Using it again fails the console check.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: "window.confirm = () => { throw new Error('window.confirm used: ask on the page instead') }",
  }, sessionId)
  page.eval = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description)
    return r.result.value
  }
  page.goto = async url => {
    await send('Page.navigate', { url }, sessionId)
    await sleep(300)
  }
  // textContent, not innerText: the live game shows a lot in capitals.
  page.text = () => page.eval('document.body.textContent')
  page.waitText = async (needle, ms = 5000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if ((await page.text()).includes(needle)) return true
      await sleep(100)
    }
    return false
  }
  // The player's own podium is the one with the buzzer.
  page.waitPlayingAs = async (playerName, ms = 5000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await page.eval(`document.querySelector('.podium.is-me .podium-name')?.textContent === ${JSON.stringify(playerName)}`)) return true
      await sleep(100)
    }
    return false
  }
  // Actions sent before the live connection is up are lost (the page shows
  // "Connecting…" until then), so wait for it before starting a game.
  page.waitConnected = async (ms = 5000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await page.eval(`!!document.querySelector('.tv-status') && !document.querySelector('.connection-status')`)) return true
      await sleep(100)
    }
    return false
  }
  // The "Join with a code" form, once its button is ready again.
  page.submitCode = async (code, ms = 5000) => {
    const ready = `document.querySelector('.code-form button[type=submit]')?.textContent === 'Join'`
    const end = Date.now() + ms
    while (Date.now() < end && !(await page.eval(ready))) await sleep(100)
    await page.eval(`(() => {
      document.querySelector('.code-form input[name=code]').value = ${JSON.stringify(code)}
      document.querySelector('.code-form button[type=submit]').click()
    })()`)
  }
  page.click = label => page.eval(`(() => {
    const el = [...document.querySelectorAll('button, a')].find(e => e.textContent.trim().startsWith(${JSON.stringify(label)}))
    if (!el) throw new Error('No button or link: ' + ${JSON.stringify(label)})
    el.click()
  })()`)
  // A link by its exact text and target, such as a session's Join or Watch on
  // the live games list.
  page.clickLink = async (label, href, ms = 5000) => {
    const find = `[...document.querySelectorAll('a')].find(a => a.textContent === ${JSON.stringify(label)} && a.href === ${JSON.stringify(href)})`
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await page.eval(`(() => { const a = ${find}; a?.click(); return !!a })()`)) return
      await sleep(100)
    }
    throw new Error(`No ${label} link to ${href}`)
  }
  page.join = async playerName => {
    await page.eval(`document.querySelector('input[name=playerName]').value = ${JSON.stringify(playerName)}`)
    await page.click('Join game')
  }
  // Hosting from a game page also joins as the host.
  page.host = async playerName => {
    await page.eval(`document.querySelector('.host-form input[name=playerName]').value = ${JSON.stringify(playerName)}`)
    await page.click('Host live game')
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
  await alice.host('Alice')
  check('hosting joins as the host in one step, with editable timers',
    await alice.waitPlayingAs('Alice') &&
    (await alice.text()).includes('Start the game when everyone is here') &&
    (await alice.text()).includes('Start game') &&
    (await alice.text()).includes('Changes are saved as soon as you leave a field') &&
    !(await alice.text()).includes('Save timers') &&
    (await alice.text()).includes('Let players join after the game starts'))

  const sessionUrl = await alice.eval('location.href')

  // The live games list.
  await bob.goto(`${APP}/sessions`)
  check('live games list shows the session hosted by Alice with Join',
    await bob.waitText(sessionUrl.split('/').pop()) && (await bob.text()).includes('Alice') &&
    (await bob.text()).includes('Join'))
  await bob.clickLink('Join', sessionUrl)
  check('Join link opens the session', await bob.waitText('Your name'))
  await bob.join('Bob')
  check('non-host sees waiting message and read-only timers',
    await bob.waitText('Waiting for Alice to start the game') &&
    !(await bob.text()).includes('Changes are saved') &&
    (await bob.text()).includes('Buzzer'))
  check('host sees Kick on Bob', await alice.waitText('Bob') &&
    await alice.eval(`document.querySelector('.kick-button')?.getAttribute('aria-label') === 'Kick Bob'`))

  // Timers.
  // Leaving the field saves it (React's onBlur listens to focusout).
  await alice.eval(`(() => {
    const input = document.querySelector('input[name=buzzerMs]')
    input.value = '8'
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })()`)
  check('timer change saves on leaving the field and reaches the other player',
    await bob.waitText('8s'))
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
  // The code shown in the lobby, typed on the live games page.
  const code = sessionUrl.split('/').pop()
  check('lobby shows the game code', (await alice.text()).includes(code))
  await carol.goto(`${APP}/sessions`)
  await carol.waitText('Game code')
  await carol.submitCode('ZZZZZ')
  check('an unknown code is explained on the form',
    await carol.waitText('no live game with the code ZZZZZ'))
  // The error shows while the page still revalidates after the action, with
  // the button reading "Opening…": submitCode waits for it to be back.
  await carol.submitCode(code.toLowerCase())
  check('a code typed in lowercase opens the session',
    await carol.waitText('Join this game') &&
    (await carol.eval('location.href')) === sessionUrl)
  await carol.goto(sessionUrl.replace(code, code.toLowerCase()))
  check('a lowercase session URL redirects to the uppercase code',
    await carol.waitText('Join this game') &&
    (await carol.eval('location.href')) === sessionUrl)

  await carol.goto(sessionUrl)
  check('shared link offers Join / Watch', await carol.waitText('Watch as spectator') &&
    (await carol.text()).includes('Join this game') &&
    !(await carol.text()).includes('Your name'))
  await carol.click('Watch as spectator')
  check('spectator mode', await carol.waitText("You're watching as a spectator"))
  await carol.click('Join as player')
  check('spectator can open the join form', await carol.waitText('Your name'))
  await carol.click('Just watch')
  check('"Just watch" goes back to spectating', await carol.waitText("You're watching as a spectator"))
  await carol.click('Join as player')
  await carol.waitText('Your name')
  await carol.join('Carol')
  check('Carol joins', await carol.waitPlayingAs('Carol'))
  await alice.waitText('Carol')
  await alice.eval(`(() => {
    const podium = [...document.querySelectorAll('.podium')].find(p => p.textContent.includes('Carol'))
    podium.querySelector('.kick-button').click()
  })()`)
  check('kicking asks on the page first', await alice.waitText('Remove Carol from the game?'))
  await alice.click('Yes, kick')
  check('kicked player stays on as a spectator and is told why',
    await carol.waitText("You're watching as a spectator", 8000) &&
    (await carol.text()).includes('You were removed from the session by the host'))
  check('kicked player disappears from the host scoreboard',
    await (async () => { await sleep(500); return !(await alice.text()).includes('Carol') })())

  // Start; late joining is off.
  await alice.waitConnected()
  await alice.click('Start game')
  check("game starts on Jeopardy's title card, without the board",
    await alice.waitText('Get ready · you pick first') &&
    await bob.waitText('Alice picks first') &&
    await bob.eval(`document.querySelector('.tv-title.is-card')?.textContent === 'Jeopardy!' &&
      !document.querySelector('.tv-board-cell')`))
  await bob.screenshot('round-intro.png')
  // The title card lasts roundIntroMs (6 s by default).
  check('then the round begins for both', await alice.waitText('Your pick · choose a clue', 10000) &&
    await bob.waitText('Alice is choosing a clue'))
  check('outsider sees "doesn\'t accept new players"',
    await carol.waitText("doesn't accept new players"))

  // Bob leaves mid-game.
  await bob.click('Leave')
  check('leaving mid-game asks on the page first',
    await bob.waitText('Your score will be lost'))
  await bob.click('Yes, leave')
  check('leaving player sees the notice and no join form',
    await bob.waitText('You left the game.') &&
    await bob.waitText("doesn't accept new players"))
  check('Bob disappears from the host scoreboard',
    await (async () => { await sleep(500); return !(await alice.text()).includes('Bob') })())

  // Alice, the last player, leaves: back to the list, session gone.
  await alice.click('Leave')
  check('the last player is told leaving closes the game',
    await alice.waitText('leaving closes this game'))
  await alice.click('Yes, leave')
  check('last player leaving goes to the live games list',
    await alice.waitText('Live games') && (await alice.eval('location.pathname')) === '/sessions')
  check('watcher sees the closed view', await carol.waitText('Everyone left, so this game has ended.'))
  await carol.screenshot('closed.png')

  // Late joining allowed: a spectator from the list joins mid-game.
  const frank = await newPlayer('Frank')
  await alice.goto(`${APP}/games/${GAME_ID}`)
  await alice.waitText('Host live game')
  await alice.host('Alice')
  await alice.waitText('Start game')
  await alice.waitConnected()
  await alice.click('Start game')
  await alice.waitText('Your pick · choose a clue', 10000)
  const url2 = await alice.eval('location.href')
  await frank.goto(`${APP}/sessions`)
  await frank.waitText('Alice')
  await frank.clickLink('Watch', url2)
  check('list Watch link opens in spectator mode, game visible',
    await frank.waitText("You're watching as a spectator") &&
    await frank.waitText('Alice is choosing a clue'),
    (await frank.text()).slice(0, 300))
  await frank.click('Join as player')
  await frank.waitText('Your name')
  await frank.join('Frank')
  check('spectator joins mid-game', await frank.waitPlayingAs('Frank'))
  check('host sees the new player', await alice.waitText('Frank'))
  await frank.screenshot('joined-mid-game.png')
  await carol.goto(url2)
  await carol.waitText('Watch as spectator')
  await carol.screenshot('choice.png')

  // Hosting as Trebek: the desk, the hidden clue, a ruling, and leaving.
  const grace = await newPlayer('Grace')
  const henry = await newPlayer('Henry')
  await grace.goto(`${APP}/games/${GAME_ID}`)
  await grace.waitText('Host live game')
  await grace.host('Grace')
  await grace.waitText('Be Trebek')
  await grace.waitConnected()
  await grace.eval(`document.querySelector('input[name=hostMode][value=TREBEK]').click()`)
  check('the host can switch to Trebek, which waits for a player',
    await grace.waitText('wait for at least one player'))
  const url3 = await grace.eval('location.href')
  await henry.goto(url3)
  await henry.waitText('Your name')
  await henry.join('Henry')
  check('a player sees the host is Trebek', await henry.waitText('is hosting as Trebek'))
  await grace.eval(`(() => {
    const start = [...document.querySelectorAll('button')].find(b => b.textContent === 'Start game')
    return new Promise(resolve => {
      const tick = () => start.disabled ? setTimeout(tick, 100) : resolve(start.click())
      tick()
    })
  })()`)
  check('Trebek has no podium, but a lectern and a desk',
    await grace.waitText('Host desk') && await grace.waitText('Your host') &&
    !(await grace.eval(`!!document.querySelector('.podium.is-me')`)))

  await grace.waitText('Begin the round')
  await grace.click('Begin the round')
  check("Trebek ends the title card early",
    await henry.waitText('Your pick · choose a clue', 3000))
  await henry.eval(`document.querySelector('button.tv-board-cell:not(:disabled)').click()`)
  check('Trebek gets the picked clue first',
    await grace.waitText('Show the clue to everyone'))
  const question = await grace.eval(`document.querySelector('.trebek-clue-question')?.textContent ?? ''`)
  check("the players don't see it yet",
    question.length > 0 && await henry.waitText('is about to show the clue') &&
    !(await henry.text()).includes(question), question)
  await grace.screenshot('trebek-desk.png')

  await grace.click('Show the clue to everyone')
  check('showing the clue shows it to the players', await henry.waitText(question))
  await grace.click('Open the buzzers')
  await henry.waitText('Buzzers open')
  await henry.eval(`document.querySelector('.buzz-button').click()`)
  await henry.waitText('Your response')
  // A controlled input: set it the way typing would.
  await henry.eval(`(() => {
    const input = document.querySelector('.tv-form input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'What is a guess?')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    setTimeout(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Answer').click(), 100)
  })()`)
  check("Trebek sees the submitted answer, the player waits for the ruling",
    await grace.waitText('What is a guess?') && await henry.waitText('is ruling on your answer'))
  await grace.click('Correct +')
  check('the ruling scores on the podium', await henry.waitText('$', 5000) &&
    await henry.eval(`(async () => {
      for (let k = 0; k < 50; k++) {
        if (!document.querySelector('.podium.is-me .podium-score')?.textContent.startsWith('$0')) return true
        await new Promise(r => setTimeout(r, 100))
      }
      return false
    })()`))

  await grace.click('Leave')
  await grace.click('Yes, leave')
  check('Trebek leaving mid-game ends it for the players',
    await henry.waitText('Trebek left, so the game is over.'))

  for (const p of [alice, bob, carol, frank, grace, henry]) {
    check(`no console errors for ${p.name}`, p.problems.length === 0, p.problems.join(' | '))
  }
  console.log(`\nScreenshots: ${OUT}`)
} catch (error) {
  check('UI flow ran to the end', false, error.stack)
} finally {
  chrome.kill()
  finish('UI')
}
