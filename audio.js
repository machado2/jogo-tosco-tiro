// Simple audio system using Web Audio API
class AudioSystem {
  constructor() {
    this.initialized = false;
    this.muted = false;
    this.ctx = null;
    this.master = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.initialized = true;
      // Ensure context is running
      if (this.ctx.state === 'suspended') { this.ctx.resume(); }
    } catch (e) { console.warn('Audio init failed', e); }
  }

  setMuted(m) {
    this.muted = !!m;
    if (!this.ctx || !this.master) return;
    try {
      const now = this.ctx.currentTime;
      // Cancel any scheduled changes to avoid lingering sound
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.setTargetAtTime(this.muted ? 0.0 : 0.9, now, 0.01);
      if (this.muted && this.ctx.state === 'running') {
        // Give a brief moment for gain to reach 0, then suspend
        setTimeout(() => { try { this.ctx.suspend(); } catch {} }, 30);
      } else if (!this.muted && this.ctx.state !== 'running') {
        this.ctx.resume();
      }
    } catch (e) { console.warn('Audio mute toggle failed', e); }
  }

  // Utility to create and play a short noise or oscillator
  _playOsc(freq = 440, dur = 0.1, vol = 0.2, opts = {}) {
    if (!this.initialized || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const useFilter = opts.filterFreq || opts.filterQ;
    const filter = useFilter ? this.ctx.createBiquadFilter() : null;

    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Optional pitch glide
    if (opts.glideToFreq && opts.glideTime !== undefined) {
      osc.frequency.linearRampToValueAtTime(opts.glideToFreq, now + Math.max(0, opts.glideTime));
    } else if (opts.glideToFreq) {
      osc.frequency.linearRampToValueAtTime(opts.glideToFreq, now + Math.min(dur, 0.06));
    }

    // Envelope: attack + release
    const attack = Math.max(0, opts.attack || 0);
    const release = Math.max(0, opts.release || dur);
    gain.gain.setValueAtTime(0, now);
    if (attack > 0) {
      gain.gain.linearRampToValueAtTime(vol, now + attack);
    } else {
      gain.gain.setValueAtTime(vol, now);
    }
    // Release back to 0
    gain.gain.linearRampToValueAtTime(0.0001, now + release);

    if (filter) {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(opts.filterFreq || 1500, now);
      filter.Q.setValueAtTime(opts.filterQ || 0.7, now);
      osc.connect(filter); filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this.master);

    osc.start(now);
    osc.stop(now + release);
  }

  playHit() { this._playOsc(220, 0.08, 0.15); }
  playImpact() { this._playOsc(120, 0.12, 0.2); }
  playExplosionSmall() { this._playOsc(80, 0.25, 0.25); }
  playExplosionBig() { this._playOsc(60, 0.5, 0.35); }
  playPowerup() { this._playOsc(880, 0.15, 0.2); }
  playLaser() { this._playOsc(1200, 0.06, 0.12); }
  playSpecial() { this._playOsc(500, 0.2, 0.2); }
  playShoot() { this._playOsc(420, 0.12, 0.16, { type: 'triangle', attack: 0.01, release: 0.12, glideToFreq: 300, glideTime: 0.06, filterFreq: 1200, filterQ: 0.7 }); }
  playExplosion() { this.playExplosionSmall(); }
}

// Global instance
const audioSystem = new AudioSystem();
// Attach to window for other scripts
window.audioSystem = audioSystem;

function playGameSound(name) {
  try { audioSystem.init(); } catch {}
  if (!audioSystem.initialized || audioSystem.muted) return;
  switch (name) {
    case 'hit': audioSystem.playHit(); break;
    case 'impact': audioSystem.playImpact(); break;
    case 'explosion_small': audioSystem.playExplosionSmall(); break;
    case 'explosion_big': audioSystem.playExplosionBig(); break;
    case 'powerup': audioSystem.playPowerup(); break;
    case 'laser': audioSystem.playLaser(); break;
    case 'special': audioSystem.playSpecial(); break;
    case 'shoot': audioSystem.playShoot(); break;
    case 'explosion': audioSystem.playExplosion(); break;
    default: break;
  }
}
window.playGameSound = playGameSound;
