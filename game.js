// ============================================================
//  Breakout — Scene-class refactor
//  Same game as before (paddle, ball, bricks, score, lives, sound,
//  juice), reorganized into a proper Phaser.Scene CLASS with a
//  separate Sound module. This is the clean base for levels/power-ups.
// ============================================================

// ---- Tiny sound engine (Web Audio — no audio files to download) ----
// We SYNTHESIZE short, soft tones instead of loading .mp3/.wav assets.
// Deliberately quiet and brief for accessibility, with fade in/out so
// they never "click", and a mute toggle (press M). It's a single module-level
// object so its state (muted / the AudioContext) persists across restarts.
const Sound = {
  muted: false,
  ctx: null,

  // Play one soft tone. freq in Hz, duration in ms, volume 0..1.
  tone(freq, durationMs, volume) {
    if (this.muted) return;

    // Create the AudioContext lazily. Browsers only allow audio to start
    // after a user gesture — by the time the ball is moving, that's happened.
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;                 // no Web Audio support → stay silent
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";                 // sine = smooth, no harsh overtones
    osc.frequency.value = freq;

    const now = this.ctx.currentTime;
    const dur = durationMs / 1000;
    // Gentle attack + release envelope: ramp the volume up over 10ms and back
    // down to 0 by the end, so the tone fades instead of starting/stopping
    // abruptly (sudden edges cause a jarring click).
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + dur);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  },

  // The four cues, tuned soft (volume ≤ 0.06) and short (≤ 200ms).
  brick()  { this.tone(660, 60, 0.05); },  // crisp high blip
  paddle() { this.tone(330, 50, 0.04); },  // low, quietest — happens most
  lose()   { this.tone(200, 200, 0.06); }, // low, longer "aww"
  win()    { this.tone(880, 160, 0.06); }, // bright chime

  toggle() { this.muted = !this.muted; },
  label()  { return this.muted ? "Sound: OFF (M)" : "Sound: on (M)"; }
};

// ---- The game scene ----
// A Scene bundles the world (create) and the game loop (update) together
// with all its state as `this.*`. Extending Phaser.Scene lets us split the
// setup into small, named methods instead of one giant function.
class BreakoutScene extends Phaser.Scene {
  constructor() {
    super("Breakout");   // a key we could use to reference this scene by name
  }

  preload() {
    // Later: this is where we'd load art and audio. (Sound is synthesized,
    // and we generate our particle texture in create(), so nothing here yet.)
  }

  create() {
    this.gameOver = false;   // one-way flag so win/lose fires exactly once

    // Build the world in focused steps. Order matters a little: the ball must
    // exist before the trail can follow it, so effects come after buildBall().
    this.buildPaddle();
    this.buildBall();
    this.buildInput();
    this.buildBricks();
    this.buildHud();
    this.buildEffects();
  }

  // --- The paddle ---
  buildPaddle() {
    // A rectangle 100 wide, 20 tall, near the bottom-center. x = 400 (middle
    // of an 800-wide screen), y = 550 (near the bottom). Soft slate-white
    // (not harsh pure white) reads cleanly on the navy.
    this.paddle = this.add.rectangle(400, 550, 100, 20, 0xe2e8f0);

    // Give it a physics body so the ball can collide with it.
    this.physics.add.existing(this.paddle);
    this.paddle.body.setImmovable(true);     // the ball can't push it around
    this.paddle.body.setAllowGravity(false); // (gravity is 0, but explicit)
  }

