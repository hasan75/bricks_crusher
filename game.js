// ============================================================
//  Breakout — levels, power-ups & high score
//  Builds on the Scene-class version: multiple brick layouts you
//  advance through, power-ups that drop from bricks (Wide / Multi /
//  Slow), and a high score saved in the browser between sessions.
// ============================================================

// ---- Tiny sound engine (Web Audio — no audio files to download) ----
// We SYNTHESIZE short, soft tones instead of loading .mp3/.wav assets.
// Deliberately quiet and brief for accessibility, with fade in/out so
// they never "click", and a mute toggle (press M). A single module-level
// object so its state (muted / the AudioContext) persists across restarts.
const Sound = {
  muted: false,
  ctx: null,

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
    // Fade in over 10ms and back to 0 by the end, so tones never click.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + dur);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  },

  // Cues, tuned soft (volume ≤ 0.06) and short (≤ 200ms).
  brick()  { this.tone(660, 60, 0.05); },  // crisp high blip
  paddle() { this.tone(330, 50, 0.04); },  // low, quietest — happens most
  power()  { this.tone(520, 90, 0.05); },  // pleasant "got it" chirp
  lose()   { this.tone(200, 200, 0.06); }, // low, longer "aww"
  win()    { this.tone(880, 160, 0.06); }, // bright chime

  toggle() { this.muted = !this.muted; },
  label()  { return this.muted ? "Sound: OFF (M)" : "Sound: on (M)"; }
};

// ---- Data-driven content ----

// Which fill color each layout character maps to (violet→cyan gradient).
const BRICK_COLORS = {
  "1": 0xa78bfa,
  "2": 0x818cf8,
  "3": 0x60a5fa,
  "4": 0x38bdf8,
  "5": 0x22d3ee
};

