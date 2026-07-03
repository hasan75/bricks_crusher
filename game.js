// ============================================================
//  Breakout — juice pass: particle bursts, ball trail, paddle squash
//  Goal: make hits FEEL good — a colored burst when a brick breaks,
//  a soft comet-trail on the ball, and a quick squash on paddle hits.
// ============================================================

// 1) CONFIG — describes the game to Phaser.
const config = {
  type: Phaser.AUTO,        // let Phaser pick WebGL, fall back to Canvas
  width: 800,               // game width in pixels
  height: 600,              // game height in pixels
  backgroundColor: "#0f172a", // deep slate navy — calm, high-contrast base

  // PHYSICS — turn on the "arcade" engine: simple, fast, grid-style
  // physics that's perfect for bouncing balls and paddles.
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },    // no gravity — the ball shouldn't fall down
      debug: false          // set true to see physics bodies outlined
    }
  },

  // 2) SCENE — the three lifecycle functions Phaser calls for us.
  scene: {
    preload: preload,       // runs once: load images/sounds (nothing yet)
    create: create,         // runs once: build the world (nothing yet)
    update: update          // runs ~60x/sec: the game loop (nothing yet)
  }
};

// 3) Create the game. This boots everything above.
const game = new Phaser.Game(config);

// ---- Tiny sound engine (Web Audio — no audio files to download) ----
// We SYNTHESIZE short, soft tones instead of loading .mp3/.wav assets.
// Deliberately quiet and brief for accessibility, with fade in/out so
// they never "click", and a mute toggle (press M). `muted` lives at module
// scope so the preference sticks across restarts.
let audioCtx = null;
let muted = false;

function playTone(freq, durationMs, volume) {
  if (muted) return;

  // Create the AudioContext lazily. Browsers only allow audio to start
  // after a user gesture — by the time the ball is moving, that's happened.
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                 // no Web Audio support → stay silent
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";                 // sine = smooth, no harsh overtones
  osc.frequency.value = freq;

  const now = audioCtx.currentTime;
  const dur = durationMs / 1000;
  // Gentle attack + release envelope: ramp the volume up over 10ms and back
  // down to 0 by the end, so the tone fades instead of starting/stopping
  // abruptly (sudden edges cause a jarring click).
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur);
}

// The four cues, tuned soft (volume ≤ 0.06) and short (≤ 200ms).
function sfxBrick()  { playTone(660, 60, 0.05); }  // crisp high blip
function sfxPaddle() { playTone(330, 50, 0.04); }  // low, quietest — happens most
function sfxLose()   { playTone(200, 200, 0.06); } // low, longer "aww"
function sfxWin()    { playTone(880, 160, 0.06); } // bright chime

// Label for the on-screen mute indicator, reflecting the current state.
function muteLabel() {
  return muted ? "Sound: OFF (M)" : "Sound: on (M)";
}

// ---- The three lifecycle functions ----

function preload() {
  // Later: this is where we load art and audio.
}

