// textures.js — the few sprites we still generate at runtime, because the
// Kenney Puzzle Pack doesn't include a good fit for them:
//   • "laser" — a thin cyan bolt for the Laser power-up.
//   • "spark" — a plain WHITE dot for the brick-break burst. It's kept white
//     (not a colored pack star) so setParticleTint() can recolor the burst to
//     match each brick exactly. The ball trail uses the pack's small star.
//
// Everything else (paddle, ball, bricks, power-ups) loads from real PNGs — see
// assets.js. Drawing these two is the same pipeline: bake into the texture
// cache with generateTexture(), then use via this.add.image(x, y, key).

export function ensureTextures(scene) {
  makeLaser(scene);
  makeSpark(scene);
}

// A thin cyan laser bolt with a bright core (fixed color).
function makeLaser(scene) {
  if (scene.textures.exists("laser")) return;
  const w = 4, h = 14;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x0891b2, 1); g.fillRoundedRect(0, 0, w, h, 2);  // cyan body
  g.fillStyle(0xa5f3fc, 1); g.fillRect(1, 1, 2, h - 2);        // bright core
  g.generateTexture("laser", w, h);
  g.destroy();
}

// A soft white dot for the brick-break particle burst (tinted per brick).
function makeSpark(scene) {
  if (scene.textures.exists("spark")) return;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 4);
  g.generateTexture("spark", 8, 8);
  g.destroy();
}
