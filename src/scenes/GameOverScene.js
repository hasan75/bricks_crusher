// scenes/GameOverScene.js — shown after a win or loss.
// Receives the result via init(data) and offers replay (SPACE) or title (T).
// `Phaser` is a global from the CDN <script> in index.html.

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  // Scenes started with a data object receive it here, before create().
  init(data) {
    this.won = data.won;
    this.finalScore = data.score;
    this.best = data.best;
    this.isNewBest = data.isNewBest;
  }

  create() {
    this.add.text(400, 210, this.won ? "YOU WIN!" : "GAME OVER", {
      fontSize: "56px", fontStyle: "bold",
      color: this.won ? "#34d399" : "#f87171"   // green win / soft red loss
    }).setOrigin(0.5);

    this.add.text(400, 300, "Score: " + this.finalScore, {
      fontSize: "28px", color: "#e2e8f0"
    }).setOrigin(0.5);

    // Highlight a fresh record; otherwise just show the standing best.
    if (this.isNewBest) {
      this.add.text(400, 345, "NEW BEST!", {
        fontSize: "24px", color: "#fbbf24", fontStyle: "bold"
      }).setOrigin(0.5);
    } else {
      this.add.text(400, 345, "Best: " + this.best, {
        fontSize: "22px", color: "#94a3b8"
      }).setOrigin(0.5);
    }

    const prompt = this.add.text(400, 430, "Press SPACE to play again", {
      fontSize: "24px", color: "#f8fafc"
    }).setOrigin(0.5);
    this.tweens.add({
      targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1
    });

    this.add.text(400, 470, "Press T for the title screen", {
      fontSize: "18px", color: "#94a3b8"
    }).setOrigin(0.5);

    this.input.keyboard.once("keydown-SPACE", () => this.scene.start("Breakout"));
    this.input.keyboard.once("keydown-T", () => this.scene.start("Title"));
  }
}
