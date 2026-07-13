// scenes/PauseScene.js — an overlay launched ON TOP of a paused BreakoutScene
// (via scene.launch, so both exist at once). Because Breakout is paused, its
// physics, tweens, and timers all freeze; this scene stays live to catch the
// resume/quit keys. `Phaser` is a global from the CDN <script> in index.html.

export class PauseScene extends Phaser.Scene {
  constructor() {
    super("Pause");
  }

  create() {
    // Dim the frozen gameplay behind us so the overlay reads clearly.
    this.add.rectangle(0, 0, 800, 600, 0x0f172a, 0.72).setOrigin(0);

    this.add.text(400, 250, "PAUSED", {
      fontSize: "52px", color: "#f8fafc", fontStyle: "bold"
    }).setOrigin(0.5);

    this.add.text(400, 330, "Press ESC to resume", {
      fontSize: "22px", color: "#e2e8f0"
    }).setOrigin(0.5);

    this.add.text(400, 372, "Press T for the title screen", {
      fontSize: "16px", color: "#94a3b8"
    }).setOrigin(0.5);

    this.input.keyboard.once("keydown-ESC", () => {
      this.scene.stop();               // close this overlay...
      this.scene.resume("Breakout");   // ...and un-freeze the game
    });

    this.input.keyboard.once("keydown-T", () => {
      this.scene.stop("Breakout");     // fully end the paused game
      this.scene.start("Title");       // start() also stops this Pause scene
    });
  }
}
