// assets.js — loads the Kenney "Puzzle Pack" sprites the game uses.
//
// These are real PNGs from the pack under assets/. We load them in each scene's
// preload() via preloadSprites(). Grey/neutral sprites are chosen for the brick
// and power-up so a per-object .setTint() recolors them cleanly (tint
// multiplies, so a grey source takes any hue). Fixed-color objects (paddle) use
// their pack color as-is.
//
// Pack: kenney.nl/assets/puzzle-pack (CC0). To swap in a different pack, change
// BASE + the filenames below; the texture KEYS (left-hand side) stay the same,
// so no scene code changes.

const BASE = "assets/kenney_puzzle-pack-1/PNG/Default";

// texture key → filename in the pack
export const SPRITES = {
  paddle:    "paddleBlu.png",                     // 104×24
  ball:      "ballGrey.png",                      // 22×22 (tinted amber)
  brick:     "element_grey_rectangle_glossy.png", // 64×32 (tinted per row)
  powerup:   "element_grey_square_glossy.png",    // 32×32 (tinted per type)
  starSmall: "particleSmallStar.png"              // 10×10 (ball trail)
};

// Queue every sprite for loading. Guarded so calling it from more than one
// scene's preload() doesn't re-load (and warn about) already-cached textures.
export function preloadSprites(scene) {
  scene.load.setPath(BASE);
  for (const key in SPRITES) {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, SPRITES[key]);
    }
  }
  scene.load.setPath();   // reset, so other loads aren't prefixed
}
