# Proposal: custom shows

A backend proposal for hosting **custom shows**: boards a player builds in the browser, importing categories from stored games and writing their own clues. It's written as changes to `../backend/docs/api.md`, section by section, so it can be merged there once implemented.

Design: the "Custom Game Editor" canvas (editor, import dialogs, clue dialog, host rejected, live games).

## What stays out of the backend

Everything about building the board happens in the frontend, with no backend calls:

- The draft (one per browser, kept in `localStorage`, restored after closing the tab), undo and redo, blind editing, the Custom and media badges, Daily Double pins.
- Exporting the board to a file and importing it back. The file is the same `CustomGameRequest` as below, wrapped with a format version: `{ "format": "jeopardy-custom-show", "version": 1, "game": CustomGameRequest }`.
- Checking whether a media link loads (the browser tries to load it).

The backend is involved only when the frontend **imports a category** and when it **hosts** the show. Nothing is stored: a custom board lives in the session's memory and goes away with it.

---

## 1. Importing a category: no new endpoint

`GET /api/games/{id}` already returns what an import needs: every category with its `id`, `name`, `comments` and `columnNumber`, and every clue's `question`, `answer`, `clueType`, `mediaUrl` and `rowNumber`. The frontend picks a game with `GET /api/games` and a category from `GET /api/games/{id}`.

- **Values follow the destination row.** A clue from row 4 of Double Jeopardy imported into Jeopardy is row 4 there, worth $800. Rows the source category had no clue for stay empty.
- **Duplicates are blocked in the frontend**, by the source category's `id`: a category already on the board can't be picked again. The board keeps each imported category's source id for that (it's sent to the backend too, see `sourceCategoryId` below, but only as information).
- **Daily Doubles aren't imported.** `dailyDoubleClueIds` is ignored: the host pins their own.

### 1.1 Optional: Final Jeopardy in the games list

The Final Jeopardy import dialog lists games with their Final Jeopardy category, and its search matches category names. Today that needs one `GET /api/games/{id}` per row. Proposed additions to `GET /api/games`:

| Change | Detail |
|---|---|
| New field `GameSummaryResponse.finalCategory` | The game's Final Jeopardy category name, or `null` if it has none |
| New query param `finalCategory` | Optional case-insensitive substring of the Final Jeopardy category name, like `title` (spaces trimmed, blank means no filter, `%` and `_` are plain characters) |

Without this, the dialog falls back to searching by title and showing the category only once a game is picked.

---

## 2. Hosting a custom show

### 2.1 `PUT /api/game-sessions/{sessionId}?session={sessionId}`

The create request takes **either** a stored game **or** a custom board:

```json
{ "gameId": 123 }
{ "customGame": { … } }
```

Exactly one of the two must be set. Both or neither: `400 INVALID_REQUEST`, `"Exactly one of gameId and customGame must be set"`.

Everything else about the create is unchanged: the client picks the code, `409 SESSION_ALREADY_EXISTS` means pick another, the session starts with the default timers, and the creator joins next and becomes the host.

#### `CustomGameRequest`

```json
{
  "name": "Family reunion night",
  "jeopardyRound": [ CustomCategoryRequest, … ],        // up to 6, columns 1–6
  "doubleJeopardyRound": [ CustomCategoryRequest, … ],  // up to 6, columns 1–6
  "finalJeopardy": CustomFinalJeopardyRequest | null
}
```

`CustomCategoryRequest`:

| Field | Rules |
|---|---|
| `column` | 1–6, unique within its round |
| `name` | The category's name, or `null` / blank when the host never named it. **The frontend sends `null` for a default name** ("Category #4"), so the backend never has to recognize them. |
| `comments` | The imported category's comments (`"(Alex: …)"`), or `null`. Shown as `BoardCategoryResponse.comments`. |
| `sourceCategoryId` | The stored category it was imported from, or `null`. Information only: the backend doesn't read the stored category. |
| `clues` | Up to 5 `CustomClueRequest`, rows unique. **A row without a clue is simply left out**, and becomes an `EMPTY` slot. |

`CustomClueRequest`:

| Field | Rules |
|---|---|
| `row` | 1–5. The value comes from the row as for stored games: Jeopardy $200–$1000, Double Jeopardy $400–$2000. |
| `question` | The clue, 1–1000 characters, stored and sent exactly as written. It may contain the same HTML tags as stored clues (`<i>`, `<br>`): the editor's previews and the live game render them (§2.2). |
| `answer` | The correct response, 1–500 characters, in the §6.7 format: `(N of) A \| B`, `[A \| B]`, `(optional)`, `A/B` |
| `clueType` | `TEXT` \| `IMAGE` \| `SOUND` \| `VIDEO` |
| `mediaUrl` | `null` for `TEXT`; for the others an `http` or `https` URL, at most 2000 characters, **on any host** |
| `dailyDouble` | `true` to make it a Daily Double |

