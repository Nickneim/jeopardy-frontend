# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **frontend** of a multiplayer Jeopardy web app: React 19 + TypeScript + Vite, routing with `react-router` v8 (data router), HTTP with axios.

The **backend** is a separate Spring Boot repository in the sibling folder `../backend` (same parent directory as this one), with its own `CLAUDE.md`. **`../backend/docs/api.md` is the contract between the two**: REST and STOMP endpoints, payloads, game session states, timings, error codes and ready-made TypeScript types (section 8). Read it before adding or changing any API call or type. If the frontend needs something the backend doesn't provide, the change belongs in the backend (and its `api.md`), not in a frontend workaround.

## Commands

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # type-check (tsc -b) + production build
npm run lint      # ESLint
npm test          # Vitest, once (npm run test:watch to rerun on save)
npm run preview   # serve the production build
```

`npm run build` is also the type check, and it covers the test files.

### Tests

Vitest with jsdom and React Testing Library, configured in the `test` block of `vite.config.ts`. Tests sit next to the code they test (`*.test.ts(x)`) and import `describe`/`test`/`expect`/`vi` from `vitest` explicitly (no globals). `src/test/setup.ts` adds the jest-dom matchers and clears the DOM and `localStorage` after each test; `src/test/fixtures.ts` has `makeSession()`/`makePlayer()` for `GameSession` data.

- Nothing talks to the backend: API modules mock `./client`, and `useGameSession.test.ts` replaces `@stomp/stompjs`'s `Client` with a fake whose callbacks (`onConnect`, `onStompError`, subscriptions) the test calls directly.
- Components that use router hooks or `<Form>` are rendered inside `createMemoryRouter` + `RouterProvider`, with a stub `loader`/`action` where needed.

### End-to-end checks and the Stop hook

- `npm run e2e` runs `scripts/e2e/` against the real backend through the dev server (both must be running): real STOMP clients play the session rules, then headless Chrome plays a whole game with several players. The `test-live-session` skill (`.claude/skills/`) says when and how to run them.
- `.claude/settings.json` has a Stop hook, `scripts/stop-checks.mjs`, that runs build, lint and tests at the end of a turn when `src/`, `scripts/` or a config file changed since its last run. It's silent when they pass and hands failures back to Claude. Its state is in `node_modules/.cache/claude-stop-checks.json`: delete it to force a rerun.

### Running against the backend

- The backend runs on `http://localhost:8080` (start it from `../backend`; see its CLAUDE.md for the database environment variables).
- `vite.config.ts` proxies `/api` and `/ws` to the backend, so the frontend always uses relative `/api/...` and `/ws` URLs. The target is `BACKEND_URL`, default `http://localhost:8080`. The backend's Kubernetes setup (`../backend/k8s/README.md`) serves both through an Ingress on port 80: start the dev server with `BACKEND_URL=http://localhost` (in PowerShell, `$env:BACKEND_URL='http://localhost'; npm run dev`).

## Architecture

### Data flow: loaders, not effects

Pages get their data from **react-router loaders**, not `useEffect` fetches. `src/router.tsx` defines the route tree (`/` redirects to `/games`; `games`, `games/:id`, `clues/:id`, `sessions`, `sessions/:id`), and each route's `loader` comes from the matching `src/api/*.ts` module. Pages read it with `useLoaderData() as T` and use `useNavigation()` for pending state.

Loaders validate route/search params themselves and `throw new Response(message, { status: 400 })` on bad input. All route errors (thrown `Response`s and `ApiError`s) render the single root `errorElement`, `src/pages/ErrorPage.tsx`, which distinguishes the two. The backend is often switched off (production puts it behind CloudFront): an `ApiError` with status 0, 502, 503 or 504 means the game server is offline (`isServerOffline` in `src/api/errors.ts`), and `ErrorPage` shows `components/ServerOffline.tsx` with a reload button instead. While the first page's loaders run, the root route's `HydrateFallback` (`src/pages/LoadingPage.tsx`) is shown.

The games list keeps its filters and page in the URL search params (`season`, `title`, `from`, `to`, `page`). Links from the list pass `{ gamesSearch: location.search }` as router location state (`src/navigation.ts`), and the game and clue pages forward it on their links, so "Back to games" returns to the same filtered page. Keep forwarding `location.state` on any new links between these pages.

### API layer (`src/api/`)

- `client.ts`: one axios instance with `baseURL: '/api'` and a generic `get<T>(url, params)` helper. It converts axios errors into `ApiError` (`errors.ts`) using the backend's `ApiErrorResponse` body (`{status, message}`), falling back to the HTTP status. Add new HTTP verbs here in the same style rather than calling axios from feature modules.
- One module per backend resource (`games.ts`, `clues.ts`) holding the response interfaces (mirroring the types in `api.md`), the fetch functions, and the route loaders.

### Game board rendering

- `GameResponse` splits categories into `jeopardyRound`, `doubleJeopardyRound` and `finalJeopardy`. The round is derived from `columnNumber` (1–6 Jeopardy, 7–12 Double Jeopardy, 13 Final).
- `GET /api/games/{id}` does **not** return clue values, so `components/GameBoard.tsx` computes them from `columnNumber` and `rowNumber`. Keep this consistent with the backend's rules (`Clue.getValue()` / `api.md`). Rows can have gaps, so the board always renders 5 rows and shows an empty cell where a category has no clue for that row.
- Clue questions contain HTML from the database and are rendered with `dangerouslySetInnerHTML`. Clues may carry media (`clueType` `IMAGE` / `VIDEO` / `SOUND` with `mediaUrl`).

