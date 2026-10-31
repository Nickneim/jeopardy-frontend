# Jeopardy! frontend

A browser client for a multiplayer Jeopardy! game.

The server is in a separate repository: **[jeopardy-backend](https://github.com/Nickneim/jeopardy-backend)**.

**Live demo:** <https://d14x3ygmehrd5x.cloudfront.net>. The game server is started on demand to keep costs down, so the page often says it's offline.

## Tech stack

| Area | Technology |
| --- | --- |
| UI | React 19, TypeScript, plain CSS |
| Build and dev server | Vite |
| Routing and data loading | React Router (data router: loaders and actions, no fetching in effects) |
| Server communication | axios for REST, STOMP.js over a WebSocket for live games |
| Testing | Vitest, React Testing Library, jsdom; end-to-end scripts that drive real STOMP clients and headless Chrome |
| Package manager | pnpm |

## Running it locally

You need Node.js (a current LTS) with pnpm. The version of pnpm is pinned in `package.json`, so `corepack enable` sets it up.

1. Start the backend, following [its README](https://github.com/Nickneim/jeopardy-backend#running-it-locally). It listens on `http://localhost:8080`.
2. Start the frontend:

   ```bash
   pnpm install
   pnpm dev
   ```

3. Open <http://localhost:5173>. To play against yourself, open the same session in a second tab or a private window.

The dev server forwards `/api` and `/ws` to `http://localhost:8080`. To use a backend somewhere else, set `BACKEND_URL`, for example `BACKEND_URL=http://localhost pnpm dev` for the backend's Kubernetes setup (in PowerShell: `$env:BACKEND_URL='http://localhost'; pnpm dev`).

## Tests

```bash
pnpm test         # unit and component tests (Vitest), once
pnpm test:watch   # the same, rerun on save
pnpm lint         # ESLint
```

The unit tests never talk to a server: the API layer and the STOMP client are replaced with fakes.

```bash
pnpm e2e
```

The end-to-end checks run against the real system: real STOMP clients play through the session rules and a whole game hosted as Trebek, then headless Chrome plays a whole game with several players. They need:

- the backend running, with at least one playable game imported (or pick one with `GAME_ID`),
- the dev server running (`pnpm dev`, or set `APP_URL`),
- Chrome or Edge installed (or set `CHROME` to the browser's path).

Screenshots from the browser run go to a temporary folder (or `OUT_DIR`), printed at the end.

## Building

```bash
pnpm build        # type-check (tsc -b) and build to dist/
pnpm preview      # serve the production build
```

The build is a static site. It expects `/api` and `/ws` on the same origin, as in the live demo, where CloudFront serves the files and forwards those paths to the backend.

## Project layout

```
src/
  api/          REST client, one module per backend resource, route loaders and actions
  hooks/        the STOMP connection (useGameSession), media queries, undo history
  pages/        one component per route (router.tsx has the route tree)
  components/   the board, clues, error pages; session/ for the live game, custom/ for the editor
scripts/e2e/    end-to-end checks against the real backend
```

The REST and STOMP contract between the two repositories is the backend's [docs/api.md](https://github.com/Nickneim/jeopardy-backend/blob/main/docs/api.md).

## Disclaimer

This is a personal, non-commercial project. Jeopardy! is a trademark of Jeopardy Productions, Inc., and this project is not affiliated with it or with J-Archive.
