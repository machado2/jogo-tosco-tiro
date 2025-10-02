// Procedural audio generation using Web Audio API
class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.initialized = false;
    }

    _rand(min, max) { return Math.random() * (max - min) + min; }

    init() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.audioContext.createGain();
                this.masterGain.gain.value = 0.3;
                this.masterGain.connect(this.audioContext.destination);
            }
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported', e);
        }
    }

    playShoot() {
        if (!this.initialized) return;
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'square';
        const startF = this._rand(280, 340);
        osc.frequency.setValueAtTime(startF, now);
        osc.frequency.exponentialRampToValueAtTime(this._rand(90, 120), now + 0.1);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playLaser() {
        if (!this.initialized) return;
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sawtooth';
        const startF = this._rand(550, 700);
        osc.frequency.setValueAtTime(startF, now);
        osc.frequency.exponentialRampToValueAtTime(this._rand(180, 240), now + 0.15);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playExplosion() {
        if (!this.initialized) return;
        
        const now = this.audioContext.currentTime;
        
        // White noise for explosion
        const bufferSize = this.audioContext.sampleRate * 0.3;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        noise.start(now);
        noise.stop(now + 0.3);
    }

    playExplosionBig() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        const bufferSize = this.audioContext.sampleRate * 0.6;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.6);
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        noise.start(now); noise.stop(now + 0.6);
    }

    playHit() {
        if (!this.initialized) return;
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'triangle';
        const base = this._rand(130, 180);
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(this._rand(45, 65), now + 0.08);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playImpact() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.type = 'square';
        const f = this._rand(350, 500);
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(this._rand(180, 250), now + 0.04);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(now); osc.stop(now + 0.05);
    }

    playPowerup() {
        if (!this.initialized) return;
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.2);
    }

    playSpecial() {
        if (!this.initialized) return;
        
        const now = this.audioContext.currentTime;
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc1.type = 'sine';
        osc2.type = 'square';
        
        osc1.frequency.setValueAtTime(200, now);
        osc1.frequency.exponentialRampToValueAtTime(600, now + 0.25);
        
        osc2.frequency.setValueAtTime(400, now);
        osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
    }
}

const audioSystem = new AudioSystem();
