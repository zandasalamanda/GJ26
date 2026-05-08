// ============================================
// FLAT-EARTHRZ — Interactive Tutorial
// ============================================

import { GAME_W, GAME_H, MAT_NAMES } from './utils.js';

const STEPS = [
    { id:'intro1', type:'story', text:['Long ago, the flat worlds drifted peacefully through the cosmic void...'], duration:3500 },
    { id:'intro2', type:'story', text:['Until a rogue asteroid field tore through the galaxy, scattering debris everywhere.'], duration:3500 },
    { id:'intro3', type:'story', text:['Two species crash-landed on opposite sides of a cluster of flat islands.'], duration:3500 },
    { id:'intro4', type:'story', text:['Between them lies a shared center island. Build civilization there to survive.'], duration:3500 },
    { id:'intro5', type:'story', text:['5 METEOR SHOWERS approach. The final one will destroy your home worlds forever.'], duration:4000 },
    { id:'move', type:'action', text:['Use WASD (P1) or Arrows (P2) to move around!'], hint:'Move in any direction', check:(g) => g.p1Moved },
    { id:'harvest', type:'action', text:['Walk near a glowing node and press E to harvest!'], hint:'Press E near a resource', check:(g) => g.p1Harvested },
    { id:'toss', type:'action', text:['Press Q to toss materials toward the hub island!'], hint:'Press Q with an item', check:(g) => g.p1Tossed },
    { id:'craft', type:'action', text:['Go to the Crafter on the hub and press F to build!'], hint:'Press F at the Crafter', check:(g) => g.p1Crafted },
    { id:'done', type:'story', text:['You\'re ready! Build defenses and sustainability. Work together. Good luck!'], duration:3000 },
];

// Tiny AudioContext beep for typewriter
let _talkCtx = null;
function playTalkBeep() {
    try {
        if (!_talkCtx) _talkCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = _talkCtx.createOscillator();
        const gain = _talkCtx.createGain();
        osc.connect(gain);
        gain.connect(_talkCtx.destination);
        // Randomize pitch slightly for character
        osc.frequency.value = 280 + Math.random() * 180;
        osc.type = 'square';
        gain.gain.value = 0.04;
        osc.start();
        osc.stop(_talkCtx.currentTime + 0.04);
    } catch(e) {}
}

export class Tutorial {
    constructor() {
        this.active = false;
        this.stepIndex = 0;
        this.stepTimer = 0;
        this.skipped = false;
        this.skipConfirm = false;
        this.charsRevealed = 0;
        this.charTimer = 0;

        this.p1Moved = false;
        this.p1Harvested = false;
        this.p1Tossed = false;
        this.p1Crafted = false;
    }

