// ============================================
// FLAT-EARTHRZ — World Map
// ============================================

import { MAP_COLS, MAP_ROWS, TILE_W, TILE_H, ISLANDS, BRIDGES, dist, isoToScreen } from './utils.js';

// Tile types
export const T = { VOID: 0, BLUE: 1, RED: 2, HUB: 3, BRIDGE: 4 };

export class World {
    constructor(sprites) {
        this.sprites = sprites;
        this.tiles = [];
        this.tileVariants = [];
        this.structures = {}; // key: "col,row" → structure name
        this._generate();
    }

    _generate() {
        this.tiles = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(T.VOID));
        this.tileVariants = Array.from({ length: MAP_ROWS }, () =>
            Array.from({ length: MAP_COLS }, () => Math.floor(Math.random() * 4))
        );

        this._carveIsland(ISLANDS.blue.cx, ISLANDS.blue.cy, ISLANDS.blue.radius, T.BLUE);
        this._carveIsland(ISLANDS.red.cx, ISLANDS.red.cy, ISLANDS.red.radius, T.RED);
        this._carveIsland(ISLANDS.hub.cx, ISLANDS.hub.cy, ISLANDS.hub.radius, T.HUB);

        // Enforce void gaps
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
                        if (t === T.HUB && nt === T.BLUE) toVoid.push([r, c]);
                        if (t === T.HUB && nt === T.RED)  toVoid.push([r, c]);
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

    isOnIsland(col, row, islandType) {
        const t = this.getTile(col, row);
        if (islandType === 'blue') return t === T.BLUE || t === T.HUB || t === T.BRIDGE;
        if (islandType === 'red') return t === T.RED || t === T.HUB || t === T.BRIDGE;
        return t !== T.VOID;
    }

    canMoveTo(wx, wy, playerIsland) {
        const col = Math.floor(wx);
        const row = Math.floor(wy);
        const t = this.getTile(col, row);
        if (t === T.VOID) return false;
        if (playerIsland === 'blue' && t === T.RED) return false;
        if (playerIsland === 'red' && t === T.BLUE) return false;
        return true;
    }

    // ---- Structure Management ----
    addStructureTile(col, row, structureName) {
        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
            this.tiles[row][col] = T.HUB;
        }
        this.structures[`${col},${row}`] = structureName;
    }

    getStructure(col, row) {
        return this.structures[`${col},${row}`] || null;
    }

    // ---- Erosion ----
    erodeIsland(islandType, amount) {
        const tileType = islandType === 'blue' ? T.BLUE : T.RED;
        const edgeTiles = [];
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (this.tiles[r][c] !== tileType) continue;
                let isEdge = false;
                for (let dr = -1; dr <= 1 && !isEdge; dr++) {
                    for (let dc = -1; dc <= 1 && !isEdge; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr, nc = c + dc;
                        if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) { isEdge = true; break; }
                        if (this.tiles[nr][nc] === T.VOID) isEdge = true;
                    }
                }
                if (isEdge) edgeTiles.push([r, c]);
            }
        }
        for (let i = edgeTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [edgeTiles[i], edgeTiles[j]] = [edgeTiles[j], edgeTiles[i]];
        }
        const toRemove = Math.min(amount, edgeTiles.length);
        for (let i = 0; i < toRemove; i++) {
            this.tiles[edgeTiles[i][0]][edgeTiles[i][1]] = T.VOID;
        }
    }

    destroyIsland(islandType) {
        const tileType = islandType === 'blue' ? T.BLUE : T.RED;
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (this.tiles[r][c] === tileType) {
                    this.tiles[r][c] = T.VOID;
                }
            }
        }
    }

    // ---- Rendering ----
    draw(ctx, camera) {
        const tw = camera.scaledTileW;
        const th = camera.scaledTileH;
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

                // Draw structure overlay
                const struct = this.getStructure(c, r);
                if (struct) {
                    const z = camera.zoom;
                    const sx = screen.x;
                    const sy = screen.y - 16 * z;
                    // Map structure name → sprite key
                    const STRUCT_KEYS = {
                        'Barricade': 'struct_barricade', 'Watch Tower': 'struct_watch_tower',
                        'Stone Wall': 'struct_stone_wall', 'Shield Pylon': 'struct_shield_pylon',
                        'Turret Platform': 'struct_turret', 'Reinforced Dome': 'struct_dome',
                        'Garden Dome': 'struct_garden', 'Water Purifier': 'struct_water',
                        'Solar Array': 'struct_solar', 'Habitat Module': 'struct_habitat',
                        'Comms Beacon': 'struct_beacon', 'Landing Pad': 'struct_landing_pad',
                    };
                    const sprKey = STRUCT_KEYS[struct];
                    const structSprite = sprKey ? this.sprites.get(sprKey) : null;
                    if (structSprite) {
                        const sw = 48 * z;
                        const sh = 56 * z;
                        ctx.drawImage(structSprite, sx - sw / 2, sy - sh / 2, sw, sh);
                    } else {
                        // Fallback colored diamond
                        const isSustain = struct.includes('Garden') || struct.includes('Water') || struct.includes('Solar') || struct.includes('Habitat') || struct.includes('Comms') || struct.includes('Landing');
                        ctx.fillStyle = isSustain ? '#44DD88' : '#FF8844';
                        ctx.globalAlpha = 0.7;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy - 10 * z);
                        ctx.lineTo(sx + 14 * z, sy);
                        ctx.lineTo(sx, sy + 6 * z);
                        ctx.lineTo(sx - 14 * z, sy);
                        ctx.closePath();
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                    // Structure name label
                    ctx.font = `${Math.floor(7 * z)}px "Press Start 2P"`;
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#FFF';
                    ctx.fillText(struct.substring(0, 10), sx, sy + 20 * z);
                }
            }
        }
    }

    // ---- Spawning ----
    getSpawnPositions(islandType, count) {
        const type = islandType === 'blue' ? T.BLUE : islandType === 'red' ? T.RED : T.HUB;
        const positions = [];
        for (let r = 1; r < MAP_ROWS - 1; r++) {
            for (let c = 1; c < MAP_COLS - 1; c++) {
                if (this.tiles[r][c] !== type) continue;
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
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        return positions.slice(0, count);
    }

    getIslandCenter(name) {
        const island = ISLANDS[name];
        return { x: island.cx, y: island.cy };
    }
}