function create() {
  // --- The paddle ---
  // A rectangle 100 wide, 20 tall. We place it near the bottom-center.
  // x = 400 (middle of an 800-wide screen), y = 550 (near the bottom).
  // 0x... is a hex color, like CSS #ffffff but with 0x instead of #.
  // Soft slate-white (not harsh pure white) reads cleanly on the navy.
  this.paddle = this.add.rectangle(400, 550, 100, 20, 0xe2e8f0);

  // Give the paddle a physics body too, so the ball can collide with it.
  this.physics.add.existing(this.paddle);
  this.paddle.body.setImmovable(true);     // the ball can't push it around
  this.paddle.body.setAllowGravity(false); // (gravity is already 0, but explicit)

  // --- The ball ---
  // A circle of radius 10, sitting just above the paddle. Warm amber is the
  // one accent color — it pops against the cool bricks and background.
  this.ball = this.add.circle(400, 520, 10, 0xfbbf24);

  // Give the ball a PHYSICS BODY so the engine can move it for us.
  this.physics.add.existing(this.ball);

  // --- Open the floor ---
  // By default the ball bounces off all four world edges. We turn OFF the
  // bottom edge so the ball can fall out when we miss it (our lose check).
  // args: left, right, up, DOWN — down = false leaves the bottom open.
  this.physics.world.setBoundsCollision(true, true, true, false);

  // Now configure that body (reached via this.ball.body):
  this.ball.body.setCircle(10);            // treat the body as a circle, r=10
  this.ball.body.setBounce(1, 1);          // 1 = lose no speed on bounce
  this.ball.body.setCollideWorldBounds(true); // bounce off the screen edges
  this.ball.body.setVelocity(200, -200);   // start moving up-and-right
                                           // (negative y = upward)

  // We saved both on `this` (the Scene) so other functions — like
  // update() — can reach them later by name: this.paddle, this.ball.

  // --- Set up keyboard input ---
  // createCursorKeys() gives us an object with .left, .right, .up, .down
  // that we can ask "are you pressed right now?" every frame.
  this.cursors = this.input.keyboard.createCursorKeys();

  // --- Make the ball and paddle collide ---
  // A "collider" tells physics: keep these two from overlapping, and
  // bounce them apart when they touch. The 3rd argument is a callback
  // (hitPaddle) so we can steer the bounce angle by where the ball lands.
  this.physics.add.collider(this.ball, this.paddle, hitPaddle, null, this);

  // --- Build the brick wall ---
  // A "static group" holds many non-moving physics objects together,
  // so later we can collide the ball against the whole group at once.
  this.bricks = this.physics.add.staticGroup();

  const ROWS = 5;
  const COLS = 10;
  const BRICK_W = 64;
  const BRICK_H = 24;
  const GAP = 8;                  // space between bricks
  const OFFSET_X = 44;            // left margin before the first brick
  const OFFSET_Y = 80;            // top margin before the first row

  // A cohesive violet→cyan gradient (top to bottom): analogous hues that
  // harmonize, while each row stays distinct enough to read at a glance.
  const rowColors = [0xa78bfa, 0x818cf8, 0x60a5fa, 0x38bdf8, 0x22d3ee];

  // Outer loop = rows (top to bottom), inner loop = columns (left to right).
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Compute this brick's center from its row/column.
      const x = OFFSET_X + col * (BRICK_W + GAP) + BRICK_W / 2;
      const y = OFFSET_Y + row * (BRICK_H + GAP) + BRICK_H / 2;

      // Make the brick, then add it to the group (which gives it a body).
      const brick = this.add.rectangle(x, y, BRICK_W, BRICK_H, rowColors[row]);
      this.bricks.add(brick);
    }
  }

  // --- Make the ball break bricks ---
  // Same collider tool as the paddle, but with a 3rd argument: a
  // callback that runs every time the ball touches a brick. The
  // engine still bounces the ball; our callback removes the brick.
  this.physics.add.collider(this.ball, this.bricks, hitBrick, null, this);

  // --- Score ---
  // Game *state* is just a plain variable on the Scene. We start at 0.
  this.score = 0;

  // A text object draws that state on screen. (16, 16) = 16px in from the
  // top-left corner. We keep a reference (this.scoreText) so we can update
  // its contents later, in hitBrick().
  this.scoreText = this.add.text(16, 16, "Score: 0", {
    fontSize: "20px", color: "#e2e8f0"
  });

  // --- Lives ---
  // Start with 3. We show them top-RIGHT; setOrigin(1, 0) anchors the text
  // by its top-right corner so it stays pinned to x=784 as the number grows.
  this.lives = 3;
  this.livesText = this.add.text(784, 16, "Lives: 3", {
    fontSize: "20px", color: "#e2e8f0"
  }).setOrigin(1, 0);

  // --- Mute toggle (accessibility) ---
  // A visible control + keyboard shortcut so sound is easy to turn off.
  // `muted` is module-level, so the choice persists across restarts; we
  // just reflect its current value in the label here.
  this.muteText = this.add.text(784, 578, muteLabel(), {
    fontSize: "16px", color: "#94a3b8"
  }).setOrigin(1, 1);
  this.input.keyboard.on("keydown-M", () => {
    muted = !muted;
    this.muteText.setText(muteLabel());
  });

  // --- Juice: a reusable "spark" texture for particle effects ---
  // Phaser's particles need a texture, and we don't load image files — so we
  // draw a tiny white dot once and reuse it (tinted per effect). Guarded with
  // exists() so we don't re-generate it every time the scene restarts.
  if (!this.textures.exists("spark")) {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture("spark", 8, 8);
    g.destroy();
  }

  // Brick-break burst: an idle emitter we fire by hand in hitBrick(). It sits
  // dormant (emitting:false) and sprays a few sparks on demand at the brick.
  this.brickBurst = this.add.particles(0, 0, "spark", {
    speed: { min: 60, max: 200 },
    angle: { min: 0, max: 360 },   // fling outward in every direction
    lifespan: 350,
    scale: { start: 1, end: 0 },   // shrink to nothing
    alpha: { start: 1, end: 0 },   // and fade out — no hard pop
    emitting: false
  });

  // Ball trail: a soft amber comet-tail that continuously follows the ball.
  this.ballTrail = this.add.particles(0, 0, "spark", {
    follow: this.ball,
    speed: 0,
    lifespan: 250,
    frequency: 25,                 // emit a dot every 25ms
    scale: { start: 0.8, end: 0 },
    alpha: { start: 0.45, end: 0 },// subtle, so it reads as a glow not clutter
    tint: 0xfbbf24                 // match the ball's amber
  });

  // Draw the ball on top of its own trail and the bursts.
  this.ball.setDepth(10);

  // --- End-of-game guard ---
  // A one-way flag so the win/lose check in update() fires exactly once,
  // not 60 times a second after the game ends.
  this.gameOver = false;
}

