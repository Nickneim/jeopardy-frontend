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
npm run preview   # serve the production build
```

There is no test runner configured. `npm run build` is the type check.

### Running against the backend

- The backend runs on `http://localhost:8080` (start it from `../backend`; see its CLAUDE.md for the database environment variables).
- `vite.config.ts` proxies `/api` to `http://localhost:8080`, so the frontend always calls relative `/api/...` URLs. The backend also allows `http://localhost:5173` via CORS, which matters for the upcoming WebSocket connection (`ws://localhost:8080/ws`), since the proxy only covers `/api`.

## Architecture

### Data flow: loaders, not effects

Pages get their data from **react-router loaders**, not `useEffect` fetches. `src/router.tsx` defines the route tree (`/` redirects to `/games`; `games`, `games/:id`, `clues/:id`), and each route's `loader` comes from the matching `src/api/*.ts` module. Pages read it with `useLoaderData() as T` and use `useNavigation()` for pending state.

Loaders validate route/search params themselves and `throw new Response(message, { status: 400 })` on bad input. All route errors (thrown `Response`s and `ApiError`s) render the single root `errorElement`, `src/pages/ErrorPage.tsx`, which distinguishes the two.

The games list keeps its filters and page in the URL search params (`season`, `title`, `from`, `to`, `page`). Links from the list pass `{ gamesSearch: location.search }` as router location state (`src/navigation.ts`), and the game and clue pages forward it on their links, so "Back to games" returns to the same filtered page. Keep forwarding `location.state` on any new links between these pages.

### API layer (`src/api/`)

- `client.ts`: one axios instance with `baseURL: '/api'` and a generic `get<T>(url, params)` helper. It converts axios errors into `ApiError` (`errors.ts`) using the backend's `ApiErrorResponse` body (`{status, message}`), falling back to the HTTP status. Add new HTTP verbs here in the same style rather than calling axios from feature modules.
- One module per backend resource (`games.ts`, `clues.ts`) holding the response interfaces (mirroring the types in `api.md`), the fetch functions, and the route loaders.

### Game board rendering

- `GameResponse` splits categories into `jeopardyRound`, `doubleJeopardyRound` and `finalJeopardy`. The round is derived from `columnNumber` (1–6 Jeopardy, 7–12 Double Jeopardy, 13 Final).
- `GET /api/games/{id}` does **not** return clue values, so `components/GameBoard.tsx` computes them from `columnNumber` and `rowNumber`. Keep this consistent with the backend's rules (`Clue.getValue()` / `api.md`). Rows can have gaps, so the board always renders 5 rows and shows an empty cell where a category has no clue for that row.
- Clue questions contain HTML from the database and are rendered with `dangerouslySetInnerHTML`. Clues may carry media (`clueType` `IMAGE` / `VIDEO` / `SOUND` with `mediaUrl`).

### Live game sessions

- "Host live game" on a game page posts to the `sessions` route action, which creates a session and redirects to `/sessions/:id`. Joining is that route's action. `src/api/sessions.ts` holds the session types (mirroring `api.md` §8), the REST calls, the loader/actions, and the player token storage (`localStorage`, keyed by session id).
- **The player token is a secret**: only ever send it in the STOMP `player-token` CONNECT header. Never display, log, or put it in a URL.
- `src/hooks/useGameSession.ts` owns the STOMP connection (`@stomp/stompjs`, plain WebSocket to `/ws`, forwarded by `vite.config.ts`). The server sends full snapshots, so the hook only keeps the one with the highest `version`, and it fetches the state over REST after every (re)connect. A STOMP ERROR before connecting means the backend rejected the token (e.g. the session was lost in a backend restart): the hook forgets it, and the page revalidates to show the join form. The hook reads its `initial` session only on mount, so `SessionPage` remounts the live view (via `key`) when the token changes.
- Components under `src/components/session/` render from the latest snapshot, switching on `state`. Countdowns come from `phaseRemainingMs` measured from when the snapshot arrived (`receivedAt`, `performance.now()`), never from the client's clock.
- There's no winner field: `GameResult` takes the highest final score, with ties.

## Code style

Matches the existing code: no semicolons, single quotes, 2-space indentation, function components with a default export, props typed with a `<Name>Props` interface, `import type` for type-only imports (`verbatimModuleSyntax` is on). TypeScript has `noUnusedLocals` / `noUnusedParameters` enabled, so the build fails on unused code.
