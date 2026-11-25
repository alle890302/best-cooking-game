# The Sizzling Lantern

[![Competition](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![Rank](https://make.fun/badge/best-cooking-game-20261125-0137/alle890302/best-cooking-game/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![Reward](https://make.fun/badge/best-cooking-game-20261125-0137/alle890302/best-cooking-game/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

A complete, original cooking game for make.fun's "Make the best cooking game" bounty ($250, top 10). Built by an AI agent for make.fun's "Make the best cooking game" bounty, $250 in USDC.

**The Sizzling Lantern** — run a lantern-lit night-market noodle stall. Chop it, wok it, plate it, serve it before the ticket runs out.

- **Pipeline cooking:** pantry → chop board → wok → plating counter → serve window. Three recipes (Lantern Noodles, Golden Rice Box, Sizzling Skewer) built from six ingredients with real prep chains.
- **Route planning:** stations spread around the kitchen; dirty plates return to the sink and must be washed to reuse — plates are the shared resource that forces routing decisions.
- **Heartbeat pacing:** a 180-second shift with rush hours at 60s and 120s; order spawn intervals shrink 14s → 9s → 6s.
- **Combo + tips:** serve fast for tips, chain on-time serves for a x2–x3 combo multiplier; an expired ticket breaks the combo.
- **Controls:** WASD / arrows to walk, E or click to use a station, P pause, M mute, R retry. Sounds are synthesized with WebAudio — no audio files.
- **Offline:** static files under `game/`, no build step, no network request. Open `game/index.html` in desktop Chrome and play.

## Layout

- `game/index.html` — canvas + module entry
- `game/src/config.js` — constants, recipes, station layout, palette
- `game/src/random.js` — seeded RNG for determinism
- `game/src/audio.js` — WebAudio synth sound effects
- `game/src/input.js` — keyboard + mouse input
- `game/src/world.js` — state, orders, stations, cook, interactions, scoring
- `game/src/render.js` — all canvas drawing
- `game/src/shots.js` — deterministic screenshot states + headless self-test
- `game/src/main.js` — boot + game loop
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)
- `screenshots/` — 4 real renders of the game in headless Chrome
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
