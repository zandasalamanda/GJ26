// ============================================
// ALIEN ASSEMBLY LINE — Input Handler
// ============================================

export class InputManager {
    constructor() {
        this.keys = {};
        this.justPressed = {};
        this.prevKeys = {};

        this._onKeyDown = (e) => {
            // Prevent default for game keys
            const gameKeys = [
                'KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','KeyF','KeyR','Tab',
                'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
                'Slash','Period','Comma','KeyM',
                'Space','Escape','Enter','ShiftLeft','ShiftRight',
                'Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8',
            ];
            if (gameKeys.includes(e.code)) {
                e.preventDefault();
            }
            this.keys[e.code] = true;
        };

        this._onKeyUp = (e) => {
            this.keys[e.code] = false;
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    update() {
        // Calculate justPressed (pressed this frame but not last frame)
        for (const key in this.keys) {
            this.justPressed[key] = this.keys[key] && !this.prevKeys[key];
        }
        // Copy current state for next frame comparison
        this.prevKeys = { ...this.keys };
    }

    isDown(code) {
        return !!this.keys[code];
    }

    isJustPressed(code) {
        return !!this.justPressed[code];
    }

    // Get movement vector for player 1 (WASD)
    getP1Movement() {
        let dx = 0, dy = 0;
        if (this.isDown('KeyW')) dy -= 1;
        if (this.isDown('KeyS')) dy += 1;
        if (this.isDown('KeyA')) dx -= 1;
        if (this.isDown('KeyD')) dx += 1;
        // Normalize diagonal
        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.SQRT2;
            dx *= inv;
            dy *= inv;
        }
        return { dx, dy };
    }

    // Get movement vector for player 2 (Arrows)
    getP2Movement() {
        let dx = 0, dy = 0;
        if (this.isDown('ArrowUp')) dy -= 1;
        if (this.isDown('ArrowDown')) dy += 1;
        if (this.isDown('ArrowLeft')) dx -= 1;
        if (this.isDown('ArrowRight')) dx += 1;
        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.SQRT2;
            dx *= inv;
            dy *= inv;
        }
        return { dx, dy };
    }

    // Player 1 actions
    p1Interact()  { return this.isJustPressed('KeyE'); }
    p1Toss()      { return this.isJustPressed('KeyQ'); }
    p1Craft()     { return this.isJustPressed('KeyF'); }
    p1Process()   { return this.isJustPressed('KeyR'); }
    p1Drop()      { return this.isJustPressed('Tab'); }
    p1CycleLeft() { return this.isJustPressed('Digit1'); }
    p1CycleRight(){ return this.isJustPressed('Digit2'); }

    // Player 2 actions
    p2Interact()  { return this.isJustPressed('Slash'); }
    p2Toss()      { return this.isJustPressed('Period'); }
    p2Craft()     { return this.isJustPressed('Comma'); }
    p2Process()   { return this.isJustPressed('KeyM'); }
    p2Drop()      { return this.isJustPressed('ShiftRight'); }
    p2CycleLeft() { return this.isJustPressed('Digit7'); }
    p2CycleRight(){ return this.isJustPressed('Digit8'); }

    // Global actions
    pause()       { return this.isJustPressed('Escape'); }
    confirm()     { return this.isJustPressed('Space') || this.isJustPressed('Enter'); }
    anyKeyPressed() { return Object.values(this.justPressed).some(v => v); }

    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }
}
