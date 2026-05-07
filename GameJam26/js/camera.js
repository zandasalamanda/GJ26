// ============================================
// ALIEN ASSEMBLY LINE — Camera
// ============================================

import { GAME_W, GAME_H, lerp, clamp, isoToScreen, dist } from './utils.js';

export class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;
        this.zoom = 1;
        this.targetZoom = 1;
        this.smoothing = 0.08;
        this.zoomSmoothing = 0.04;
        this.minZoom = 0.7;
        this.maxZoom = 1.8;
    }

    // Follow the midpoint between two positions (in tile coords)
    // and dynamically adjust zoom based on distance
    followPlayers(p1TileX, p1TileY, p2TileX, p2TileY) {
        const midTileX = (p1TileX + p2TileX) / 2;
        const midTileY = (p1TileY + p2TileY) / 2;
        const screen = isoToScreen(midTileX, midTileY);
        this.targetX = screen.x;
        this.targetY = screen.y;

        // Dynamic zoom: closer players = more zoom
        const playerDist = dist(p1TileX, p1TileY, p2TileX, p2TileY);
        // Map distance to zoom: ~0 dist → maxZoom, ~30 dist → minZoom
        const normalizedDist = clamp(playerDist / 25, 0, 1);
        this.targetZoom = lerp(this.maxZoom, this.minZoom, normalizedDist);
    }

    focusOn(tileX, tileY) {
        const screen = isoToScreen(tileX, tileY);
        this.targetX = screen.x;
        this.targetY = screen.y;
    }

    snapTo(tileX, tileY) {
        const screen = isoToScreen(tileX, tileY);
        this.x = this.targetX = screen.x;
        this.y = this.targetY = screen.y;
    }

    shake(intensity = 4, duration = 200) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeTimer = duration;
    }

    update(dt) {
        // Smooth follow
        this.x = lerp(this.x, this.targetX, this.smoothing);
        this.y = lerp(this.y, this.targetY, this.smoothing);

        // Smooth zoom
        this.zoom = lerp(this.zoom, this.targetZoom, this.zoomSmoothing);

        // Screen shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            const progress = this.shakeTimer / this.shakeDuration;
            const intensity = this.shakeIntensity * progress;
            this.shakeX = (Math.random() * 2 - 1) * intensity;
            this.shakeY = (Math.random() * 2 - 1) * intensity;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }
    }

    // Convert world tile position to screen pixel position (with zoom)
    worldToScreen(tileX, tileY) {
        const iso = isoToScreen(tileX, tileY);
        return {
            x: Math.floor((iso.x - this.x) * this.zoom + GAME_W / 2 + this.shakeX),
            y: Math.floor((iso.y - this.y) * this.zoom + GAME_H / 2 + this.shakeY),
        };
    }

    // Get the current zoom-adjusted tile size for rendering
    get scaledTileW() { return Math.ceil(64 * this.zoom); }
    get scaledTileH() { return Math.ceil(32 * this.zoom); }

    // Check if a screen position is within the viewport
    isOnScreen(screenX, screenY, margin = 100) {
        return screenX > -margin && screenX < GAME_W + margin &&
               screenY > -margin && screenY < GAME_H + margin;
    }
}