// The levels. Each level is an array of 10-wide rows; a digit places a brick
// of that color, "." is an empty gap. Add or reorder rows to design a level —
// no code changes needed.
const LEVELS = [
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
const POWERUPS = {
  W: { color: 0x34d399, name: "Wide" },   // green
  M: { color: 0xf472b6, name: "Multi" },  // pink
  S: { color: 0xfb923c, name: "Slow" }    // orange
};
const POWERUP_TYPES = ["W", "M", "S"];
const SLOW_FACTOR = 0.55;                 // ball speed multiplier while Slow is active

const HISCORE_KEY = "breakout.highScore";

// ---- The game scene ----
class BreakoutScene extends Phaser.Scene {
  constructor() {
    super("Breakout");
  }

  preload() {
    // Sound is synthesized and the particle texture is generated in create(),
    // so there are no files to load.
  }

  create() {
    // Per-game state. `level` and the effect timers start fresh each restart.
    this.level = 0;
    this.gameOver = false;
    this.slowActive = false;
    this.wideTimer = null;
    this.slowTimer = null;

    this.loadHighScore();

    // Order matters: bricks and paddle must exist before we spawn a ball
    // (its colliders reference them); the trail needs a ball to follow.
    this.buildPaddle();
    this.buildInput();
    this.buildBricks();
    this.buildBall();
    this.buildPowerups();
    this.buildEffects();
    this.buildHud();
  }

  // --- The paddle ---
  buildPaddle() {
    // Soft slate-white, 100×20, near the bottom-center. We widen it later by
    // SCALING (not resizing geometry), so 100 stays its "base" width.
    this.paddle = this.add.rectangle(400, 550, 100, 20, 0xe2e8f0);
    this.physics.add.existing(this.paddle);
    this.paddle.body.setImmovable(true);
    this.paddle.body.setAllowGravity(false);
  }

  // --- Keyboard input ---
  buildInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // --- The brick wall (persistent group, refilled per level) ---
  buildBricks() {
    this.bricks = this.physics.add.staticGroup();
    this.loadLevel();
  }

  // Clear the group and repopulate it from the current level's layout.
  loadLevel() {
    this.bricks.clear(true, true);   // destroy any leftover bricks first

    const layout = LEVELS[this.level];
    const BRICK_W = 64, BRICK_H = 24, GAP = 8, OFFSET_X = 44, OFFSET_Y = 80;

    for (let row = 0; row < layout.length; row++) {
      const line = layout[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === ".") continue;    // gap → no brick here
        const x = OFFSET_X + col * (BRICK_W + GAP) + BRICK_W / 2;
        const y = OFFSET_Y + row * (BRICK_H + GAP) + BRICK_H / 2;
        const brick = this.add.rectangle(x, y, BRICK_W, BRICK_H, BRICK_COLORS[ch]);
        this.bricks.add(brick);
      }
    }
  }

  // --- The ball(s) ---
  buildBall() {
    // Open the floor: turn OFF the bottom world edge so balls can fall out.
    // args: left, right, up, DOWN.
    this.physics.world.setBoundsCollision(true, true, true, false);

    // We keep balls in an array so multi-ball can add more; a life is lost
    // only when this array empties.
    this.balls = [];
    this.spawnBall(400, 520, 200, -200);
  }

  // Create one ball with its own colliders and add it to the array.
  spawnBall(x, y, vx, vy) {
    const ball = this.add.circle(x, y, 10, 0xfbbf24);
    this.physics.add.existing(ball);
    ball.body.setCircle(10);
    ball.body.setBounce(1, 1);
    ball.body.setCollideWorldBounds(true);
    ball.body.setVelocity(vx, vy);
    if (this.slowActive) ball.body.velocity.scale(SLOW_FACTOR); // match slow-mo
    ball.setDepth(10);               // draw on top of the trail

    // Store the colliders on the ball so we can remove them when it's gone
    // (otherwise dead-object colliders would pile up over a long game).
    ball._colliders = [
      this.physics.add.collider(ball, this.paddle, this.hitPaddle, null, this),
      this.physics.add.collider(ball, this.bricks, this.hitBrick, null, this)
    ];

    this.balls.push(ball);
    return ball;
  }

  destroyBall(ball) {
    if (ball._colliders) ball._colliders.forEach(c => c.destroy());
    ball.destroy();
  }

  clearBalls() {
    this.balls.forEach(b => this.destroyBall(b));
    this.balls = [];
  }

  // --- Power-ups (falling group + paddle catch) ---
  buildPowerups() {
    this.powerups = this.add.group();
    this.physics.add.overlap(this.paddle, this.powerups, this.collectPowerup, null, this);
  }

  spawnPowerup(x, y) {
    const type = POWERUP_TYPES[Phaser.Math.Between(0, POWERUP_TYPES.length - 1)];
    const pu = this.add.rectangle(x, y, 26, 16, POWERUPS[type].color)
      .setStrokeStyle(2, 0x0f172a);
    pu.puType = type;                // remember which power-up this is
    this.physics.add.existing(pu);
    pu.body.setAllowGravity(false);  // world gravity is 0; we push it down
    pu.body.setVelocity(0, 130);     // drift toward the paddle
    this.powerups.add(pu);
  }

  // overlap gives us (paddle, powerup) in the order we registered them.
  collectPowerup(paddle, pu) {
    const type = pu.puType;
    pu.destroy();
    Sound.power();
    this.applyPowerup(type);
  }

  applyPowerup(type) {
    if (type === "W")      { this.widenPaddle(); this.showToast("WIDE PADDLE"); }
    else if (type === "M") { this.multiBall();   this.showToast("MULTI-BALL"); }
    else if (type === "S") { this.slowMo();      this.showToast("SLOW-MO"); }
  }

  // Scale the paddle wider for a while. Scaling (not resizing geometry) keeps
  // this simple; we resize the physics body to match so collisions line up.
  widenPaddle() {
    this.setPaddleScale(1.5);
    if (this.wideTimer) this.wideTimer.remove();      // refresh, don't stack
    this.wideTimer = this.time.delayedCall(8000, () => {
      this.setPaddleScale(1);
      this.wideTimer = null;
    });
  }

  setPaddleScale(scale) {
    this.paddle.setScale(scale, 1);
    // Body width tracks the visual; `true` re-centers the body on the paddle.
    this.paddle.body.setSize(100 * scale, 20, true);
  }

  // Spawn two extra balls from the primary ball, angled left and right.
  multiBall() {
    const source = this.balls[0];
    if (!source) return;
    const speed = Math.max(source.body.velocity.length(), 260);
    [-0.5, 0.5].forEach(dx => {
      if (this.balls.length >= 6) return;             // cap the chaos
      this.spawnBall(source.x, source.y, speed * dx, -Math.abs(speed) * 0.85);
    });
  }

  // Slow every ball down for a few seconds, then restore. We scale velocities
  // directly (rather than global time) so the effect is easy to reason about.
  slowMo() {
    if (!this.slowActive) {
      this.slowActive = true;
      this.balls.forEach(b => b.body.velocity.scale(SLOW_FACTOR));
    }
    if (this.slowTimer) this.slowTimer.remove();      // refresh, don't stack
    this.slowTimer = this.time.delayedCall(6000, () => {
      this.balls.forEach(b => b.body.velocity.scale(1 / SLOW_FACTOR));
      this.slowActive = false;
      this.slowTimer = null;
    });
  }

  // Undo any active power-up effects and remove falling capsules. Called when
  // re-serving after a life and when moving to a new level.
  resetEffects() {
    if (this.wideTimer) { this.wideTimer.remove(); this.wideTimer = null; }
    this.setPaddleScale(1);
    if (this.slowTimer) { this.slowTimer.remove(); this.slowTimer = null; }
    this.slowActive = false;
    this.powerups.clear(true, true);
  }

  // --- Heads-up display ---
  buildHud() {
    this.score = 0;
    this.scoreText = this.add.text(16, 16, "Score: 0", {
      fontSize: "20px", color: "#e2e8f0"
    });

    this.bestText = this.add.text(400, 16, "Best: " + this.highScore, {
      fontSize: "20px", color: "#94a3b8"
    }).setOrigin(0.5, 0);

    this.lives = 3;
    this.livesText = this.add.text(784, 16, "Lives: 3", {
      fontSize: "20px", color: "#e2e8f0"
    }).setOrigin(1, 0);

    // Power-up legend, bottom-left: a colored chip + name for each type.
    POWERUP_TYPES.forEach((t, i) => {
      const x = 16 + i * 92;
      this.add.rectangle(x, 580, 12, 12, POWERUPS[t].color).setOrigin(0, 1);
      this.add.text(x + 16, 580, POWERUPS[t].name, {
        fontSize: "13px", color: "#94a3b8"
      }).setOrigin(0, 1);
    });

    // Mute toggle (accessibility): visible control + keyboard shortcut.
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
    if (!this.textures.exists("spark")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture("spark", 8, 8);
      g.destroy();
    }

    this.brickBurst = this.add.particles(0, 0, "spark", {
      speed: { min: 60, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 350,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false
    });

    this.ballTrail = this.add.particles(0, 0, "spark", {
      speed: 0,
      lifespan: 250,
      frequency: 25,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.45, end: 0 },
      tint: 0xfbbf24
    });
    // Follow the primary ball. We track the target ourselves so update() can
    // re-point the trail if that ball is the one that falls.
    this.trailTarget = this.balls[0];
    this.ballTrail.startFollow(this.trailTarget);
  }

  // Re-serve a single ball above the paddle and clear temporary effects.
  resetBall() {
    this.clearBalls();
    const ball = this.spawnBall(400, 520, 200, -200);
    this.trailTarget = ball;
    this.ballTrail.startFollow(ball);
    this.resetEffects();
  }

  // --- High score persistence (localStorage) ---
  loadHighScore() {
    this.highScore = 0;
    try {
      this.highScore = Number(localStorage.getItem(HISCORE_KEY)) || 0;
    } catch (e) {
      // Private mode / disabled storage → just run without a saved best.
    }
  }

  saveHighScore() {
    try {
      localStorage.setItem(HISCORE_KEY, String(this.highScore));
    } catch (e) {
      // Ignore — nothing we can do if storage is unavailable.
    }
  }

  // --- Collision callbacks ---

  // Classic Breakout feel: where the ball hits the paddle steers its angle.
  hitPaddle(ball, paddle) {
    const offset = ball.x - paddle.x;
    ball.body.setVelocityX(offset * 5);
    Sound.paddle();
    // Quick visual squash (scaleY only → physics body unchanged).
    this.tweens.add({
      targets: paddle, scaleY: 0.6, duration: 70, yoyo: true, ease: "Quad.easeOut"
    });
  }

  hitBrick(ball, brick) {
    const bx = brick.x, by = brick.y, color = brick.fillColor;
    brick.destroy();
    Sound.brick();

    this.brickBurst.setParticleTint(color);
    this.brickBurst.emitParticleAt(bx, by, 10);

    this.score += 10;
    this.scoreText.setText("Score: " + this.score);
    if (this.score > this.highScore) {            // live "Best" while ahead
      this.highScore = this.score;
      this.bestText.setText("Best: " + this.highScore);
    }

    // Speed up (capped so the ball can't tunnel through the paddle).
    if (ball.body.velocity.length() < 500) {
      ball.body.velocity.scale(1.03);
    }

    // ~18% of bricks drop a power-up.
    if (Phaser.Math.Between(1, 100) <= 18) {
      this.spawnPowerup(bx, by);
    }
  }

  // --- Flow ---

  loseLife() {
    this.lives -= 1;
    this.livesText.setText("Lives: " + this.lives);
    Sound.lose();
    if (this.lives <= 0) {
      this.endGame("GAME OVER");
    } else {
      this.resetBall();
    }
  }

  advanceLevel() {
    Sound.win();
    this.level++;
    if (this.level >= LEVELS.length) {   // beat the last level → you win
      this.endGame("YOU WIN!");
      return;
    }
    this.loadLevel();
    this.resetBall();
    this.showToast("Level " + (this.level + 1));
  }

  endGame(message) {
    this.gameOver = true;
    this.saveHighScore();

    this.physics.pause();
    this.balls.forEach(b => b.body && b.body.setVelocity(0, 0));

    this.add.text(400, 300, message + "\nPress SPACE to play again", {
      fontSize: "32px", color: "#f8fafc", align: "center"
    }).setOrigin(0.5).setDepth(20);

    this.input.keyboard.once("keydown-SPACE", () => this.scene.restart());
  }

  // A brief centered message that floats up and fades (level-ups, pickups).
  showToast(text) {
    const t = this.add.text(400, 260, text, {
      fontSize: "26px", color: "#f8fafc"
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: t, alpha: 0, y: 225, duration: 900, ease: "Quad.easeOut",
      onComplete: () => t.destroy()
    });
  }

  update() {
    if (this.gameOver) return;

    // Remove any balls that fell out the bottom.
    for (let i = this.balls.length - 1; i >= 0; i--) {
      if (this.balls[i].y > 600) {
        this.destroyBall(this.balls[i]);
        this.balls.splice(i, 1);
      }
    }

    // All balls gone → lose a life (and stop; resetBall re-serves).
    if (this.balls.length === 0) {
      this.loseLife();
      return;
    }

    // Keep the trail attached to a ball that's still alive.
    if (this.trailTarget !== this.balls[0]) {
      this.trailTarget = this.balls[0];
      this.ballTrail.startFollow(this.trailTarget);
    }

    // Clean up power-ups that fell past the paddle.
    const pus = this.powerups.getChildren();
    for (let i = pus.length - 1; i >= 0; i--) {
      if (pus[i].y > 600) pus[i].destroy();
    }

    // Level cleared → advance (or win).
    if (this.bricks.countActive() === 0) {
      this.advanceLevel();
      return;
    }

    // --- Paddle control ---
    this.paddle.x = this.input.x;                 // follow mouse by default
    if (this.cursors.left.isDown) {
      this.paddle.x -= 8;                          // arrow keys override
    } else if (this.cursors.right.isDown) {
      this.paddle.x += 8;
    }
    // Clamp using the CURRENT half-width (it changes with the Wide power-up).
    const half = this.paddle.displayWidth / 2;
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x, half, 800 - half);
  }
}

// ---- Boot ----
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#0f172a", // deep slate navy — calm, high-contrast base
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: BreakoutScene
};

const game = new Phaser.Game(config);
