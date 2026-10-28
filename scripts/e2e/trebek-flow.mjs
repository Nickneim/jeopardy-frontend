// Plays a whole Trebek game (api.md §6.8) with real STOMP clients, on a tiny
// custom show: one clue, one Daily Double and Final Jeopardy. Checks the
// lobby switch, every Trebek action (ending title cards and Daily Double
// announcements early too), rulings, pausing, the step-by-step
// Final Jeopardy reveal, that no secret reaches the public snapshot or
// anyone but Trebek, and that Trebek leaving mid-game ends it.
//
//   node scripts/e2e/trebek-flow.mjs
import {
  api,
  check,
  connect,
  finish,
  preflight,
  randomSessionCode,
  sessionPath,
  sleep,
  waitFor,
} from './lib.mjs'

await preflight()

const QUESTION = 'This capital sits on the Danube between Vienna and Budapest'
const DD_QUESTION = 'Its Chain Bridge opened in 1849'
const FINAL_QUESTION = 'It flows through Vienna, Bratislava, Budapest and Belgrade'

const SHOW = {
  name: 'Trebek e2e show',
  jeopardyRound: [{
    column: 1,
    name: 'World capitals',
    comments: null,
    sourceCategoryId: null,
    clues: [
      { row: 1, question: QUESTION, answer: '[Bratislava | Pressburg]', clueType: 'TEXT', mediaUrl: null, dailyDouble: false },
      { row: 2, question: DD_QUESTION, answer: 'Budapest', clueType: 'TEXT', mediaUrl: null, dailyDouble: true },
    ],
  }],
  doubleJeopardyRound: [],
  finalJeopardy: { name: 'Rivers', comments: null, question: FINAL_QUESTION, answer: 'the Danube' },
}

async function hostShow(names) {
  const id = randomSessionCode()
  const created = await api('PUT', sessionPath(id), { customGame: SHOW })
  if (created.status !== 201) {
    throw new Error(`Couldn't host the custom show: ${JSON.stringify(created.body)}`)
  }
  const players = []
  for (const playerName of names) {
    players.push((await api('POST', sessionPath(id, '/players'), { playerName })).body)
  }
  return { id, players }
}

// Sends an action and waits for the error it gets back.
async function expectError(conn, action, body) {
  const before = conn.errors.length
  conn.send(action, body)
  await waitFor(() => conn.errors.length > before)
  return conn.errors[before] ?? null
}

// The newest view Trebek has for the newest snapshot.
function viewOf(trebek, snapshot) {
  return trebek.trebekViews.findLast(v => v.version === snapshot?.version) ?? null
}

