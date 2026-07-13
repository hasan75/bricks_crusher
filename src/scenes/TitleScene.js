// scenes/TitleScene.js — the first screen: name, controls, best score.
// `Phaser` is a global from the CDN <script> in index.html.
import { getHighScore } from "../storage.js";
import { ensureTextures } from "../textures.js";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create() {
    ensureTextures(this);   // so the decorative row uses the real brick sprite

    // A row of brick sprites as a simple decorative "wall" under the title.
    const palette = [0xa78bfa, 0x818cf8, 0x60a5fa, 0x38bdf8, 0x22d3ee];
    palette.forEach((color, i) => {
      this.add.image(280 + i * 60, 150, "brick").setTint(color).setDisplaySize(52, 22);
    });

    this.add.text(400, 240, "BREAKOUT", {
      fontSize: "64px", color: "#fbbf24", fontStyle: "bold"
    }).setOrigin(0.5);

    this.add.text(400, 320,
      "Move: mouse or ← →     Break every brick across 3 levels\n" +
      "Power-ups: Wide · Multi · Slow · Life · Sticky · Laser\n" +
      "Space: launch a stuck ball / fire the laser", {
      fontSize: "18px", color: "#e2e8f0", align: "center", lineSpacing: 8
    }).setOrigin(0.5);

    this.add.text(400, 400, "Best: " + getHighScore(), {
      fontSize: "20px", color: "#94a3b8"
    }).setOrigin(0.5);

    // A gently pulsing prompt so it reads as "interactive".
    const prompt = this.add.text(400, 470, "Press SPACE to start", {
      fontSize: "26px", color: "#f8fafc"
    }).setOrigin(0.5);
    this.tweens.add({
      targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1
    });

    this.input.keyboard.once("keydown-SPACE", () => this.scene.start("Breakout"));
  }
}
