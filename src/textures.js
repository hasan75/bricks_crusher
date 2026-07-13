// textures.js — Kenney-style sprite textures, generated at runtime.
//
// Instead of shipping PNG asset files, we DRAW each sprite once with a Graphics
// object and bake it into the scene's texture cache via generateTexture(). From
// then on it's a normal texture: objects are created with `this.add.image(x, y,
// "brick")` etc., exactly as if we'd loaded a Kenney sprite sheet in preload().
//
// The look is "Kenney-ish": rounded corners, a bright top gloss, and a darker
// bottom edge for a soft 3D bevel. Bricks and power-ups are drawn in GRAYSCALE
// so a per-object .setTint(color) recolors them while keeping the shading
// (tint multiplies, so white → full color, gray → shadow).
//
// To use a real Kenney pack instead: load the PNGs in each scene's preload()
// and delete the matching maker below — the rest of the game is unchanged.

// Generate every texture the game needs (guarded, so it's safe to call from
// more than one scene — the cache is shared across the whole game).
export function ensureTextures(scene) {
  makeBrick(scene);
  makeBall(scene);
  makePaddle(scene);
  makePowerup(scene);
  makeLaser(scene);
  makeSpark(scene);
}

// A grayscale rounded brick with top gloss + bottom shade; tinted per row.
function makeBrick(scene) {
  if (scene.textures.exists("brick")) return;
  const w = 64, h = 24, r = 6;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xdcdcdc, 1); g.fillRoundedRect(0, 0, w, h, r);   // body (~86%)
  g.fillStyle(0xffffff, 1); g.fillRoundedRect(2, 2, w - 4, 7, 4); // top gloss
  g.fillStyle(0x9c9c9c, 1); g.fillRect(4, h - 5, w - 8, 3);     // bottom shade
  g.generateTexture("brick", w, h);
  g.destroy();
}

// A glossy amber ball (fixed color — no tint needed).
function makeBall(scene) {
  if (scene.textures.exists("ball")) return;
  const d = 20;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xd97706, 1); g.fillCircle(10, 10, 10);   // darker rim
  g.fillStyle(0xfbbf24, 1); g.fillCircle(10, 10, 8.5);  // amber body
  g.fillStyle(0xffffff, 0.6); g.fillCircle(7, 7, 2.6);  // top-left highlight
  g.generateTexture("ball", d, d);
  g.destroy();
}

// A rounded slate paddle with a lit top edge.
function makePaddle(scene) {
  if (scene.textures.exists("paddle")) return;
  const w = 100, h = 20, r = 8;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x94a3b8, 1); g.fillRoundedRect(0, 0, w, h, r);      // body
  g.fillStyle(0xe2e8f0, 1); g.fillRoundedRect(4, 2, w - 8, 6, 4);  // top highlight
  g.fillStyle(0x64748b, 1); g.fillRect(8, h - 4, w - 16, 2);       // bottom shade
  g.generateTexture("paddle", w, h);
  g.destroy();
}

// A grayscale rounded capsule with a dark outline; tinted per power-up type.
function makePowerup(scene) {
  if (scene.textures.exists("powerup")) return;
  const w = 26, h = 16, r = 7;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xdedede, 1); g.fillRoundedRect(0, 0, w, h, r);      // body
  g.fillStyle(0xffffff, 1); g.fillRoundedRect(2, 2, w - 4, 5, 3);  // top gloss
  g.fillStyle(0x9c9c9c, 1); g.fillRect(4, h - 4, w - 8, 2);        // bottom shade
  g.lineStyle(2, 0x1e293b, 1); g.strokeRoundedRect(1, 1, w - 2, h - 2, r - 1); // outline
  g.generateTexture("powerup", w, h);
  g.destroy();
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

// A soft white dot used by the particle emitters (burst + ball trail).
function makeSpark(scene) {
  if (scene.textures.exists("spark")) return;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 4);
  g.generateTexture("spark", 8, 8);
  g.destroy();
}
