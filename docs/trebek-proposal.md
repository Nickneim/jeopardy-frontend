# Proposal: hosting as Trebek

A backend proposal for a **Trebek host**: a host who runs the show instead of playing. Trebek shows each picked clue when they're ready, opens and closes the buzzers, rules on every answer (the answer check only suggests), changes any score at any time, decides which timers run by themselves, and can pause the clock. It's written as changes to `../backend/docs/api.md`, section by section, so it can be merged there once implemented.

Design: the "Trebek Host Role" canvas (lobby, a clue was picked, judging an answer, contestant waiting, Final Jeopardy reveal).

## What stays out of the backend

- How the host desk looks, the "Looks right" chip wording, and the order of controls.
- Anything about voice chat: players and Trebek talk outside the app. The backend only has to let Trebek rule before an answer is typed.

Everything else is game state, so it's on the server: a ruling changes scores and whose turn it is, and the hidden clue must not reach the players' browsers.

## Principles

1. **The checker suggests, Trebek decides.** In Trebek mode no answer is ever scored by the answer check (§6.7). Its result is sent to Trebek as a suggestion.
2. **A clock never rules.** An automatic timer in Trebek mode moves the game on only where no ruling is needed (opening buzzers, closing typing, locking wagers). Where a ruling is needed, the game waits for Trebek.
3. **Trebek isn't a player.** They have no score, can't buzz, wager or choose clues on their own account, and aren't counted for "everyone has buzzed", control of the board, the join score or the final standings.
4. **Classic mode doesn't change.** Every rule below applies only when `hostMode` is `TREBEK`. A session in `CONTESTANT` mode (the default) plays exactly as today, and every new response field has a value that means "as today".

---

## 1. Lobby: choosing the mode

### 1.1 `update-settings` takes more fields

`update-settings` (§4.3) gets two optional fields. **Every field becomes optional**, with at least one required (`{}` gets `INVALID_REQUEST`, `"At least one setting must be set"`):

```json
{ "allowLateJoin": true, "hostMode": "TREBEK", "timerModes": { "clueRevealMs": "TREBEK" } }
```

| Field | Rules |
|---|---|
| `hostMode` | `CONTESTANT` (the host plays, as today) \| `TREBEK` (the host runs the show) |
| `timerModes` | `Partial<SessionTimerModes>`: for each timer, `AUTOMATIC` or `TREBEK`. Fields left out keep their value. It can be set in either mode, but only matters in `TREBEK` mode. |

Still `WAITING_FOR_START` and host only (`INVALID_STATE`, `NOT_HOST`).

