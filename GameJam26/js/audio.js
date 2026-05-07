// ============================================
// ALIEN ASSEMBLY LINE — Audio Manager
// ============================================

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.musicVolume = 0.3;
        this.sfxVolume = 0.5;
        this.muted = false;
        this.initialized = false;
        this.currentMusic = null;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = this.musicVolume;
            this.musicGain.connect(this.ctx.destination);
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available:', e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
        if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
    }

    // ---- Procedural SFX ----

    _playTone(freq, duration, type = 'square', volume = 0.3, detune = 0) {
        if (!this.initialized || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        gain.gain.value = volume * this.sfxVolume;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    }

    _playNoise(duration, volume = 0.2) {
        if (!this.initialized || this.muted) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = volume * this.sfxVolume;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 1;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        source.start();
    }

    playChop() {
        this._playNoise(0.1, 0.3);
        this._playTone(200, 0.08, 'square', 0.2);
    }

    playMine() {
        this._playTone(300, 0.05, 'sawtooth', 0.2);
        this._playNoise(0.08, 0.25);
        this._playTone(250, 0.06, 'square', 0.15, 50);
    }

    playPickup() {
        this._playTone(600, 0.08, 'sine', 0.25);
        this._playTone(900, 0.1, 'sine', 0.2);
    }

    playToss() {
        this._playTone(300, 0.15, 'sine', 0.2);
        setTimeout(() => this._playTone(500, 0.1, 'sine', 0.15), 50);
    }

    playLand() {
        this._playTone(150, 0.15, 'sine', 0.2);
        this._playNoise(0.1, 0.15);
    }

    playLeap() {
        if (!this.initialized) return;
        // Rising whoosh sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.4 * this.sfxVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.35);
        // Spring boing
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.08);
        osc2.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.18);
        gain2.gain.setValueAtTime(0.35 * this.sfxVolume, this.ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.start(this.ctx.currentTime);
        osc2.stop(this.ctx.currentTime + 0.25);
    }

    playCraft() {
        const now = this.ctx ? this.ctx.currentTime : 0;
        this._playTone(440, 0.1, 'square', 0.2);
        setTimeout(() => this._playTone(554, 0.1, 'square', 0.2), 100);
        setTimeout(() => this._playTone(659, 0.15, 'square', 0.25), 200);
    }

    playDeliver() {
        this._playTone(523, 0.1, 'sine', 0.3);
        setTimeout(() => this._playTone(659, 0.1, 'sine', 0.3), 100);
        setTimeout(() => this._playTone(784, 0.1, 'sine', 0.3), 200);
        setTimeout(() => this._playTone(1047, 0.2, 'sine', 0.35), 300);
    }

    playOrderComplete() {
        const notes = [523, 659, 784, 1047, 1319];
        notes.forEach((n, i) => {
            setTimeout(() => this._playTone(n, 0.15, 'sine', 0.3), i * 80);
        });
    }

    playOrderFail() {
        this._playTone(300, 0.2, 'sawtooth', 0.3);
        setTimeout(() => this._playTone(200, 0.3, 'sawtooth', 0.25), 150);
    }

    playTimerWarning() {
        this._playTone(880, 0.08, 'square', 0.2);
    }

    playPowerup() {
        const notes = [440, 554, 659, 880];
        notes.forEach((n, i) => {
            setTimeout(() => this._playTone(n, 0.12, 'sine', 0.25), i * 60);
        });
    }

    playUIClick() {
        this._playTone(800, 0.05, 'square', 0.15);
    }

    playStarAwarded() {
        this._playTone(1047, 0.2, 'sine', 0.3);
        this._playTone(1319, 0.3, 'sine', 0.25);
    }

    playCombo() {
        this._playTone(660, 0.06, 'sine', 0.2);
        setTimeout(() => this._playTone(880, 0.06, 'sine', 0.2), 50);
        setTimeout(() => this._playTone(1100, 0.1, 'sine', 0.25), 100);
    }

    playError() {
        this._playTone(200, 0.15, 'square', 0.2);
    }

    playDeny() {
        if (!this.initialized) return;
        // Descending buzz: high → low, harsh feel
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.35 * this.sfxVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.3);
        // Short accent blip up front
        this._playTone(400, 0.06, 'square', 0.2);
    }

    playHazardWarning() {
        this._playTone(200, 0.3, 'sawtooth', 0.3);
        setTimeout(() => this._playTone(200, 0.3, 'sawtooth', 0.3), 400);
    }

    // ---- Background Music ----
    startMusic() {
        if (!this.initialized) return;
        this.stopMusic();

        const bpm = 110;
        const beatLen = 60 / bpm;
        
        // Simple looping melody
        const melody = [
            // bar 1
            { note: 330, time: 0, dur: 0.2 },
            { note: 392, time: beatLen, dur: 0.2 },
            { note: 440, time: beatLen * 2, dur: 0.2 },
            { note: 392, time: beatLen * 3, dur: 0.2 },
            // bar 2
            { note: 523, time: beatLen * 4, dur: 0.3 },
            { note: 440, time: beatLen * 5, dur: 0.2 },
            { note: 392, time: beatLen * 6, dur: 0.2 },
            { note: 330, time: beatLen * 7, dur: 0.3 },
            // bar 3
            { note: 294, time: beatLen * 8, dur: 0.2 },
            { note: 330, time: beatLen * 9, dur: 0.2 },
            { note: 392, time: beatLen * 10, dur: 0.2 },
            { note: 440, time: beatLen * 11, dur: 0.3 },
            // bar 4
            { note: 523, time: beatLen * 12, dur: 0.2 },
            { note: 494, time: beatLen * 13, dur: 0.2 },
            { note: 440, time: beatLen * 14, dur: 0.2 },
            { note: 392, time: beatLen * 15, dur: 0.4 },
        ];

        const bass = [
            { note: 165, time: 0, dur: 0.3 },
            { note: 165, time: beatLen * 2, dur: 0.3 },
            { note: 131, time: beatLen * 4, dur: 0.3 },
            { note: 131, time: beatLen * 6, dur: 0.3 },
            { note: 147, time: beatLen * 8, dur: 0.3 },
            { note: 147, time: beatLen * 10, dur: 0.3 },
            { note: 165, time: beatLen * 12, dur: 0.3 },
            { note: 165, time: beatLen * 14, dur: 0.3 },
        ];

        const loopLength = beatLen * 16;
        
        const playLoop = () => {
            if (!this.initialized || this.muted) return;
            const now = this.ctx.currentTime;
            
            melody.forEach(n => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = n.note;
                gain.gain.value = 0.08;
                gain.gain.setValueAtTime(0.08, now + n.time);
                gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);
                osc.connect(gain);
                gain.connect(this.musicGain);
                osc.start(now + n.time);
                osc.stop(now + n.time + n.dur + 0.05);
            });

            bass.forEach(n => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = n.note;
                gain.gain.value = 0.12;
                gain.gain.setValueAtTime(0.12, now + n.time);
                gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);
                osc.connect(gain);
                gain.connect(this.musicGain);
                osc.start(now + n.time);
                osc.stop(now + n.time + n.dur + 0.05);
            });

            this.currentMusic = setTimeout(playLoop, loopLength * 1000);
        };

        playLoop();
    }

    stopMusic() {
        if (this.currentMusic) {
            clearTimeout(this.currentMusic);
            this.currentMusic = null;
        }
    }
}