`CustomFinalJeopardyRequest`: `{ name, comments, question, answer }`, with `name`, `question` and `answer` as above. No media and no Daily Double.

"Characters" are code points, as for player names (`[...text].length`).

#### What makes a custom show playable

The backend decides; the frontend doesn't check anything before hosting. A custom show is accepted when:

1. **It has at least one clue**, in any round. Rounds without clues are skipped, as for stored games (§6.2), and a show without a Final Jeopardy ends after its last round.
2. **The show has a name** (not blank after trimming, at most 100 characters).
3. **Every category with at least one clue has a name** (not blank, at most 100 characters). A named category without clues is fine: its column is all `EMPTY`.
4. **Final Jeopardy is all or nothing**: `null`, or a name, question and answer. A name without a clue is a problem.
5. **Every clue has a question and an answer**, within the lengths above.
6. **Every answer can be read**: it follows §6.7, and some response could match it (the same check that makes a stored game `UNPLAYABLE_GAME` today).
7. **Media matches the type**: a non-`TEXT` clue has a `mediaUrl` that is an `http(s)` URL; a `TEXT` clue has none.
8. **At most 1 Daily Double in Jeopardy and 2 in Double Jeopardy.** Fewer is fine, including none: there are exactly as many Daily Doubles as are pinned, and no random ones are added.

A request that isn't shaped right (a missing `clues` list, a column of 7, a duplicate row, a field of the wrong type) is a plain `400 INVALID_REQUEST`, like any other invalid body. Those are frontend bugs, not things the host can fix.

#### Rejection: `422 INVALID_CUSTOM_GAME`

When the show breaks any of rules 1–8, the create fails with **every** problem found, so the host can fix them all at once:

```json
{
  "status": 422,
  "code": "INVALID_CUSTOM_GAME",
  "message": "This custom show can't be played: 4 problems",
  "problems": [
    { "code": "CATEGORY_NAME_MISSING", "round": "JEOPARDY", "column": 3, "row": null,
      "message": "Category 3 has clues but no name" },
    { "code": "MEDIA_URL_MISSING", "round": "JEOPARDY", "column": 4, "row": 2,
      "message": "This video clue has no media link" },
    { "code": "ANSWER_UNREADABLE", "round": "DOUBLE_JEOPARDY", "column": 2, "row": 3,
      "message": "The correct response can't be read: a [ is never closed" },
    { "code": "FINAL_CLUE_MISSING", "round": "FINAL_JEOPARDY", "column": null, "row": null,
      "message": "Final Jeopardy has a category but no clue" }
  ]
}
```

Each problem says where it is:

| `round` | `column` | `row` | Where |
|---|---|---|---|
| `null` | `null` | `null` | The whole show (its name, or no clues at all) |
| A round | `null` | `null` | The whole round (too many Daily Doubles), or Final Jeopardy |
| A round | 1–6 | `null` | A category |
| A round | 1–6 | 1–5 | A clue |

`CustomGameProblemCode`:

| Code | Where | When |
|---|---|---|
| `NO_CLUES` | show | Rule 1 |
| `SHOW_NAME_MISSING` | show | Rule 2, blank |
| `SHOW_NAME_TOO_LONG` | show | Rule 2, over 100 |
| `CATEGORY_NAME_MISSING` | category, or Final | Rule 3, or a Final Jeopardy clue without a name (rule 4) |
| `CATEGORY_NAME_TOO_LONG` | category, or Final | Over 100 |
| `FINAL_CLUE_MISSING` | Final | Rule 4: a name but no question or answer |
| `QUESTION_MISSING` | clue, or Final | Rule 5 |
| `QUESTION_TOO_LONG` | clue, or Final | Over 1000 |
| `ANSWER_MISSING` | clue, or Final | Rule 5 |
| `ANSWER_TOO_LONG` | clue, or Final | Over 500 |
| `ANSWER_UNREADABLE` | clue, or Final | Rule 6. The message says why. |
| `MEDIA_URL_MISSING` | clue | Rule 7, a non-`TEXT` clue without a link |
| `MEDIA_URL_INVALID` | clue | Rule 7, not an `http(s)` URL or over 2000 characters |
| `MEDIA_URL_NOT_ALLOWED` | clue | Rule 7, a `TEXT` clue with a link |
| `TOO_MANY_DAILY_DOUBLES` | round | Rule 8 |

The frontend marks each problem on the board by its position and lists the messages; the `message` of each problem is in English and can be shown as it is.

`INVALID_CUSTOM_GAME` is new in the §3 error table (`422`, "Creating a session from a custom show that can't be played") and in `ApiErrorCode`. `UNPLAYABLE_GAME` stays for stored games.

### 2.2 Playing a custom show

A custom session plays exactly like a stored game. The differences are invisible to the game protocol:

