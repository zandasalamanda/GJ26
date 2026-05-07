// ============================================
// ALIEN ASSEMBLY LINE — World Map
// ============================================

import { MAP_COLS, MAP_ROWS, TILE_W, TILE_H, ISLANDS, BRIDGES, dist, isoToScreen } from './utils.js';

// Tile types
export const T = { VOID: 0, BLUE: 1, RED: 2, HUB: 3, BRIDGE: 4 };

export class World {
    constructor(sprites) {
        this.sprites = sprites;
        this.tiles = [];
        this.tileVariants = [];
        this._generate();
    }

    _generate() {
        // Initialize all as void
        this.tiles = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(T.VOID));
        this.tileVariants = Array.from({ length: MAP_ROWS }, () =>
            Array.from({ length: MAP_COLS }, () => Math.floor(Math.random() * 4))
        );

        // Carve islands as rough circles with noise
        this._carveIsland(ISLANDS.blue.cx, ISLANDS.blue.cy, ISLANDS.blue.radius, T.BLUE);
        this._carveIsland(ISLANDS.red.cx, ISLANDS.red.cy, ISLANDS.red.radius, T.RED);
        this._carveIsland(ISLANDS.hub.cx, ISLANDS.hub.cy, ISLANDS.hub.radius, T.HUB);

        // Enforce void gaps — remove any hub tile adjacent to blue/red, and vice versa
        // This guarantees islands are disconnected regardless of noise shape
        const toVoid = [];
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                const t = this.tiles[r][c];
                if (t === T.VOID) continue;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr, nc = c + dc;
                        if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
                        const nt = this.tiles[nr][nc];
                        // If a hub tile neighbors a blue tile, void the hub tile
                        if (t === T.HUB && nt === T.BLUE) toVoid.push([r, c]);
                        if (t === T.HUB && nt === T.RED)  toVoid.push([r, c]);
                        // Also void blue/red tiles that touch the other outer island
                        if (t === T.BLUE && nt === T.RED) toVoid.push([r, c]);
                    }
                }
            }
        }
        for (const [r, c] of toVoid) this.tiles[r][c] = T.VOID;
    }

    _carveIsland(cx, cy, radius, type) {
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                const d = dist(c, r, cx, cy);
                // Add noise for organic shape
                const noise = Math.sin(c * 1.7) * 0.8 + Math.cos(r * 2.3) * 0.6;
                if (d < radius + noise) {
                    this.tiles[r][c] = type;
                }
            }
        }
    }

    getTile(col, row) {
        if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return T.VOID;
        return this.tiles[row][col];
    }

    isWalkable(col, row) {
        return this.getTile(col, row) !== T.VOID;
    }

    // Check if a tile position is within a specific island
    isOnIsland(col, row, islandType) {
        const t = this.getTile(col, row);
        if (islandType === 'blue') return t === T.BLUE || t === T.HUB || t === T.BRIDGE;
        if (islandType === 'red') return t === T.RED || t === T.HUB || t === T.BRIDGE;
        return t !== T.VOID;
    }

    // Check collision for a player at world position (tile coords, floating point)
    canMoveTo(wx, wy, playerIsland) {
        const col = Math.floor(wx);
        const row = Math.floor(wy);
        // Check the 4 surrounding tiles
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                // Just need to check the actual tile under the player
            }
        }
        const t = this.getTile(col, row);
        if (t === T.VOID) return false;
        if (playerIsland === 'blue' && t === T.RED) return false;
        if (playerIsland === 'red' && t === T.BLUE) return false;
        return true;
    }

    draw(ctx, camera) {
        const tw = camera.scaledTileW;
        const th = camera.scaledTileH;
        // Draw tiles back-to-front (painter's algorithm)
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                const t = this.tiles[r][c];
                if (t === T.VOID) continue;

                const screen = camera.worldToScreen(c, r);
                if (!camera.isOnScreen(screen.x, screen.y, tw)) continue;

                let spriteKey;
                const v = this.tileVariants[r][c];
                switch (t) {
                    case T.BLUE: spriteKey = `tile_blue_${v}`; break;
                    case T.RED: spriteKey = `tile_red_${v}`; break;
                    case T.HUB: spriteKey = `tile_hub_${v}`; break;
                    case T.BRIDGE: spriteKey = `tile_bridge_${v % 2}`; break;
                }

                const sprite = this.sprites.get(spriteKey);
                if (sprite) {
                    ctx.drawImage(sprite,
                        screen.x - tw / 2,
                        screen.y - th / 2,
                        tw,
                        th + Math.ceil(8 * camera.zoom)
                    );
                }
            }
        }
    }

    // Find valid spawn positions on an island
    getSpawnPositions(islandType, count) {
        const type = islandType === 'blue' ? T.BLUE : islandType === 'red' ? T.RED : T.HUB;
        const positions = [];
        for (let r = 1; r < MAP_ROWS - 1; r++) {
            for (let c = 1; c < MAP_COLS - 1; c++) {
                if (this.tiles[r][c] !== type) continue;
                // Only spawn on interior tiles — all 8 neighbors must be non-void
                let interior = true;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (this.tiles[r + dr][c + dc] === T.VOID) { interior = false; break; }
                    }
                    if (!interior) break;
                }
                if (interior) positions.push({ x: c + 0.5, y: r + 0.5 });
            }
        }
        // Shuffle and return requested count
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        return positions.slice(0, count);
    }

    // Get center of an island in tile coords
    getIslandCenter(name) {
        const island = ISLANDS[name];
        return { x: island.cx, y: island.cy };
    }
}
