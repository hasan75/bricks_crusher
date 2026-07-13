// storage.js — high score persistence via localStorage.
// Wrapped in try/catch because localStorage can throw in private mode or when
// storage is disabled; in that case we just run without a saved best.

const HISCORE_KEY = "breakout.highScore";

export function getHighScore() {
  try {
    return Number(localStorage.getItem(HISCORE_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

export function setHighScore(value) {
  try {
    localStorage.setItem(HISCORE_KEY, String(value));
  } catch (e) {
    // Nothing we can do if storage is unavailable.
  }
}