  // --- The ball ---
  buildBall() {
    // A circle of radius 10, just above the paddle. Warm amber is the one
    // accent color — it pops against the cool bricks and background.
    this.ball = this.add.circle(400, 520, 10, 0xfbbf24);
    this.physics.add.existing(this.ball);    // give it a body the engine moves

    // Open the floor: by default the ball bounces off all four world edges.
    // Turn OFF the bottom so the ball can fall out when we miss it.
    // args: left, right, up, DOWN — down = false leaves the bottom open.
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.ball.body.setCircle(10);            // treat the body as a circle, r=10
    this.ball.body.setBounce(1, 1);          // 1 = lose no speed on bounce
    this.ball.body.setCollideWorldBounds(true);
    this.ball.body.setVelocity(200, -200);   // start up-and-right (−y = up)

    // Bounce the ball off the paddle, steering the angle via hitPaddle.
    this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, null, this);
  }

  // --- Keyboard input ---
  buildInput() {
    // createCursorKeys() gives an object with .left/.right/.up/.down we can
    // poll each frame ("are you pressed right now?").
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // --- The brick wall ---
  buildBricks() {
    // A static group holds many non-moving bodies together, so we can collide
    // the ball against the whole wall at once.
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

    // Outer loop = rows (top→bottom), inner loop = columns (left→right).
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = OFFSET_X + col * (BRICK_W + GAP) + BRICK_W / 2;
        const y = OFFSET_Y + row * (BRICK_H + GAP) + BRICK_H / 2;
        const brick = this.add.rectangle(x, y, BRICK_W, BRICK_H, rowColors[row]);
        this.bricks.add(brick);     // adding to the group gives it a body
      }
    }

    // Break bricks on contact: the engine still bounces the ball; hitBrick
    // removes the brick and awards points.
    this.physics.add.collider(this.ball, this.bricks, this.hitBrick, null, this);
  }

  // --- Heads-up display: score, lives, and the mute control ---
  buildHud() {
    this.score = 0;
    this.scoreText = this.add.text(16, 16, "Score: 0", {
      fontSize: "20px", color: "#e2e8f0"
    });

    this.lives = 3;
    // setOrigin(1, 0) anchors by the top-right corner, so it stays pinned to
    // x=784 even as the number grows.
    this.livesText = this.add.text(784, 16, "Lives: 3", {
      fontSize: "20px", color: "#e2e8f0"
    }).setOrigin(1, 0);

    // Mute toggle (accessibility): a visible control + keyboard shortcut.
    this.muteText = this.add.text(784, 578, Sound.label(), {
      fontSize: "16px", color: "#94a3b8"
    }).setOrigin(1, 1);
    this.input.keyboard.on("keydown-M", () => {
      Sound.toggle();
      this.muteText.setText(Sound.label());
    });
  }

  // --- Juice: particle burst + ball trail ---
  buildEffects() {
    // Particles need a texture and we load no image files, so draw a tiny
    // white dot once and reuse it (tinted per effect). Guarded with exists()
    // so we don't re-generate it every time the scene restarts.
    if (!this.textures.exists("spark")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture("spark", 8, 8);
      g.destroy();
    }

    // Brick-break burst: a dormant emitter we fire by hand in hitBrick().
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
      alpha: { start: 0.45, end: 0 },// subtle — reads as a glow, not clutter
      tint: 0xfbbf24                 // match the ball's amber
    });

    // Draw the ball on top of its own trail and the bursts.
    this.ball.setDepth(10);
  }

  // Called on each ball–paddle collision. Classic Breakout feel: horizontal
  // velocity depends on WHERE the ball struck. Left edge → heads left, right
  // edge → heads right, dead center → nearly straight up.
  hitPaddle(ball, paddle) {
    const offset = ball.x - paddle.x;   // -50 (left) .. +50 (right)
    ball.body.setVelocityX(offset * 5); // scale the offset into a sideways push
    Sound.paddle();                     // quiet bounce tick

    // Juice: a quick squash-and-stretch. yoyo:true springs it back. Only the
    // VISUAL scaleY tweens — the physics body is unchanged, so collisions stay
    // exactly the same.
    this.tweens.add({
      targets: paddle, scaleY: 0.6, duration: 70, yoyo: true, ease: "Quad.easeOut"
    });
  }

  // Called on each ball–brick collision, in the order listed in the collider:
  // (ball, brick).
  hitBrick(ball, brick) {
    // Grab the brick's spot and color before destroying it, so the burst can
    // match the brick and appear exactly where it was.
    const bx = brick.x, by = brick.y, color = brick.fillColor;
    brick.destroy();   // remove the brick from the scene AND its group
    Sound.brick();     // soft blip

    // Juice: a little burst of same-colored sparks where the brick was.
    this.brickBurst.setParticleTint(color);
    this.brickBurst.emitParticleAt(bx, by, 10);

    this.score += 10;  // reward: 10 points per brick
    this.scoreText.setText("Score: " + this.score);

    // Speed up: nudge the ball 3% faster each break so difficulty ramps. We
    // scale the whole velocity vector (direction unchanged); a cap keeps it
    // from getting fast enough to tunnel through the paddle.
    if (ball.body.velocity.length() < 500) {
      ball.body.velocity.scale(1.03);
    }
  }

  // Re-serves the ball after a life is lost: back above the paddle at the
  // original speed (this also clears any speed-up built from breaking bricks).
  resetBall() {
    this.ball.setPosition(400, 520);
    this.ball.body.setVelocity(200, -200);
  }

  // Ends the game: freeze the world, show a message, and wait for SPACE to
  // restart (which rebuilds the scene from scratch → a fresh board).
  endGame(message) {
    this.gameOver = true;
    this.physics.pause();                 // freeze all physics bodies
    this.ball.body.setVelocity(0, 0);

    this.add.text(400, 300, message + "\nPress SPACE to play again", {
      fontSize: "32px", color: "#f8fafc", align: "center"
    }).setOrigin(0.5);

    // .once = fire this handler a single time, then forget it.
    this.input.keyboard.once("keydown-SPACE", () => this.scene.restart());
  }

  update() {
    // Runs ~60x/sec. Once the game has ended, stop the loop's logic so we
    // don't keep moving the paddle or re-triggering end conditions.
    if (this.gameOver) return;

    // Lose a life: the ball fell out the (now open) bottom.
    if (this.ball.y > 600) {
      this.lives -= 1;
      this.livesText.setText("Lives: " + this.lives);
      Sound.lose();                    // low "aww" for a lost life / game over

      if (this.lives <= 0) {
        this.endGame("GAME OVER");
      } else {
        this.resetBall();
      }
      return;
    }

    // Win: every brick is gone. countActive() counts still-alive members.
    if (this.bricks.countActive() === 0) {
      Sound.win();
      this.endGame("YOU WIN!");
      return;
    }

    // --- Paddle control ---
    // Follow the mouse/trackpad by default...
    this.paddle.x = this.input.x;

    // ...but arrow keys override it while held (8px/frame ≈ brisk slide).
    if (this.cursors.left.isDown) {
      this.paddle.x -= 8;
    } else if (this.cursors.right.isDown) {
      this.paddle.x += 8;
    }

    // Keep the paddle on screen: its center can't go past 50px from either
    // edge without half of it sliding off. Clamp to [50, 750].
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x, 50, 750);
  }
}

// ---- Boot ----
// CONFIG describes the game to Phaser, then we create it. The scene is now
// our class rather than a bag of loose functions.
const config = {
  type: Phaser.AUTO,          // let Phaser pick WebGL, fall back to Canvas
  width: 800,                 // game width in pixels
  height: 600,                // game height in pixels
  backgroundColor: "#0f172a", // deep slate navy — calm, high-contrast base

  // ARCADE physics: simple, fast, grid-style — perfect for a bouncing ball.
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },      // no gravity — the ball shouldn't fall down
      debug: false            // set true to see physics bodies outlined
    }
  },

  scene: BreakoutScene
};

const game = new Phaser.Game(config);
