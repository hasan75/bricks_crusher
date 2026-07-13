# 🧱 Breakout (Phaser 3)

A small, complete **Breakout** arcade game built with [Phaser 3](https://phaser.io/)
as native **ES modules** — no build step, no bundler, no framework. It's a
step-by-step teaching project that grew into a full little game with a title
screen, three levels, power-ups, sound, and a persistent high score.

> Move the paddle, bounce the ball, break every brick across 3 levels, and catch
> power-ups as they drop. Beat the last level to win — or run out of lives.

---

## ✨ Features

- **Full game flow** — Title screen → gameplay → Game Over screen, each its own
  Phaser scene, plus a **Pause overlay** layered on top of the frozen game.
- **3 hand-designed levels** — full wall → pyramid → checkerboard, defined as
  simple text layouts in `config.js` (advance on clear; beat the last to win).
- **Power-ups** that drop from bricks and are caught with the paddle. Drops are
  **leveled** — the chance rises each level and later levels unlock more types:
  - 🟢 **Wide** — grows the paddle for 8 seconds
  - 🩷 **Multi-ball** — splits into extra balls (capped at 6)
  - 🟠 **Slow-mo** — slows every ball for 6 seconds
  - 🔴 **Extra life** — +1 life
  - 🟣 **Sticky** — the ball sticks to the paddle; tap **Space** to launch it
  - 🔵 **Laser** — tap **Space** to fire bolts that break bricks
- **3 lives** and a classic **angle bounce** (where the ball hits the paddle
  steers its direction), with the ball speeding up slightly per brick.
- **High score** persisted between sessions via `localStorage`, with a live
  “Best” readout and a **NEW BEST!** flag on the Game Over screen.
- **Accessibility-friendly sound** — short, soft tones **synthesized** with the
  Web Audio API (no audio files), each faded in/out so they never click, with a
  visible **mute toggle** (press `M`).
- **Juice** — particle bursts when bricks break, a ball trail, a paddle-squash
  tween, and floating toast messages for level-ups and pickups.

---

## 🎮 Controls

| Action | Keys / Input |
|--------|--------------|
| Move paddle | **Mouse** or **← / →** arrow keys |
| Start game (title) | **Space** |
| Launch stuck ball / fire laser | **Space** (during play, with Sticky/Laser) |
| Pause / resume | **Esc** |
| Mute / unmute sound | **M** |
| Play again (game over) | **Space** |
| Back to title | **T** (on pause or game over) |

---

## 🚀 Getting started

You need a local static web server — the game uses native ES modules, which
browsers refuse to load over `file://`. [Node.js](https://nodejs.org/) is the
only prerequisite (for `npm` / `npx`).

```bash
# from the project root
npm start          # → npx serve .
```

Then open the URL it prints (e.g. **http://localhost:3000**).

After editing any file in `src/`, just **refresh the browser tab** — there's no
build step. Keep the console open (`Cmd+Option+J` / `Ctrl+Shift+J`) to see errors.

> Any static server works. If you prefer, you can use Python instead:
> `python3 -m http.server 8000` → open http://localhost:8000

---

## 📦 Project structure

```
game_dev/
├── index.html            # loads Phaser (CDN) + src/main.js as a module
├── package.json          # provides the local-server "start" script only
├── README.md
└── src/
    ├── main.js           # entry point: builds the Phaser.Game from the scenes
    ├── config.js         # pure data: canvas size, colors, LEVELS, POWERUPS
    ├── sound.js          # the Web-Audio Sound engine (synthesized tones)
    ├── storage.js        # getHighScore / setHighScore (localStorage)
    └── scenes/
        ├── TitleScene.js     # name, controls, best score → Space to start
        ├── BreakoutScene.js  # the gameplay (paddle, ball(s), bricks, power-ups)
        ├── GameOverScene.js  # win/lose result, score, replay or title
        └── PauseScene.js      # translucent overlay on the paused game
```

**How the pieces fit together:**

- **`index.html`** loads Phaser 3.80.1 from a CDN as a classic `<script>` (so
  `Phaser` is a global), then loads `src/main.js` as `<script type="module">`.
  Because the scenes rely on the `Phaser` global, they never `import` Phaser.
- **`main.js`** assembles the `Phaser.Game`, registering the four scenes. The
  first in the array (`TitleScene`) starts automatically.
- **Scenes reference each other by string key** (e.g. `scene.start("Breakout")`),
  so there are no import cycles between them. Data is passed forward via
  `scene.start("GameOver", {...})` → the target scene's `init(data)`.
- **Content is data-driven.** Everything tunable lives in `config.js` — edit the
  `LEVELS` and `POWERUPS` tables to add levels or change drops without touching
  any game logic.

---

## 🛠️ Tech stack

- **[Phaser 3](https://phaser.io/)** (v3.80.1, loaded from
  [jsDelivr CDN](https://www.jsdelivr.com/package/npm/phaser)) — Arcade Physics,
  scene management, tweens, particles.
- **Native ES modules** — `import` / `export`, no bundler, no transpiler.
- **Web Audio API** — sound effects synthesized at runtime (no asset files).
- **`localStorage`** — high-score persistence.

The game itself has **zero installed dependencies**: Phaser comes from the CDN
and everything else is your own code. `package.json` exists purely to provide
the convenience `npm start` script.

---

## ☁️ Deployment

It's a **static site** — deploy the repository root as-is to any static host.

**Netlify / Vercel / GitHub Pages / Cloudflare Pages:**
- **Build command:** *(none)*
- **Publish / output directory:** the repository root

No build step and no `package.json` are required for hosting; the host serves
`index.html` and the `src/` modules directly.

---

## 🎯 Designing your own levels

Open `src/config.js` and edit the `LEVELS` array. Each level is a list of
10-character rows. A digit `1`–`5` places a brick of that color (from
`BRICK_COLORS`); a `.` leaves a gap.

```js
[ // a heart-ish shape
  ".22..22...",
  "2222222200",  // (only 10 chars per row are used)
  "2222222222",
  ".22222222.",
  "..222222..",
]
```

To tune power-ups, edit `config.js`: `LEVEL_POWERUPS` sets which types each level
can drop, `POWERUP_DROP_CHANCE` sets the per-level drop rate, and the `POWERUPS`
table holds each one's color and name.

---

## 🧭 Incremental plan

Built as a series of small, working checkpoints — each one adds a single concept:

- Empty Phaser game → paddle & ball on screen → move the paddle
- Ball physics: fly, bounce off walls, then off the paddle
- A grid of bricks → destroy them on contact → score
- Win/lose conditions & restart
- Polish: angle bounce, speed-up, lives
- Juice pass (particles, trail, squash) and sound effects
- Refactor into scene classes, then modularize into ES modules
- Levels, power-ups & high score, plus title / game-over / pause scenes
- More power-ups (Extra life, Sticky, Laser) with leveled drops

## 🧊 Ideas / roadmap

Not yet implemented:

- **Per-row scoring** — award more points for higher rows. *(up next)*
- **Real sprite art** — swap the drawn rectangles/circles for loaded textures.

---

## 📄 License

MIT