// Ends the game: freeze the world, show a message, and wait for SPACE to
// restart. We take `scene` as an argument because update() will call this
// as endGame(this, ...), passing the Scene explicitly.
function endGame(scene, message) {
  scene.gameOver = true;
  scene.physics.pause();                 // freeze all physics bodies
  scene.ball.body.setVelocity(0, 0);     // and make sure the ball is still

  scene.add.text(400, 300, message + "\nPress SPACE to play again", {
    fontSize: "32px", color: "#f8fafc", align: "center"
  }).setOrigin(0.5);                     // center the text on that point

  // .once = fire this handler a single time, then forget it. restart()
  // rebuilds the Scene from scratch (create() runs again → fresh board).
  scene.input.keyboard.once("keydown-SPACE", () => scene.scene.restart());
}

// Re-serves the ball after a life is lost: drop it back above the paddle
// and give it the original starting speed (this also clears any speed-up
// it had built from breaking bricks).
function resetBall(scene) {
  scene.ball.setPosition(400, 520);
  scene.ball.body.setVelocity(200, -200);
}

// Called on each ball–brick collision. Phaser passes the two objects
// that collided, in the same order we listed them in the collider:
// (ball, brick). Because Step 6 passed `this` as the collider context,
// `this` inside here is the Scene — so this.score / this.scoreText work.
function hitBrick(ball, brick) {
  // Grab the brick's spot and color before we destroy it, so the burst can
  // match the brick and appear exactly where it was.
  const bx = brick.x, by = brick.y, color = brick.fillColor;
  brick.destroy();   // remove the brick from the scene AND its group
  sfxBrick();        // soft blip

  // Juice: a little burst of same-colored sparks where the brick was.
  this.brickBurst.setParticleTint(color);
  this.brickBurst.emitParticleAt(bx, by, 10);

  this.score += 10;  // reward: 10 points per brick
  this.scoreText.setText("Score: " + this.score); // redraw the label

  // --- Speed up ---
  // Nudge the ball 3% faster each break so the game ramps in difficulty.
  // We scale the whole velocity vector, so direction is unchanged. A cap
  // keeps it from getting so fast it tunnels through the paddle.
  const speed = ball.body.velocity.length();     // current speed (px/sec)
  if (speed < 500) {
    ball.body.velocity.scale(1.03);
  }
}

// Called when the ball hits the paddle. Classic Breakout feel: the ball's
// horizontal velocity depends on WHERE it struck the paddle. Hit the left
// edge → it heads left; hit the right edge → it heads right; dead center →
// it goes nearly straight up.
function hitPaddle(ball, paddle) {
  const offset = ball.x - paddle.x;   // -50 (left edge) .. +50 (right edge)
  ball.body.setVelocityX(offset * 5); // scale the offset into a sideways push
  sfxPaddle();                        // quiet bounce tick

  // Juice: a quick squash-and-stretch. yoyo:true springs it back to normal.
  // We only tween the VISUAL scaleY — the physics body is unchanged, so
  // collisions stay exactly the same.
  this.tweens.add({
    targets: paddle, scaleY: 0.6, duration: 70, yoyo: true, ease: "Quad.easeOut"
  });
}

function update() {
  // This runs ~60 times per second. Each call, we decide where the
  // paddle should be and nudge it there.

  // Once the game has ended, stop running the loop's logic. Otherwise
  // we'd keep moving the paddle and re-triggering end conditions.
  if (this.gameOver) {
    return;
  }

  // --- Lose a life: the ball fell out the (now open) bottom ---
  if (this.ball.y > 600) {
    this.lives -= 1;
    this.livesText.setText("Lives: " + this.lives);

    if (this.lives <= 0) {
      sfxLose();
      endGame(this, "GAME OVER");   // out of lives → the game is over
    } else {
      sfxLose();                    // same low "aww" for a lost life
      resetBall(this);              // still alive → re-serve the ball
    }
    return;
  }

  // --- Win: every brick is gone ---
  // countActive() counts the still-alive members of the static group.
  if (this.bricks.countActive() === 0) {
    sfxWin();
    endGame(this, "YOU WIN!");
    return;
  }

  // --- Mouse / trackpad control ---
  // this.input.x is the pointer's current x position over the canvas.
  // Following it makes the paddle track the mouse.
  this.paddle.x = this.input.x;

  // --- Arrow-key control (overrides the mouse while a key is held) ---
  // 8 pixels per frame ≈ a brisk, responsive slide.
  if (this.cursors.left.isDown) {
    this.paddle.x -= 8;
  } else if (this.cursors.right.isDown) {
    this.paddle.x += 8;
  }

  // --- Keep the paddle on screen ---
  // The paddle is 100 wide, so its center can't go past 50px from
  // either edge without half of it sliding off. Clamp it to [50, 750].
  this.paddle.x = Phaser.Math.Clamp(this.paddle.x, 50, 750);
}
