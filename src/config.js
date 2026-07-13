// config.js — all the game's tunable data in one place.
// Pure data (no Phaser, no logic), imported by the scenes. Edit LEVELS or
// POWERUPS here to change content without touching any game code.

// Canvas size + background, shared by main.js (and handy for scenes).
export const WIDTH = 800;
export const HEIGHT = 600;
export const BG_COLOR = "#0f172a";   // deep slate navy

// Which fill color each layout character maps to (violet→cyan gradient).
export const BRICK_COLORS = {
  "1": 0xa78bfa,
  "2": 0x818cf8,
  "3": 0x60a5fa,
  "4": 0x38bdf8,
  "5": 0x22d3ee
};

// The levels. Each level is an array of 10-wide rows; a digit places a brick
// of that color, "." is an empty gap. Add or reorder rows to design a level —
// no code changes needed.
export const LEVELS = [
  [ // Level 1 — the classic full wall
    "1111111111",
    "2222222222",
    "3333333333",
    "4444444444",
    "5555555555"
  ],
  [ // Level 2 — a pyramid
    "....11....",
    "...2222...",
    "..333333..",
    ".44444444.",
    "5555555555"
  ],
  [ // Level 3 — a checkerboard (more misses = harder to clear)
    "1.1.1.1.1.",
    ".2.2.2.2.2",
    "3.3.3.3.3.",
    ".4.4.4.4.4",
    "5.5.5.5.5."
  ]
];

// Power-up definitions: a letter code → its color and display name.
export const POWERUPS = {
  W: { color: 0x34d399, name: "Wide" },   // green
  M: { color: 0xf472b6, name: "Multi" },  // pink
  S: { color: 0xfb923c, name: "Slow" },   // orange
  E: { color: 0xef4444, name: "Life" },   // red
  K: { color: 0xc084fc, name: "Sticky" }, // purple
  L: { color: 0x22d3ee, name: "Laser" }   // cyan
};
// Every type, in legend order (shown in the HUD legend at the bottom).
export const POWERUP_TYPES = ["W", "M", "S", "E", "K", "L"];

// Leveled drops: which power-ups each level can drop, and the drop chance (%)
// per brick. Later levels unlock more (and rarer) power-ups and drop a bit more
// often. Indexed by level number (0-based), same order as LEVELS.
export const LEVEL_POWERUPS = [
  ["W", "M", "S"],                     // Level 1 — the basics
  ["W", "M", "S", "E", "K"],           // Level 2 — adds Life + Sticky
  ["W", "M", "S", "E", "K", "L"]       // Level 3 — everything, incl. Laser
];
export const POWERUP_DROP_CHANCE = [16, 20, 24]; // % per brick, by level

export const SLOW_FACTOR = 0.55;           // ball speed multiplier while Slow is active

// Per-row scoring: a brick in the BOTTOM row is worth BASE_POINTS; each row
// higher adds ROW_BONUS, so higher (harder-to-reach) rows pay more. The value
// is computed per level from the layout's height, so it works for any layout.
export const BASE_POINTS = 10;
export const ROW_BONUS = 10;
