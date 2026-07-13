// scenes/BreakoutScene.js — the gameplay scene.
// `Phaser` is a global from the CDN <script> in index.html (loaded before this
// module), so we don't import it; we only import our own modules.
import { Sound } from "../sound.js";
import { getHighScore, setHighScore } from "../storage.js";
import {
  BRICK_COLORS, LEVELS, POWERUPS, POWERUP_TYPES,
  LEVEL_POWERUPS, POWERUP_DROP_CHANCE, SLOW_FACTOR,
  BASE_POINTS, ROW_BONUS
} from "../config.js";

export class BreakoutScene extends Phaser.Scene {
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
    this.stickyActive = false;
    this.stickyTimer = null;
    this.laserActive = false;
    this.laserTimer = null;
    this.lastFire = 0;

    this.loadHighScore();

    // Remember the best we started with, so Game Over can tell if this run
    // set a NEW record (the live `highScore` gets bumped as we play).
    this.previousBest = this.highScore;

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

    // Esc pauses: freeze this scene and launch the Pause overlay on top.
    // A paused scene stops processing input, so this won't re-fire until we
    // resume — and the Pause scene owns the "resume" key.
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.gameOver) return;       // ignore during the end-game hand-off
      this.scene.pause();
      this.scene.launch("Pause");
    });

    // Space does double duty: release any ball stuck to the paddle (Sticky
    // power-up), otherwise fire the lasers (Laser power-up). Harmless if
    // neither is active.
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.gameOver) return;
      const stuck = this.balls.filter(b => b._stuck);
      if (stuck.length) {
        stuck.forEach(b => this.launchBall(b));
      } else if (this.laserActive) {
        this.fireLasers();
      }
    });
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
      // Higher rows are worth more: bottom row = BASE_POINTS, +ROW_BONUS per
      // row up. `row` is 0 at the top, so distance from the bottom is the bonus.
      const points = BASE_POINTS + (layout.length - 1 - row) * ROW_BONUS;
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === ".") continue;    // gap → no brick here
        const x = OFFSET_X + col * (BRICK_W + GAP) + BRICK_W / 2;
        const y = OFFSET_Y + row * (BRICK_H + GAP) + BRICK_H / 2;
        const brick = this.add.rectangle(x, y, BRICK_W, BRICK_H, BRICK_COLORS[ch]);
        brick.points = points;       // remembered for scoring when it breaks
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

    // Laser bolts fired by the paddle (Laser power-up); they destroy bricks.
    // A PLAIN group (like `powerups` above): we enable a body per bolt in
    // fireLasers(). A physics group would reset each bolt's velocity to its
    // group default (0,0) on add, freezing the bolts on the paddle.
    this.lasers = this.add.group();
    this.physics.add.overlap(this.lasers, this.bricks, this.laserHitBrick, null, this);
  }

  spawnPowerup(x, y) {
    // Only drop power-ups unlocked at the current level.
    const list = LEVEL_POWERUPS[this.level] || POWERUP_TYPES;
    const type = list[Phaser.Math.Between(0, list.length - 1)];
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
    if (type === "W")      { this.widenPaddle();  this.showToast("WIDE PADDLE"); }
    else if (type === "M") { this.multiBall();    this.showToast("MULTI-BALL"); }
    else if (type === "S") { this.slowMo();       this.showToast("SLOW-MO"); }
    else if (type === "E") { this.extraLife();    this.showToast("EXTRA LIFE"); }
    else if (type === "K") { this.stickyPaddle(); this.showToast("STICKY PADDLE"); }
    else if (type === "L") { this.laserPaddle();  this.showToast("LASER"); }
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

  // Grant one extra life. The simplest power-up: no timer, no cleanup.
  extraLife() {
    this.lives += 1;
    this.livesText.setText("Lives: " + this.lives);
  }

  // Sticky paddle: for a while, a ball that hits the paddle sticks to it
  // (see hitPaddle) until the player taps Space to launch it (see buildInput).
  stickyPaddle() {
    this.stickyActive = true;
    if (this.stickyTimer) this.stickyTimer.remove();      // refresh, don't stack
    this.stickyTimer = this.time.delayedCall(8000, () => {
      this.stickyActive = false;
      // Auto-launch anything still stuck when the effect wears off.
      this.balls.forEach(b => { if (b._stuck) this.launchBall(b); });
      this.stickyTimer = null;
    });
  }

  // Attach a ball to the paddle, remembering where along it the ball landed.
  stickBall(ball) {
    ball._stuck = true;
    ball._stickOffset = ball.x - this.paddle.x;
    ball.body.setVelocity(0, 0);
    Sound.paddle();
  }

  // Release a stuck ball: fire it upward, angled by where it sat on the paddle.
  launchBall(ball) {
    ball._stuck = false;
    const offset = ball._stickOffset || 0;
    ball.body.setVelocity(offset * 5, -300);
    if (this.slowActive) ball.body.velocity.scale(SLOW_FACTOR);
    Sound.paddle();
  }

  // Laser paddle: for a while, Space fires bolts that break bricks (see
  // buildInput → fireLasers). Just flips a flag on a timer.
  laserPaddle() {
    this.laserActive = true;
    if (this.laserTimer) this.laserTimer.remove();        // refresh, don't stack
    this.laserTimer = this.time.delayedCall(8000, () => {
      this.laserActive = false;
      this.laserTimer = null;
    });
  }

  // Fire two bolts from the paddle edges, rate-limited so a held key can't spam.
  fireLasers() {
    const now = this.time.now;
    if (now - this.lastFire < 260) return;
    this.lastFire = now;
    [-1, 1].forEach(side => {
      const lx = this.paddle.x + side * (this.paddle.displayWidth / 2 - 6);
      const bolt = this.add.rectangle(lx, this.paddle.y - 16, 4, 14, 0x22d3ee);
      this.physics.add.existing(bolt);
      bolt.body.setAllowGravity(false);
      bolt.body.setVelocity(0, -520);
      this.lasers.add(bolt);
    });
    Sound.laser();
  }

  // Undo any active power-up effects and remove falling capsules. Called when
  // re-serving after a life and when moving to a new level.
  resetEffects() {
    if (this.wideTimer) { this.wideTimer.remove(); this.wideTimer = null; }
    this.setPaddleScale(1);
    if (this.slowTimer) { this.slowTimer.remove(); this.slowTimer = null; }
    this.slowActive = false;
    if (this.stickyTimer) { this.stickyTimer.remove(); this.stickyTimer = null; }
    this.stickyActive = false;
    if (this.laserTimer) { this.laserTimer.remove(); this.laserTimer = null; }
    this.laserActive = false;
    this.lasers.clear(true, true);
    this.powerups.clear(true, true);
  }

  // --- Heads-up display ---
  buildHud() {
    this.score = 0;
    this.scoreText = this.add.text(16, 16, "Score: 0", {
      fontSize: "20px", color: "#e2e8f0"
    });

    // Control hints, tucked under the score (top-left).
    this.add.text(16, 44, "Esc: pause   ·   Space: launch / fire laser", {
      fontSize: "12px", color: "#64748b"
    });

    this.bestText = this.add.text(400, 16, "Best: " + this.highScore, {
      fontSize: "20px", color: "#94a3b8"
    }).setOrigin(0.5, 0);

    this.lives = 3;
    this.livesText = this.add.text(784, 16, "Lives: 3", {
      fontSize: "20px", color: "#e2e8f0"
    }).setOrigin(1, 0);

    // Power-up legend, bottom-left: a colored chip + name for each type. We lay
    // them out with a running x using each label's measured width, so all six
    // fit without overlapping.
    let lx = 14;
    POWERUP_TYPES.forEach((t) => {
      this.add.rectangle(lx, 580, 12, 12, POWERUPS[t].color).setOrigin(0, 1);
      const label = this.add.text(lx + 16, 580, POWERUPS[t].name, {
        fontSize: "13px", color: "#94a3b8"
      }).setOrigin(0, 1);
      lx += 16 + label.width + 14;
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

  // --- High score persistence (localStorage, via storage.js) ---
  loadHighScore() {
    this.highScore = getHighScore();
  }

  saveHighScore() {
    setHighScore(this.highScore);
  }

  // --- Collision callbacks ---

  // Classic Breakout feel: where the ball hits the paddle steers its angle.
  hitPaddle(ball, paddle) {
    // Sticky power-up: catch the ball instead of bouncing it (until Space).
    if (this.stickyActive && !ball._stuck) {
      this.stickBall(ball);
      return;
    }
    const offset = ball.x - paddle.x;
    ball.body.setVelocityX(offset * 5);
    Sound.paddle();
    // Quick visual squash (scaleY only → physics body unchanged).
    this.tweens.add({
      targets: paddle, scaleY: 0.6, duration: 70, yoyo: true, ease: "Quad.easeOut"
    });
  }

  hitBrick(ball, brick) {
    this.breakBrick(brick);

    // Speed up (capped so the ball can't tunnel through the paddle).
    if (ball.body.velocity.length() < 500) {
      ball.body.velocity.scale(1.03);
    }
  }

  // A laser bolt hits a brick: destroy both. Guard against a bolt or brick
  // already consumed this frame (overlap can fire more than once).
  laserHitBrick(laser, brick) {
    if (!laser.active || !brick.active) return;
    laser.destroy();
    this.breakBrick(brick);
  }

  // Shared brick destruction: particles, sound, score, and the leveled drop.
  // Used by both the ball (hitBrick) and the laser (laserHitBrick).
  breakBrick(brick) {
    const bx = brick.x, by = brick.y, color = brick.fillColor;
    const points = brick.points ?? BASE_POINTS;   // per-row value (top rows pay more)
    brick.destroy();
    Sound.brick();

    this.brickBurst.setParticleTint(color);
    this.brickBurst.emitParticleAt(bx, by, 10);

    this.score += points;
    this.scoreText.setText("Score: " + this.score);
    this.showPoints(bx, by, points, color);       // floating "+N" at the brick
    if (this.score > this.highScore) {            // live "Best" while ahead
      this.highScore = this.score;
      this.bestText.setText("Best: " + this.highScore);
    }

    // Leveled chance to drop a power-up (rises with the level).
    const chance = POWERUP_DROP_CHANCE[this.level] ?? 18;
    if (Phaser.Math.Between(1, 100) <= chance) {
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

    // Hold on the final frame for a beat, then hand off to the Game Over
    // scene, passing it the result to display.
    this.time.delayedCall(600, () => {
      this.scene.start("GameOver", {
        won: message === "YOU WIN!",
        score: this.score,
        best: this.highScore,
        isNewBest: this.score > this.previousBest
      });
    });
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

  // A small "+N" that pops where a brick broke, tinted to match it, so the
  // per-row point difference is visible. Floats up briefly and fades.
  showPoints(x, y, points, color) {
    const hex = "#" + color.toString(16).padStart(6, "0");
    const t = this.add.text(x, y, "+" + points, {
      fontSize: "16px", color: hex, fontStyle: "bold"
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t, alpha: 0, y: y - 28, duration: 600, ease: "Quad.easeOut",
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

    // Clean up laser bolts that flew off the top.
    const bolts = this.lasers.getChildren();
    for (let i = bolts.length - 1; i >= 0; i--) {
      if (bolts[i].y < -20) bolts[i].destroy();
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

    // Carry any stuck balls (Sticky power-up) along with the paddle, resting
    // just above it, until the player launches them with Space.
    this.balls.forEach(b => {
      if (b._stuck) {
        b.x = Phaser.Math.Clamp(this.paddle.x + b._stickOffset, 12, 788);
        b.y = this.paddle.y - 22;
        b.body.setVelocity(0, 0);
      }
    });
  }
}
