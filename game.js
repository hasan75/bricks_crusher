// ============================================================
//  Breakout — Step 8: win & lose conditions + restart
//  Goal: "YOU WIN!" when all bricks are gone, "GAME OVER" if the
//  ball falls out the bottom; press SPACE to play again.
// ============================================================

// 1) CONFIG — describes the game to Phaser.
const config = {
  type: Phaser.AUTO,        // let Phaser pick WebGL, fall back to Canvas
  width: 800,               // game width in pixels
  height: 600,              // game height in pixels
  backgroundColor: "#2d2d4d", // a calm dark-blue so we can see the canvas

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

// ---- The three lifecycle functions ----

function preload() {
  // Later: this is where we load art and audio.
}

function create() {
  // --- The paddle ---
  // A rectangle 100 wide, 20 tall. We place it near the bottom-center.
  // x = 400 (middle of an 800-wide screen), y = 550 (near the bottom).
  // 0x... is a hex color, like CSS #ffffff but with 0x instead of #.
  this.paddle = this.add.rectangle(400, 550, 100, 20, 0xffffff);

  // Give the paddle a physics body too, so the ball can collide with it.
  this.physics.add.existing(this.paddle);
  this.paddle.body.setImmovable(true);     // the ball can't push it around
  this.paddle.body.setAllowGravity(false); // (gravity is already 0, but explicit)

  // --- The ball ---
  // A circle of radius 10, sitting just above the paddle.
  this.ball = this.add.circle(400, 520, 10, 0xff4444);

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
  // bounce them apart when they touch. Since the paddle is immovable
  // and the ball has bounce = 1, the ball ricochets off cleanly.
  this.physics.add.collider(this.ball, this.paddle);

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

  // One color per row, so the wall looks like classic Breakout.
  const rowColors = [0xff5555, 0xffaa33, 0xffee33, 0x55dd55, 0x55aaff];

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
    fontSize: "20px", color: "#ffffff"
  });

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
    fontSize: "32px", color: "#ffffff", align: "center"
  }).setOrigin(0.5);                     // center the text on that point

  // .once = fire this handler a single time, then forget it. restart()
  // rebuilds the Scene from scratch (create() runs again → fresh board).
  scene.input.keyboard.once("keydown-SPACE", () => scene.scene.restart());
}

// Called on each ball–brick collision. Phaser passes the two objects
// that collided, in the same order we listed them in the collider:
// (ball, brick). Because Step 6 passed `this` as the collider context,
// `this` inside here is the Scene — so this.score / this.scoreText work.
function hitBrick(ball, brick) {
  brick.destroy();   // remove the brick from the scene AND its group
  this.score += 10;  // reward: 10 points per brick
  this.scoreText.setText("Score: " + this.score); // redraw the label
}

function update() {
  // This runs ~60 times per second. Each call, we decide where the
  // paddle should be and nudge it there.

  // Once the game has ended, stop running the loop's logic. Otherwise
  // we'd keep moving the paddle and re-triggering end conditions.
  if (this.gameOver) {
    return;
  }

  // --- Lose: the ball fell out the (now open) bottom ---
  if (this.ball.y > 600) {
    endGame(this, "GAME OVER");
    return;
  }

  // --- Win: every brick is gone ---
  // countActive() counts the still-alive members of the static group.
  if (this.bricks.countActive() === 0) {
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
