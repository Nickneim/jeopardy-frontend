---
name: test-live-session
description: Run the end-to-end checks for live game sessions against the real backend, through the Vite dev server - the multiplayer protocol (STOMP) and the UI in headless Chrome with several players. Use after changing anything in live sessions (src/api/sessions.ts, src/hooks/useGameSession.ts, src/components/session/, src/pages/Session*.tsx), after syncing with a backend api.md change, or when asked to test that live games work.
---

# Test live game sessions end to end

`pnpm test` covers the pieces in isolation. These scripts cover the whole system: the browser, the Vite proxy and the real backend. They live in `scripts/e2e/` and are plain Node scripts, not a framework.

| Script | What it does | Time |
|---|---|---|
| `scripts/e2e/session-flow.mjs` | Real STOMP clients play the rules: host, `NOT_HOST`, timers and their bounds, `update-settings`, kick, a `409` for late joins, leave, host handover, a leaving chooser, `CLOSED` and the 404 after it | ~10 s |
| `scripts/e2e/trebek-flow.mjs` | Real STOMP clients play a whole Trebek game (`api.md` §6.8) on a tiny custom show (one clue, one Daily Double, Final Jeopardy): the lobby switch, every Trebek action and its errors, rulings (also early), pausing, score changes, the step-by-step Final Jeopardy reveal, that no secret reaches the public snapshot or a player's `/user/queue/trebek`, and Trebek leaving mid-game (`TREBEK_LEFT`) | ~5 s |
| `scripts/e2e/ui-flow.mjs` | Headless Chrome, one isolated browser context per player (own `localStorage`): hosting from a game page, the live games list, timers, late joining, watch or join, kick, leave, the closed view, a spectator joining mid-game, a Trebek game (the desk, the hidden clue, a ruling, Trebek leaving), and no console errors | ~1 min |

`pnpm e2e` runs all three, protocol first.

## Steps

1. **Backend.** `curl -s -m 3 http://localhost:8080/api/game-sessions` must answer (or, when the dev server runs with `BACKEND_URL`, that address instead, e.g. `http://localhost` for the Kubernetes Ingress). If it doesn't, ask the user to start it from `../backend`. Don't start it yourself, because it needs their database environment variables.
2. **Dev server.** If `http://localhost:5173` doesn't answer, start `pnpm dev` in the background. Stop it at the end only if you started it.
3. **Run** `pnpm e2e`, or one script with `node scripts/e2e/<script>`. To save tokens, filter the output to what matters: `pnpm e2e 2>&1 | grep -E "^FAIL|checks? (passed|failed)|Screenshots"`. Show the full output only when something fails.
4. **Screenshots.** `ui-flow.mjs` saves PNGs (host and player lobby, the closed view, the join choice, joining mid-game, Trebek's desk) to the folder it prints at the end. Look at them when the change is visual.

Settings, all optional: `GAME_ID` picks the game (default: the first playable one), `CHROME` the browser path (default: Chrome or Edge in the usual places), `OUT_DIR` the screenshot folder, `APP_URL` the dev server.

## Reading results

- **Exit 2** means a precondition is missing (no dev server, no backend, no playable game, no browser). The message says which.
- **`FAIL`** is a real regression in the frontend or the backend. Check `../backend/docs/api.md` to see which side is wrong before changing anything. Per CLAUDE.md, backend issues get fixed in the backend, not worked around here.

## Extending

Add a scenario where it fits in the flow. Use `check(name, ok, detail)`. Shared helpers (`api`, `preflight`, `sleep`, `finish`, and `connect`/`waitFor` for STOMP clients, which record snapshots, errors and Trebek views) are in `scripts/e2e/lib.mjs`. In `ui-flow.mjs`, each player from `newPlayer(name)` has `goto`, `waitText`, `click(label)` (buttons and links by their starting text), `join(name)`, `eval(js)` and `screenshot(file)`. `window.confirm` always returns true. Wait for text before you interact, because pages load asynchronously.