async function main() {
  const { id, players: [alex, bob, carol] } = await hostShow(['Alex', 'Bob', 'Carol'])
  const watcher = connect(id, null)
  const t = connect(id, alex.token)
  const b = connect(id, bob.token)
  const c = connect(id, carol.token)
  await waitFor(() => [watcher, t, b, c].every(conn => conn.connected))

  const now = () => watcher.latest()
  const until = (fn, ms) => waitFor(() => Boolean(now() && fn(now())), ms)
  const inState = (state, ms) => until(s => s.state === state, ms)
  const score = id => now()?.players.find(p => p.id === id)?.score
  // Nothing secret may ever reach the public topic.
  const leaked = text => watcher.snapshots.some(s =>
    JSON.stringify(s).includes(text) &&
    !['REVEALING_CLUE', 'WAITING_FOR_BUZZER', 'WAITING_FOR_ANSWER',
      'WAITING_FOR_RULING', 'REVEALING_ANSWER'].includes(s.state))

  // ---------- Lobby ----------
  const empty = await expectError(t, 'update-settings', {})
  check('update-settings without a setting → INVALID_REQUEST',
    empty?.code === 'INVALID_REQUEST', JSON.stringify(empty))

  t.send('update-settings', { hostMode: 'TREBEK' })
  await until(s => s.hostMode === 'TREBEK')
  let s = now()
  check('the host becomes Trebek, out of players, and stays host',
    s.trebek?.id === alex.playerId && s.trebek?.name === 'Alex' &&
    s.hostPlayerId === alex.playerId &&
    !s.players.some(p => p.id === alex.playerId), JSON.stringify(s.trebek))
  check('timer modes start at their defaults',
    s.timerModes?.clueRevealMs === 'TREBEK' && s.timerModes?.buzzerMs === 'AUTOMATIC' &&
    s.timerModes?.finalJeopardyRevealMs === 'TREBEK', JSON.stringify(s.timerModes))

  const listed = (await api('GET', '/game-sessions')).body.content.find(x => x.id === id)
  check('the live games list marks it TREBEK, without Trebek in playerCount',
    listed?.hostMode === 'TREBEK' && listed?.hostName === 'Alex' && listed?.playerCount === 2,
    JSON.stringify(listed))

  const early = await expectError(t, 'adjust-score', { playerId: bob.playerId, amount: 100 })
  check('adjust-score in the lobby → INVALID_STATE', early?.code === 'INVALID_STATE')
  const notHost = await expectError(b, 'advance')
  check("a player sending Trebek's advance → NOT_HOST", notHost?.code === 'NOT_HOST')

  t.send('start')
  await inState('ROUND_INTRO')
  s = now()
  check("the game opens on Jeopardy's title card, chooser already set",
    s.round === 'JEOPARDY' && s.playerChoosingClue === bob.playerId &&
    s.phaseDurationMs === s.timers.roundIntroMs, JSON.stringify({ round: s.round, phaseDurationMs: s.phaseDurationMs }))
  const choosingTooSoon = await expectError(b, 'choose-clue', { clueId: 1 })
  check('choosing during the title card → INVALID_STATE', choosingTooSoon?.code === 'INVALID_STATE',
    JSON.stringify(choosingTooSoon))
  t.send('advance')
  await inState('CHOOSING_CLUE')
  check("Trebek's advance ends the title card; the lowest player id chooses first",
    now().playerChoosingClue === bob.playerId)

  // ---------- A picked clue ----------
  b.send('choose-clue', { clueId: 1 })
  await inState('CLUE_PICKED')
  s = now()
  check('CLUE_PICKED hides the clue and whether it is a Daily Double',
    s.currentClue?.clueId === 1 && s.currentClue.question === null &&
    s.currentClue.dailyDouble === null && s.phaseDurationMs === null,
    JSON.stringify(s.currentClue))
  await waitFor(() => viewOf(t, now())?.clue)
  check("Trebek's view has the whole clue and its accepted answers",
    viewOf(t, now())?.clue?.question === QUESTION &&
    viewOf(t, now())?.clue?.acceptedAnswers?.options?.[0] === 'Bratislava',
    JSON.stringify(viewOf(t, now())?.clue))

  t.send('return-clue')
  await inState('CHOOSING_CLUE')
  check('return-clue puts it back with the same chooser',
    now().board[0].slots[0].status === 'AVAILABLE' && now().playerChoosingClue === bob.playerId)

  t.send('choose-clue', { clueId: 1 })
  await inState('CLUE_PICKED')
  const lateChoice = await expectError(b, 'choose-clue', { clueId: 1 })
  check("Trebek chooses for the chooser; the chooser's own choice → TOO_LATE",
    lateChoice?.code === 'TOO_LATE', JSON.stringify(lateChoice))

  t.send('advance')
  await inState('REVEALING_CLUE')
  check('advance shows the clue; a TREBEK-mode reveal has no timer',
    now().currentClue.question === QUESTION && now().phaseDurationMs === null)
  t.send('advance')
  await inState('WAITING_FOR_BUZZER')

  // ---------- Answers and rulings ----------
  const trebekBuzz = await expectError(t, 'buzz')
  check("Trebek buzzing → NOT_YOUR_TURN, \"Trebek doesn't play!\"",
    trebekBuzz?.code === 'NOT_YOUR_TURN', JSON.stringify(trebekBuzz))

  c.send('buzz')
  await inState('WAITING_FOR_ANSWER')
  c.send('answer', { answer: 'Vienna' })
  await inState('WAITING_FOR_RULING')
  s = now()
  check('an answer waits for the ruling, unscored, with the answerer still shown',
    s.playerAnswering === carol.playerId && s.playersLockedOut.includes(carol.playerId) &&
    s.clueAnswers.length === 0 && score(carol.playerId) === 0)
  check("the submitted answer isn't in the public snapshot",
    !watcher.snapshots.some(x => JSON.stringify(x).includes('Vienna"')))
  await waitFor(() => viewOf(t, now())?.pendingAnswer)
  const pending = viewOf(t, now())?.pendingAnswer
  check("Trebek sees it with the check's suggestion",
    pending?.playerId === carol.playerId && pending?.answer === 'Vienna' &&
    pending?.suggestedCorrect === false, JSON.stringify(pending))
  const noRuling = await expectError(t, 'advance')
  check('advance before a ruling → INVALID_STATE', noRuling?.code === 'INVALID_STATE')

  t.send('rule', { correct: false })
  await inState('WAITING_FOR_BUZZER')
  check('a wrong ruling scores and reopens the buzzers',
    score(carol.playerId) === -200 && now().clueAnswers[0]?.ruledByTrebek === true &&
    now().clueAnswers[0]?.correct === false, JSON.stringify(now().clueAnswers))

  b.send('buzz')
  await inState('WAITING_FOR_ANSWER')
  t.send('rule', { correct: true })
  await inState('REVEALING_ANSWER')
  s = now()
  check('Trebek rules early, before an answer: correct, with no answer text',
    score(bob.playerId) === 200 && s.clueAnswers[1]?.answer === null &&
    s.clueAnswers[1]?.correct === true && s.clueAnswers[1]?.matchedAnswers === null,
    JSON.stringify(s.clueAnswers))
  const lateAnswer = await expectError(b, 'answer', { answer: 'Bratislava' })
  check('an answer after the early ruling → TOO_LATE', lateAnswer?.code === 'TOO_LATE')

  // ---------- Pausing and scores ----------
  t.send('pause')
  await until(x => x.paused === true)
  check('pause stops the clock', now().paused === true)
  t.send('resume')
  await until(x => x.paused === false)
  check('resume restarts it', now().paused === false)

  const zero = await expectError(t, 'adjust-score', { playerId: carol.playerId, amount: 0 })
  const huge = await expectError(t, 'adjust-score', { playerId: carol.playerId, amount: 100001 })
  const self = await expectError(t, 'adjust-score', { playerId: alex.playerId, amount: 100 })
  check('adjust-score: 0 or over 100000 → INVALID_REQUEST, Trebek → PLAYER_NOT_FOUND',
    zero?.code === 'INVALID_REQUEST' && huge?.code === 'INVALID_REQUEST' &&
    self?.code === 'PLAYER_NOT_FOUND',
    JSON.stringify([zero?.code, huge?.code, self?.code]))
  t.send('adjust-score', { playerId: carol.playerId, amount: 500 })
  await until(() => score(carol.playerId) === 300)
  check('adjust-score changes a score at any time', score(carol.playerId) === 300)

  // ---------- A Daily Double ----------
  t.send('advance')
  await inState('CHOOSING_CLUE')
  b.send('choose-clue', { clueId: 2 })
  await inState('CLUE_PICKED')
  check("the board doesn't give a picked Daily Double away",
    now().currentClue.dailyDouble === null && !leaked(DD_QUESTION))
  await waitFor(() => viewOf(t, now())?.clue?.dailyDouble === true)
  check('Trebek knows it is a Daily Double', viewOf(t, now())?.clue?.dailyDouble === true)
  t.send('advance')
  await inState('REVEALING_DAILY_DOUBLE')
  s = now()
  check('advance announces the Daily Double, its question and wager range still hidden',
    s.currentClue.dailyDouble === true && s.currentClue.question === null &&
    s.currentClue.minWager === null && s.currentClue.maxWager === null &&
    s.phaseDurationMs === s.timers.dailyDoubleRevealMs, JSON.stringify(s.currentClue))
  const wagerTooSoon = await expectError(b, 'place-daily-double-wager', { wager: 5 })
  check('wagering during the announcement → INVALID_STATE', wagerTooSoon?.code === 'INVALID_STATE',
    JSON.stringify(wagerTooSoon))
  t.send('advance')
  await inState('WAITING_FOR_DAILY_DOUBLE_WAGER')
  check('advance starts the wager, with its range',
    now().currentClue.minWager === 5 && now().currentClue.maxWager !== null)
  t.send('place-daily-double-wager', { wager: 5 })
  await inState('REVEALING_CLUE')
  check('Trebek places the wager for the chooser', now().currentClue.wager === 5)
  t.send('advance')
  await inState('WAITING_FOR_ANSWER')
  t.send('advance')
  await inState('WAITING_FOR_RULING')
  await waitFor(() => viewOf(t, now())?.pendingAnswer)
  check('closing typing waits for a ruling with no answer',
    viewOf(t, now())?.pendingAnswer?.answer === null &&
    viewOf(t, now())?.pendingAnswer?.suggestedCorrect === false)
  t.send('rule', { correct: true })
  await inState('REVEALING_ANSWER')
  check('a correct Daily Double ruling adds the wager', score(bob.playerId) === 205)

  // ---------- Final Jeopardy ----------
  // Double Jeopardy has no clues, so it's skipped, title card included.
  t.send('advance')
  await inState('ROUND_INTRO')
  check("Final Jeopardy's title card comes next, with nobody choosing",
    now().round === 'FINAL_JEOPARDY' && now().playerChoosingClue === null &&
    !watcher.snapshots.some(x => x.state === 'ROUND_INTRO' && x.round === 'DOUBLE_JEOPARDY'))
  t.send('advance')
  await inState('FINAL_JEOPARDY_WAGERING')
  b.send('place-final-jeopardy-wager', { wager: 100 })
  c.send('place-final-jeopardy-wager', { wager: 50 })
  const trebekWager = await expectError(t, 'place-final-jeopardy-wager', { wager: 0 })
  check('Trebek wagering in Final Jeopardy → NOT_YOUR_TURN', trebekWager?.code === 'NOT_YOUR_TURN')
  await waitFor(() => viewOf(t, now())?.finalJeopardy?.players.every(p => p.wager !== null))
  check('Trebek sees the wagers as they come in; the snapshot hides them',
    viewOf(t, now())?.finalJeopardy?.players.find(p => p.playerId === bob.playerId)?.wager === 100 &&
    now().finalJeopardy.players.every(p => p.wager === null))
  const ruleTooSoon = await expectError(t, 'rule-final', { playerId: bob.playerId, correct: true })
  check('rule-final before the reveal → INVALID_STATE', ruleTooSoon?.code === 'INVALID_STATE')

  t.send('advance')
  await inState('FINAL_JEOPARDY_ANSWERING')
  b.send('answer-final-jeopardy', { answer: 'What is the Rhine?' })
  c.send('answer-final-jeopardy', { answer: 'What is the Danube?' })
  await waitFor(() => viewOf(t, now())?.finalJeopardy?.players.every(p => p.answer !== null))
  check("answers reach Trebek with suggestions, never the public snapshot",
    viewOf(t, now())?.finalJeopardy?.players.find(p => p.playerId === carol.playerId)?.suggestedCorrect === true &&
    !watcher.snapshots.some(x => JSON.stringify(x).includes('the Rhine')))

  t.send('advance')
  await inState('FINAL_JEOPARDY_REVEALING')
  s = now()
  check('the reveal goes lowest score first, everyone HIDDEN',
    JSON.stringify(s.finalJeopardy.revealOrder) === JSON.stringify([bob.playerId, carol.playerId]) &&
    s.finalJeopardy.players.every(p => p.revealStep === 'HIDDEN'),
    JSON.stringify(s.finalJeopardy.revealOrder))

  const step = async expected => {
    t.send('advance')
    return until(x => x.finalJeopardy?.players
      .find(p => p.playerId === expected.playerId)?.revealStep === expected.step)
  }
  await step({ playerId: bob.playerId, step: 'WAGER' })
  let bobFinal = now().finalJeopardy.players.find(p => p.playerId === bob.playerId)
  check('WAGER shows the wager only',
    bobFinal.wager === 100 && bobFinal.answer === null && bobFinal.correct === null)
  await step({ playerId: bob.playerId, step: 'ANSWER' })
  bobFinal = now().finalJeopardy.players.find(p => p.playerId === bob.playerId)
  check('ANSWER shows the answer', bobFinal.answer === 'What is the Rhine?' && bobFinal.correct === null)
  const unruled = await expectError(t, 'advance')
  check("awarding before a ruling → INVALID_STATE", unruled?.code === 'INVALID_STATE', JSON.stringify(unruled))

  t.send('rule-final', { playerId: bob.playerId, correct: false })
  t.send('rule-final', { playerId: carol.playerId, correct: true })
  await waitFor(() => viewOf(t, now())?.finalJeopardy?.players.every(p => p.ruling !== null))
  await step({ playerId: bob.playerId, step: 'AWARDED' })
  check('each award changes the score at once', score(bob.playerId) === 105 && score(carol.playerId) === 300)
  const changed = await expectError(t, 'rule-final', { playerId: bob.playerId, correct: true })
  check('a ruling after the award → INVALID_STATE', changed?.code === 'INVALID_STATE')

  await step({ playerId: carol.playerId, step: 'WAGER' })
  await step({ playerId: carol.playerId, step: 'ANSWER' })
  await step({ playerId: carol.playerId, step: 'AWARDED' })
  t.send('advance')
  await inState('FINISHED_GAME')
  check('the last advance ends the game with every award applied',
    now().state === 'FINISHED_GAME' && score(bob.playerId) === 105 && score(carol.playerId) === 350,
    JSON.stringify(now().players))

  check("players' Trebek subscriptions never received anything",
    b.trebekViews.length === 0 && c.trebekViews.length === 0)
  check('no clue question reached the public topic before its reveal',
    !leaked(QUESTION) && !leaked(DD_QUESTION))

  for (const conn of [watcher, t, b, c]) void conn.client.deactivate()

  // ---------- Trebek leaving mid-game ends it ----------
  const second = await hostShow(['Alex', 'Bob'])
  const w2 = connect(second.id, null)
  const t2 = connect(second.id, second.players[0].token)
  await waitFor(() => w2.connected && t2.connected)
  t2.send('update-settings', { hostMode: 'TREBEK' })
  await waitFor(() => w2.latest()?.hostMode === 'TREBEK')
  t2.send('start')
  await waitFor(() => w2.latest()?.state === 'ROUND_INTRO')
  t2.send('leave')
  await waitFor(() => w2.latest()?.state === 'CLOSED')
  check('Trebek leaving mid-game closes it as TREBEK_LEFT, with the scores',
    w2.latest()?.closeReason === 'TREBEK_LEFT' && w2.latest()?.players.length === 1,
    JSON.stringify({ state: w2.latest()?.state, closeReason: w2.latest()?.closeReason }))

  for (const conn of [w2, t2]) void conn.client.deactivate()
  await sleep(200)

  finish('Trebek')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