    start() {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('flatEarthrz_tutorialDone')) {
            this.active = false;
            this.skipped = true;
            return false;
        }
        this.active = true;
        this.stepIndex = 0;
        this.stepTimer = 0;
        this.charsRevealed = 0;
        this.charTimer = 0;
        this.p1Moved = false;
        this.p1Harvested = false;
        this.p1Tossed = false;
        this.p1Crafted = false;
        this.skipConfirm = false;
        return true;
    }

    get currentStep() {
        if (this.stepIndex >= STEPS.length) return null;
        return STEPS[this.stepIndex];
    }

    get isComplete() {
        return this.stepIndex >= STEPS.length || this.skipped;
    }

    _fullText() {
        const step = this.currentStep;
        return step ? step.text.join(' ') : '';
    }

    update(dt, input) {
        if (!this.active) return;
        const step = this.currentStep;
        if (!step) { this.finish(); return; }

        if (input.isJustPressed('Escape')) {
            if (this.skipConfirm) { this.skip(); return; }
            this.skipConfirm = true;
            return;
        }
        if (this.skipConfirm && input.anyKeyPressed() && !input.isJustPressed('Escape')) {
            this.skipConfirm = false;
        }

        // Typewriter — reveal chars
        const full = this._fullText();
        if (this.charsRevealed < full.length) {
            this.charTimer += dt;
            const speed = 28; // ms per character
            while (this.charTimer >= speed && this.charsRevealed < full.length) {
                this.charTimer -= speed;
                this.charsRevealed++;
                if (full[this.charsRevealed - 1] !== ' ') playTalkBeep();
            }
        }

        if (step.type === 'story') {
            this.stepTimer += dt;
            // Space/Enter to skip or advance
            if (input.isJustPressed('Space') || input.isJustPressed('Enter')) {
                if (this.charsRevealed < full.length) {
                    this.charsRevealed = full.length; // instant reveal
                } else {
                    this.advance();
                }
            }
            if (this.stepTimer >= step.duration && this.charsRevealed >= full.length) {
                this.advance();
            }
        } else if (step.type === 'action') {
            if (step.check(this)) {
                this.stepTimer += dt;
                if (this.stepTimer > 600) this.advance();
            }
        }
    }

    advance() {
        this.stepIndex++;
        this.stepTimer = 0;
        this.charsRevealed = 0;
        this.charTimer = 0;
        this.skipConfirm = false;
        if (this.stepIndex >= STEPS.length) this.finish();
    }

    skip() { this.skipped = true; this.active = false; this.markDone(); }
    finish() { this.active = false; this.markDone(); }
    markDone() { try { localStorage.setItem('flatEarthrz_tutorialDone', '1'); } catch(e) {} }

    // ---- Rendering — compact bottom bar ----
    draw(ctx, time) {
        if (!this.active) return;
        const step = this.currentStep;
        if (!step) return;

        // NO full-screen dim — just the bottom bar
        const panelH = 70;
        const panelY = GAME_H - panelH - 8;
        const panelX = 60;
        const panelW = GAME_W - 120;

        // Panel background
        ctx.fillStyle = 'rgba(5,8,20,0.88)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        const borderColor = step.type === 'story' ? '#00FFAA' : '#FFDD44';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // Step indicator (left)
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#555';
        ctx.fillText(`${this.stepIndex + 1}/${STEPS.length}`, panelX + 10, panelY + 14);

        // Type label (right)
        ctx.textAlign = 'right';
        ctx.fillStyle = step.type === 'story' ? '#00FFAA55' : '#FFDD4455';
        ctx.fillText(step.type === 'story' ? 'STORY' : 'TRY IT', panelX + panelW - 10, panelY + 14);

        // Typewriter text
        const full = this._fullText();
        const revealed = full.substring(0, this.charsRevealed);
        ctx.textAlign = 'center';
        ctx.font = '9px "Press Start 2P"';
        ctx.fillStyle = step.type === 'story' ? '#CCDDEE' : '#FFEEDD';
        // Word-wrap at ~60 chars
        const maxW = panelW - 40;
        const words = revealed.split(' ');
        let lines = [''];
        for (const w of words) {
            const test = lines[lines.length - 1] + (lines[lines.length - 1] ? ' ' : '') + w;
            if (ctx.measureText(test).width > maxW) lines.push(w);
            else lines[lines.length - 1] = test;
        }
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], GAME_W / 2, panelY + 32 + i * 16);
        }

        // Blinking cursor at end of text
        if (this.charsRevealed < full.length && Math.sin(time * 0.01) > 0) {
            const lastLine = lines[lines.length - 1] || '';
            const lw = ctx.measureText(lastLine).width;
            const curX = GAME_W / 2 + lw / 2 + 4;
            const curY = panelY + 28 + (lines.length - 1) * 16;
            ctx.fillStyle = borderColor;
            ctx.fillRect(curX, curY, 8, 10);
        }

        // Action hint
        if (step.type === 'action' && step.hint && this.charsRevealed >= full.length) {
            const pulse = 0.5 + Math.sin(time * 0.006) * 0.5;
            ctx.font = '8px "Press Start 2P"';
            ctx.fillStyle = `rgba(255,221,68,${pulse})`;
            ctx.textAlign = 'center';
            ctx.fillText(`▶ ${step.hint}`, GAME_W / 2, panelY + panelH - 8);
        }

        // Story progress bar
        if (step.type === 'story') {
            const progress = Math.min(1, this.stepTimer / step.duration);
            ctx.fillStyle = '#00FFAA22';
            ctx.fillRect(panelX + 2, panelY + panelH - 3, (panelW - 4) * progress, 2);
        }

        // Skip confirm
        if (this.skipConfirm) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(GAME_W / 2 - 180, panelY - 40, 360, 32);
            ctx.strokeStyle = '#FF4444';
            ctx.lineWidth = 1;
            ctx.strokeRect(GAME_W / 2 - 180, panelY - 40, 360, 32);
            ctx.font = '8px "Press Start 2P"';
            ctx.fillStyle = '#FF6644';
            ctx.textAlign = 'center';
            ctx.fillText('Press ESC again to skip tutorial', GAME_W / 2, panelY - 20);
        }

        // ESC hint (top-right corner, tiny)
        if (!this.skipConfirm) {
            ctx.font = '6px "Press Start 2P"';
            ctx.fillStyle = '#333';
            ctx.textAlign = 'right';
            ctx.fillText('ESC to skip', GAME_W - 12, 14);
        }
    }
}