- **Clue ids** are made up by the backend for the session (for example 1, 2, 3… in board order), since custom clues aren't in the database. They're only used in `choose-clue` and `currentClue.clueId`, and never collide within a session.
- **Questions are sent as written.** `currentClue.question` and `finalJeopardy.question` of a custom show contain exactly what the board had, tags included, the same as a stored game's. The backend doesn't strip, escape or validate tags. The frontend renders questions from an allowlist of the tags stored clues use (`ClueQuestion`), in the live game and in the editor's previews, so an imported `<i>` shows in italics and any other tag shows as text.
- `GameSessionResponse` doesn't change.

---

## 3. The live games list: `GET /api/game-sessions`

A custom show is listed like any session, with its name as `gameTitle`. `GameSessionSummaryResponse` changes:

| Field | Change |
|---|---|
| `custom` | **New.** `true` for a custom show, `false` for a stored game |
| `gameId` | `null` for a custom show (already documented as "a board that isn't in the database") |
| `gameTitle` | The show's name for a custom show |
| `gameSeason`, `gameDate` | `null` for a custom show (as today when `gameId` is `null`) |
| `clueCount` | **New**, for every session: how many clues the board has, across all rounds and Final Jeopardy |

- `search` already matches `gameTitle`, so it finds custom shows by name.
- Sorting by `gameSeason` or `gameDate` puts custom shows last in both directions, since their values are `null` (existing rule).
- Optionally a new filter, `custom`: `true` only custom shows, `false` only stored games, omitted for both. The design doesn't need it yet.

---

## 4. TypeScript types (additions to §8)

```ts
type ApiErrorCode =
  | …
  | "INVALID_CUSTOM_GAME";

// PUT /api/game-sessions/{code}?session={code}: exactly one of the two
type CreateGameSessionRequest =
  | { gameId: number; customGame?: never }
  | { customGame: CustomGameRequest; gameId?: never };

interface CustomGameRequest {
  name: string;                               // 1–100 characters
  jeopardyRound: CustomCategoryRequest[];     // up to 6
  doubleJeopardyRound: CustomCategoryRequest[];  // up to 6
  finalJeopardy: CustomFinalJeopardyRequest | null;
}

interface CustomCategoryRequest {
  column: number;                   // 1–6, unique in the round
  name: string | null;              // null for a category that was never named
  comments: string | null;          // kept from an imported category
  sourceCategoryId: number | null;  // the stored category it was imported from
  clues: CustomClueRequest[];       // up to 5; empty rows are left out
}

interface CustomClueRequest {
  row: number;                      // 1–5; the value follows the row
  question: string;                 // as written, tags included; 1–1000 characters
  answer: string;                   // §6.7 format, 1–500 characters
  clueType: ClueType;
  mediaUrl: string | null;          // null for TEXT; http(s), any host, otherwise
  dailyDouble: boolean;             // at most 1 in Jeopardy, 2 in Double Jeopardy
}

interface CustomFinalJeopardyRequest {
  name: string | null;
  comments: string | null;
  question: string | null;
  answer: string | null;
}

// 422 INVALID_CUSTOM_GAME
interface InvalidCustomGameResponse extends ApiErrorResponse {
  code: "INVALID_CUSTOM_GAME";
  problems: CustomGameProblem[];
}

interface CustomGameProblem {
  code: CustomGameProblemCode;
  round: GameRound | null;   // null: the whole show
  column: number | null;     // 1–6; null: the whole round, or Final Jeopardy
  row: number | null;        // 1–5; null: the whole category
  message: string;           // English, ready to show
}

type CustomGameProblemCode =
  | "NO_CLUES"
  | "SHOW_NAME_MISSING"
  | "SHOW_NAME_TOO_LONG"
  | "CATEGORY_NAME_MISSING"
  | "CATEGORY_NAME_TOO_LONG"
  | "FINAL_CLUE_MISSING"
  | "QUESTION_MISSING"
  | "QUESTION_TOO_LONG"
  | "ANSWER_MISSING"
  | "ANSWER_TOO_LONG"
  | "ANSWER_UNREADABLE"
  | "MEDIA_URL_MISSING"
  | "MEDIA_URL_INVALID"
  | "MEDIA_URL_NOT_ALLOWED"
  | "TOO_MANY_DAILY_DOUBLES";

interface GameSessionSummaryResponse {
  …
  custom: boolean;      // a custom show: gameId, gameSeason and gameDate are null
  clueCount: number;    // clues on the board, all rounds and Final Jeopardy
}

// Optional (§1.1)
interface GameSummaryResponse {
  …
  finalCategory: string | null;
}
```

---

## 5. Notes

- **Limits** (show and category names 100, questions 1000, answers 500, links 2000) are decided. A stored clue longer than its limit can still be imported; hosting then reports it (`QUESTION_TOO_LONG`, `ANSWER_TOO_LONG`) so the host can shorten it.
- **Imported answers that are already unreadable.** A stored game can be `UNPLAYABLE_GAME` because one answer can't be matched. Importing that category brings the answer along, and hosting reports it as `ANSWER_UNREADABLE`, which is the right place to fix it.
