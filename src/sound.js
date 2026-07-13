// sound.js — tiny Web Audio sound engine (no audio files to download).
// We SYNTHESIZE short, soft tones instead of loading .mp3/.wav assets.
// Deliberately quiet and brief for accessibility, with fade in/out so they
// never "click", and a mute toggle (press M). Exported as a single object so
// its state (muted / the AudioContext) is shared across every scene.

export const Sound = {
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