**Defaults** (what the design's lobby shows when you pick "Be Trebek"):

| Timer | Mode |
|---|---|
| `clueChoiceMs`, `buzzerMs`, `answerMs`, `finalJeopardyWagerMs`, `finalJeopardyAnswerMs` | `AUTOMATIC` |
| `clueRevealMs`, `dailyDoubleWagerMs`, `answerRevealMs`, `finalJeopardyRevealMs` | `TREBEK` |

Durations (`timers`, `update-timers`) are kept for every timer, whatever its mode, so switching a timer back to `AUTOMATIC` (or the session back to `CONTESTANT`, §5) uses its configured duration.

### 1.2 Who Trebek is

Switching to `TREBEK` **moves the host out of `players`** into a new response field, `trebek`:

```json
"hostMode": "TREBEK",
"hostPlayerId": 1,
"trebek": { "id": 1, "name": "Alex", "away": false },
"players": [ { "id": 2, "name": "Ken", … }, { "id": 3, "name": "Amy", … } ]
```

- Ids keep one sequence: Trebek keeps their player id and token. Switching back to `CONTESTANT` puts them back in `players` (in join order, with the session's `joinScore`).
- `hostPlayerId` is always the host, so in `TREBEK` mode it's `trebek.id`. The rule "every player id in a response belongs to someone in `players`" (§5) becomes "… in `players`, or is `trebek.id`", and only `hostPlayerId` can be `trebek.id`.
- `trebek` is `null` in `CONTESTANT` mode.

### 1.3 Starting

`start` in `TREBEK` mode needs at least one player besides Trebek: otherwise `INVALID_STATE`, `"Nobody is playing yet"`. The first chooser is the first player to join after Trebek (lowest id in `players`).

---

## 2. Trebek's actions

All are **Trebek only** (`NOT_HOST` from anyone else; `INVALID_STATE` in `CONTESTANT` mode, `"Only a Trebek host can do that"`).

| Destination | Body | Allowed when | Effect |
|---|---|---|---|
| `advance` | none | See §3 for each state | Ends the current phase now, exactly as if its timer had run out. It's how Trebek shows a clue, opens and closes the buzzers, locks wagers and answers, and goes back to the board. Allowed whether the timer is `AUTOMATIC` or `TREBEK`. |
| `return-clue` | none | `CLUE_PICKED` | Puts the picked clue back: it's `AVAILABLE` again, the same player keeps control, and `CHOOSING_CLUE` starts again with a fresh timer |
| `rule` | `{ "correct": boolean }` | `WAITING_FOR_ANSWER`, `WAITING_FOR_RULING` | Rules on the answering player's answer (§3.3), typed or not |
| `undo-ruling` | none | Right after a `rule` (§3.4) | Takes the last ruling back |
| `adjust-score` | `{ "playerId": number, "amount": number }` | Any state but `WAITING_FOR_START` and `CLOSED` | Adds `amount` (non-zero, −100000 to 100000; negative takes away) to that player's score. A player marked `leaving` can be adjusted; an unknown id gets `PLAYER_NOT_FOUND`. It counts as a score change for `joinScore` (§6.6). |
| `pause` / `resume` | none | Any state between `start` and `FINISHED_GAME` | Stops or restarts the clock (§4) |
| `choose-clue` | `{ "clueId": number }` | `CHOOSING_CLUE` | Already exists for the chooser; Trebek may now send it too, choosing **for** `playerChoosingClue` (they keep control, as when the timer chooses) |
| `place-daily-double-wager` | `{ "wager": number }` | `WAITING_FOR_DAILY_DOUBLE_WAGER` | Already exists for the chooser; Trebek may now send it too, for a wager said out loud. Same range and `INVALID_WAGER`. |
| `rule-final` | `{ "playerId": number, "correct": boolean }` | `FINAL_JEOPARDY_ANSWERING`, `FINAL_JEOPARDY_REVEALING`, before that player is scored | Rules on one Final Jeopardy answer (§3.5). Can be changed until that player's points are awarded. |

Trebek's `kick` and `leave` work as today (§5 for leaving).

---

## 3. The game in Trebek mode

### 3.1 State machine

Two new states, `CLUE_PICKED` and `WAITING_FOR_RULING`. Both are only used in `TREBEK` mode.

```
CHOOSING_CLUE ◄──────────────────────────────────────────────────────┐
   │ choose-clue (player, or Trebek for them; or the timer)          │
   ▼                                                                 │
CLUE_PICKED (always Trebek: no timer) ── return-clue ──► CHOOSING_CLUE
   │ advance ("Show clue to everyone")
   ├── Daily Double ─► WAITING_FOR_DAILY_DOUBLE_WAGER
   │                     │ wager (player or Trebek), or advance (minimum wager)
   ▼                     ▼
REVEALING_CLUE (buzzers closed)
   ├── Daily Double ─► WAITING_FOR_ANSWER (chooser only)
   │ advance ("Open the buzzers"), or the timer
   ▼
WAITING_FOR_BUZZER ── buzz ──► WAITING_FOR_ANSWER
   │ advance or timer:            │ answer, advance or timer (typing closes)
   │ nobody buzzed                ▼
   │                         WAITING_FOR_RULING (always Trebek)
   │                              │ rule (also allowed in WAITING_FOR_ANSWER)
   ▼                              ▼
REVEALING_ANSWER ◄──── correct, wrong with nobody left, Daily Double
   │ advance ("Back to the board"), or the timer
   └─► CHOOSING_CLUE, next round, Final Jeopardy or FINISHED_GAME
                   (wrong with players left → back to WAITING_FOR_BUZZER)
```

Each phase with a timer runs by its clock when its mode is `AUTOMATIC` and waits for `advance` when it's `TREBEK`. In a `TREBEK` phase, `phaseDurationMs` and `phaseRemainingMs` are `null`. `CLUE_PICKED` and `WAITING_FOR_RULING` never have a timer.

`advance` in each state:

| State | `advance` does | Not allowed |
|---|---|---|
| `CHOOSING_CLUE` | Chooses for the chooser, as the timer does (§6.2) | |
| `CLUE_PICKED` | Shows the clue (or the Daily Double) | |
| `WAITING_FOR_DAILY_DOUBLE_WAGER` | Locks the minimum wager, as the timer does | |
| `REVEALING_CLUE` | Opens the buzzers | |
| `WAITING_FOR_BUZZER` | Closes them: nobody buzzed, the answer is revealed | |
| `WAITING_FOR_ANSWER` | Closes typing: `WAITING_FOR_RULING` with no answer | |
| `WAITING_FOR_RULING` | | `INVALID_STATE`, `"Rule on the answer first"` |
| `REVEALING_ANSWER` | Back to the board (or the next round) | |
| `FINAL_JEOPARDY_WAGERING`, `FINAL_JEOPARDY_ANSWERING` | Locks wagers / answers | |
| `FINAL_JEOPARDY_REVEALING` | The next reveal step (§3.5) | Before an unruled player's award step: `INVALID_STATE`, `"Rule on <name>'s answer first"` |
| `WAITING_FOR_START`, `FINISHED_GAME`, `CLOSED` | | `INVALID_STATE` |

### 3.2 A picked clue

In `CLUE_PICKED` everyone sees which clue was picked (`currentClue.clueId` and `value`, and the slot is `PLAYED`), but nothing else: `question`, `clueType`, `mediaUrl` and `numberExpected` are hidden as while a Daily Double wager is placed, and **`dailyDouble` is `null`** (its type becomes `boolean | null`), so the board doesn't give the Daily Double away before Trebek shows it. Trebek gets the whole clue privately (§6).

### 3.3 Answers and rulings

- **Buzzing doesn't change.** A buzz still goes straight to `WAITING_FOR_ANSWER`; Trebek isn't asked.
- **The answer is private until the ruling.** `answer` from the player moves the game to `WAITING_FOR_RULING` and goes only to Trebek (§6), so Trebek sees it once it's submitted, never while it's typed. The same happens when the answer time runs out (`AUTOMATIC`) or Trebek closes typing with `advance`, with no answer.
- **Trebek can rule early**, in `WAITING_FOR_ANSWER`, before anything is submitted (an answer given out loud). The player's typing then closes.
- **A ruling scores like today's check** (§6.2): correct adds the value (or the Daily Double wager) and gives control; wrong subtracts it and lets the others buzz, or reveals the answer when nobody is left.
- **`clueAnswers` gets the entry when Trebek rules**, not when the player submits. `correct` is Trebek's ruling. `answer` is what was submitted, or `null` when Trebek ruled before an answer came or nothing was typed. `phrasedAsQuestion` is the checker's, or `null` without an answer. `matchedAnswers` and `alsoAccepted` are set only when the ruling is correct **and** the checker matched the answer; otherwise `null` (the frontend then shows `acceptedAnswers`). A new field `ruledByTrebek: boolean` says it's Trebek's call (`false` in `CONTESTANT` mode).
- **Phrasing is up to Trebek too.** The Double Jeopardy "phrase it as a question" requirement isn't applied: the checker's suggestion takes it into account (§6), and Trebek decides.

### 3.4 Undoing a ruling

`undo-ruling` takes back the last `rule` on the current clue, as long as nothing else happened since: the state is still the one the ruling led to (`REVEALING_ANSWER`, or `WAITING_FOR_BUZZER` with nobody buzzed yet) and it's the same clue. It restores the scores and control, removes the `clueAnswers` entry, and goes back to `WAITING_FOR_RULING` for that player with their answer. Otherwise `INVALID_STATE`, `"There's no ruling to undo"`. An earlier ruling is fixed with `adjust-score`.

### 3.5 Final Jeopardy

**Wagering and answering** work as today, each by its own timer mode. In a `TREBEK` phase they stay open until Trebek's `advance`. Trebek sees every wager and answer as they come in (§6).

**Rulings.** From `FINAL_JEOPARDY_ANSWERING` on, Trebek rules on each player with `rule-final`, and can change a ruling until that player's points are awarded. Nothing is decided automatically: a missing answer is a suggestion of wrong, not a ruling.

**The reveal goes one player at a time, in three steps**, lowest score first (lowest id on a tie), as the design shows:

1. **Wager**: everyone sees the player's wager.
2. **Answer**: everyone sees their answer (and `phrasedAsQuestion`).
3. **Award**: their ruling is applied to their score (the wager added or subtracted), and `correct`, `matchedAnswers` and `alsoAccepted` are shown. Needs a ruling.

Each `advance` takes one step; after the last player's award, the next `advance` finishes the game. With `finalJeopardyRevealMs` `AUTOMATIC`, the clock takes the steps instead, splitting the duration evenly over every step of every player, but **it waits at an award step until that player is ruled on** (principle 2), and continues from there.

Response changes in `finalJeopardy` (both `null` in `CONTESTANT` mode):

| Field | Meaning |
|---|---|
| `revealOrder` | Player ids in reveal order, set when `FINAL_JEOPARDY_REVEALING` starts |
| `players[].revealStep` | `HIDDEN` \| `WAGER` \| `ANSWER` \| `AWARDED`: how far this player's reveal has got |

`wager`, `answer`, `correct`, `phrasedAsQuestion`, `matchedAnswers` and `alsoAccepted` are no longer all shown when the reveal starts, but per player as their steps are reached. **Scores change at each award**, not after the whole reveal ("Scores change only after the reveal", §6.2, is classic mode only).

---

## 4. Pausing the clock

- `pause` stops the clock of the current phase; `resume` restarts it with the time that was left. Pausing when paused, or resuming when not, is a no-op (no error, no broadcast).
- **A pause holds across phases**: a phase that starts while paused starts with its full time and doesn't count down until `resume`.
- **Actions still work while paused**: players can buzz, answer and wager, and Trebek can `advance`. Only the clock stops.
- New field `paused: boolean` (always `false` in `CONTESTANT` mode). While paused, `phaseRemainingMs` is the frozen time left, so the countdown shows where it stopped. Clients don't count down while `paused` is `true`.
- The "everyone is away for 2 minutes" cleanup (§6.5) isn't paused.

---

## 5. Trebek leaving or away

- **Away.** The game goes on: automatic phases run by their clocks, and Trebek's phases wait. Trebek counts in "every player is `away`" for the 2-minute cleanup (§6.5): a session where Trebek and every player are away is closed.
- **Leaving in the lobby.** The host passes on as today (§6.4), and the session goes back to `CONTESTANT` mode: the new host is a contestant, and can pick Trebek again.
- **Leaving during the game.** The game **continues in classic mode**, in the same broadcast: `hostMode` becomes `CONTESTANT`, `trebek` `null`, `paused` `false`, every timer runs by its configured duration again (the current phase with its full duration), and the host passes to the lowest id as today. An answer waiting for a ruling is checked automatically, as in classic mode. In the Final Jeopardy reveal, the players not yet awarded are checked automatically and the reveal continues on the clock.

---

## 6. Trebek's private view: `/user/queue/trebek`

The snapshot (`/topic/sessions/{id}`) is public and never holds secrets (§5). Trebek's secrets go to a new user destination, only to Trebek's connection:

| Destination | What arrives |
|---|---|
| `/user/queue/trebek` | `TrebekViewResponse`, **once when subscribed** (so a reconnect or refresh catches up) and then after every change that alters it. Only for the connection with Trebek's token; any other subscription receives nothing. |

```json
{
  "version": 412,
  "clue": {
    "clueId": 1088, "value": 800, "dailyDouble": false,
    "categoryName": "World capitals",
    "question": "This capital sits on the Danube between Vienna and Budapest",
    "clueType": "TEXT", "mediaUrl": null, "numberExpected": false,
    "answer": "[Bratislava | Pressburg | Pozsony]",
    "acceptedAnswers": { "required": 1, "options": ["Bratislava", "Pressburg", "Pozsony"] }
  },
  "pendingAnswer": {
    "playerId": 2, "answer": "What is Bratislava?",
    "suggestedCorrect": true, "phrasedAsQuestion": true, "matchedAnswers": ["Bratislava"]
  },
  "finalJeopardy": null
}
```

| Field | Set |
|---|---|
| `version` | The snapshot version this view goes with, so the client can match the two |
| `clue` | From `CLUE_PICKED` until the clue ends; `null` otherwise. The whole clue, including the correct response. |
| `pendingAnswer` | In `WAITING_FOR_RULING`: what the answering player submitted (`answer` `null` if nothing), with the checker's result. `suggestedCorrect` is what classic mode would have scored (including the question-form rule in Double Jeopardy). `null` in every other state, also while the player is still typing. |
| `finalJeopardy` | From `FINAL_JEOPARDY_WAGERING` until the game ends: `{ question, answer, acceptedAnswers, numberExpected, players[] }`, each player with `playerId`, `wager`, `answer`, `suggestedCorrect`, `phrasedAsQuestion`, `matchedAnswers` and `ruling` (`true`, `false` or `null` before ruling), updated as wagers and answers come in. |

`GET /api/game-sessions/{id}` stays public and doesn't include any of this.

---

## 7. Changes to existing sections

- **§3.2 `GET /api/game-sessions`**: `GameSessionSummaryResponse` gets `hostMode`, so the live games list can mark a game hosted by Trebek (as it marks a custom show) before anyone joins it. `hostName` is Trebek's name; `playerCount` counts players only, not Trebek. `joinable` doesn't change. Optionally a filter `hostMode` (`CONTESTANT` or `TREBEK`, omitted for both); the design doesn't need it yet.
- **§3.2 join**: a player who joins never becomes Trebek; only the host switches.
- **§5**: new fields `hostMode`, `trebek`, `timerModes`, `paused`; `currentClue.dailyDouble` can be `null`; new `clueAnswers[].ruledByTrebek`; `finalJeopardy.revealOrder`, `players[].revealStep`.
- **§6.2**: in Trebek mode, nobody is scored by the checker; Double Jeopardy's question form is Trebek's call; Final Jeopardy scores change at each award.
- **§6.4**: Trebek is the host but not in `players`; leaving rules in §5 above.
- **§6.5**: "a game in progress is only removed by a timer when everyone is away" now includes Trebek. A game whose phases all wait for Trebek can wait forever while anyone is connected, like a lobby.
- **§7**: no new error codes. `NOT_HOST` covers Trebek's actions, with its table entry naming them.

---

## 8. TypeScript types (additions to §8)

```ts
type HostMode = "CONTESTANT" | "TREBEK";
type TimerMode = "AUTOMATIC" | "TREBEK";

type SessionTimerModes = { [K in keyof SessionTimers]: TimerMode };

type GameSessionState =
  | …
  | "CLUE_PICKED"          // Trebek mode: a clue was chosen, Trebek hasn't shown it
  | "WAITING_FOR_RULING";  // Trebek mode: the answer is in, Trebek hasn't ruled

// update-settings: every field optional, at least one
interface UpdateSettingsRequest {
  allowLateJoin?: boolean;
  hostMode?: HostMode;
  timerModes?: Partial<SessionTimerModes>;
}

interface AdjustScoreRequest { playerId: number; amount: number }  // non-zero, ±100000
interface RuleRequest { correct: boolean }
interface RuleFinalRequest { playerId: number; correct: boolean }

interface TrebekResponse {
  id: number;      // also hostPlayerId
  name: string;
  away: boolean;
}

interface GameSessionResponse {
  …
  hostMode: HostMode;
  trebek: TrebekResponse | null;   // null in CONTESTANT mode
  timerModes: SessionTimerModes;
  paused: boolean;                 // phaseRemainingMs is frozen while true
}

interface CurrentClueResponse {
  …
  dailyDouble: boolean | null;     // null in CLUE_PICKED
}

interface ClueAnswerResponse {
  …
  ruledByTrebek: boolean;
}

type FinalRevealStep = "HIDDEN" | "WAGER" | "ANSWER" | "AWARDED";

interface FinalJeopardyResponse {
  …
  revealOrder: number[] | null;    // Trebek mode, from FINAL_JEOPARDY_REVEALING
}

interface FinalJeopardyPlayerResponse {
  …
  revealStep: FinalRevealStep | null;  // Trebek mode, from FINAL_JEOPARDY_REVEALING
}

interface GameSessionSummaryResponse {
  …
  hostMode: HostMode;
}

// /user/queue/trebek
interface TrebekViewResponse {
  version: number;
  clue: TrebekClueResponse | null;
  pendingAnswer: TrebekPendingAnswerResponse | null;
  finalJeopardy: TrebekFinalJeopardyResponse | null;
}

interface TrebekClueResponse {
  clueId: number;
  value: number;
  dailyDouble: boolean;
  categoryName: string;
  question: string;
  clueType: ClueType;
  mediaUrl: string | null;
  numberExpected: boolean;
  answer: string;
  acceptedAnswers: AcceptedAnswersResponse;
}

interface TrebekPendingAnswerResponse {
  playerId: number;
  answer: string | null;           // null: nothing was submitted
  suggestedCorrect: boolean;
  phrasedAsQuestion: boolean | null;
  matchedAnswers: string[] | null;
}

interface TrebekFinalJeopardyResponse {
  question: string;
  answer: string;
  acceptedAnswers: AcceptedAnswersResponse;
  numberExpected: boolean;
  players: TrebekFinalPlayerResponse[];
}

interface TrebekFinalPlayerResponse {
  playerId: number;
  wager: number | null;
  answer: string | null;
  suggestedCorrect: boolean | null;   // null until there's an answer or answering closes
  phrasedAsQuestion: boolean | null;
  matchedAnswers: string[] | null;
  ruling: boolean | null;             // null: not ruled yet
}
```

---

## 9. Notes

- **Spectators and players never see the hidden clue**, the pending answer or the Final Jeopardy wagers before their reveal step: they're only on `/user/queue/trebek`. The frontend must not ask for them anywhere else.
- **The frontend** keeps a second subscription for Trebek, shows the host desk from `TrebekViewResponse` matched by `version`, and replaces Trebek's podium with the "Your host" plaque. `ClueAnswers` and `CorrectResponse` already fall back to `acceptedAnswers` when `matchedAnswers` is `null`.
- **Decided**: Trebek may choose a clue and place a Daily Double wager for a player; `adjust-score` is capped at ±100000 per call; `undo-ruling` only works before anything else happens on the clue; `playerCount` leaves Trebek out.
- **Out of scope**: handing the Trebek role to another player mid-game, more than one Trebek, and Trebek editing the board.
