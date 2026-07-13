// main.js — entry point. Assembles the Phaser game from our scene modules.
// Loaded as <script type="module"> in index.html, AFTER the Phaser CDN script,
// so the `Phaser` global is available to every module.
import { WIDTH, HEIGHT, BG_COLOR } from "./config.js";
import { TitleScene } from "./scenes/TitleScene.js";
import { BreakoutScene } from "./scenes/BreakoutScene.js";
import { GameOverScene } from "./scenes/GameOverScene.js";
import { PauseScene } from "./scenes/PauseScene.js";

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: BG_COLOR,   // deep slate navy — shared by every scene
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  // The first scene in the array starts automatically → the title screen.
  scene: [TitleScene, BreakoutScene, GameOverScene, PauseScene]
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