### Live game sessions

- **A session's id is a 5-character session code** such as `7KQ2M` (`api.md` §3.2), from Crockford's base32 (no I, L, O or U). `src/sessionCode.ts` makes random codes (`crypto.getRandomValues()`) and normalizes typed ones like the backend does: uppercase, O as 0, I and L as 1. `sessionLoader` validates `/sessions/:id` as a code (400 otherwise) and redirects a non-normalized URL to the normalized one, so the normalized code is what's routed (`?session=`), stored (`localStorage` keys) and shown. The lobby shows the code, and the live games list has a "Join with a code" field (`JoinByCode`), which posts to the `/sessions` action: `sessionsAction` tells it from hosting by its `code` field, checks the session exists and says on the form when the code is malformed or unknown.
- `/sessions` lists live games (its loader). "Host live game" on a game page asks for the player's name and posts to the same route's action (through a fetcher, so its errors show on the game page), which creates a session (`PUT` under a random code the client picks, picking another on `409` since the code is taken), joins it and redirects to `/sessions/:id`: hosting is one step. Joining is the `/sessions/:id` action. Both remember the name (`getRememberedPlayerName`) to fill in next time. The first player to join is the host (`hostPlayerId`): only they can start, change the lobby's timers and late-join setting (`allowLateJoin`), and kick players. Each timer saves when the host leaves its field (`TimerSettings`), with no save button. New players start at the session's `joinScore`, and a join the backend refuses because the game started (`409`) shows on the join form. Without a token you're a spectator: `JoinChoice` offers "Join this game" or "Watch as spectator", and a spectator can still join later while joining is allowed. The live games list's Join and Watch links pick the mode through location state (`joinMode`, `src/navigation.ts`), a brand new session (no players yet) opens on the join form, and someone who just left or was kicked stays on as a spectator. `src/api/sessions.ts` holds the session types (mirroring `api.md` §8), the REST calls, the loader/actions, and the player token storage (`localStorage`, keyed by session id), plus the player's own Final Jeopardy wager and answer, which the server hides until the reveal. `forgetPlayer` clears both.
- **Every request about one session carries `?session=<its id>`** (`api.md` §3.2): the create, fetch and join (`routedTo` in `src/api/sessions.ts`) and the `/ws?session=<id>` URL. With several backend instances, the load balancer routes by it to the one holding the session in memory; a single instance ignores it. So a STOMP connection only ever serves the session in its URL. The lobby list and game browsing take no parameter.
- **The player token is a secret**: only ever send it in the STOMP `player-token` CONNECT header. Never display, log, or put it in a URL.
- `src/hooks/useGameSession.ts` owns the STOMP connection (`@stomp/stompjs`, plain WebSocket to `/ws`, forwarded by `vite.config.ts`). The server sends full snapshots, so the hook only keeps the one with the highest `version`, and it fetches the state over REST after every (re)connect. The backend only sends a STOMP ERROR when a token stops working: rejected on CONNECT (e.g. the session was lost in a backend restart), or the connection closed after the player left or was kicked (then `SessionPage` shows the ERROR's message). Either way the token is forgotten and the page revalidates to show the join form. A player leaving alone closes the session, so that case navigates to `/sessions` instead. On the `CLOSED` snapshot (the session was removed) the hook stops reconnecting and the page shows a final view. When the WebSocket fails to connect, the hook fetches the session over REST: if that fails as offline too, it stops reconnecting with status `offline` and the page shows the same offline message. The hook reads its `initial` session only on mount, so `SessionPage` remounts the live view (via `key`) when the token changes.
- Components under `src/components/session/` render from the latest snapshot, switching on `state`. Countdowns come from `phaseRemainingMs` measured from when the snapshot arrived (`receivedAt`, `performance.now()`), never from the client's clock.
- **Never use `window.confirm`**: some browsers (embedded ones, like the Claude desktop app's) return `false` without showing it. Ask on the page with `ConfirmButton`, as leaving and kicking do. The UI e2e makes `window.confirm` throw.
- There's no winner field: `GameResult` takes the highest final score, with ties.
- Answers are checked on the server (`api.md` §6.7). Correct responses write alternatives as `(N of) A | B`: show them with `formatCorrectResponse` (`src/format.ts`), here and on the browsing pages. `AnswerForm` warns when only an exact number counts (`numberExpected`). The question form is only mentioned after an answer, from its `phrasedAsQuestion`: `ClueAnswers` warns the player who left it out in the Jeopardy round, and from Double Jeopardy on marks a wrong answer "not phrased as a question" (also in the Final Jeopardy table). `clueAnswersRound` says which round the answers on screen belong to.

## Code style

Matches the existing code: no semicolons, single quotes, 2-space indentation, function components with a default export, props typed with a `<Name>Props` interface, `import type` for type-only imports (`verbatimModuleSyntax` is on). TypeScript has `noUnusedLocals` / `noUnusedParameters` enabled, so the build fails on unused code.
