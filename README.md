# Lanternfall

A small third-person survival game: you carry the last lantern through a valley
that goes dark, and the moths come for the light. Burn them with the beam — but
every second of fire drinks your oil, and the brighter you burn, the more of
them arrive.

Twelve waves, four moth kinds, an upgrade choice after every wave, and one oil
gauge that is simultaneously your weapon and your life.

## Play

```sh
node game/serve.js     # http://localhost:8080
```

No build step, no network requests: `game/` is plain static files and one
vendored three.js build.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes
`dossier.json`, the summary the judge reads.

## Screenshots

The four JPEGs in `screenshots/` are rendered deterministically by
`game/shots.js` through headless Chrome (DevTools protocol, Node 22 only):

```sh
node game/serve.js &
node game/shots.js
```

Each shot is a `?shot=<scene>` URL — `start`, `play`, `end`, `victory`.

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

## Licence

MIT — see `LICENSE`.
