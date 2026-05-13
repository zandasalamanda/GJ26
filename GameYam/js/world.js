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
                // Protect leap zone tiles (within 2 tiles of any leap endpoint)
                if (this._isLeapProtected(c, r)) continue;
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

    _isLeapProtected(col, row) {
        // Import-free check: protect tiles near hardcoded leap positions
        const leapPoints = [
            { x: 14, y: 14 }, { x: 15, y: 14 },  // blue side
            { x: 29, y: 14 }, { x: 30, y: 14 },  // red side
        ];
        for (const lp of leapPoints) {
            if (Math.abs(col - lp.x) <= 1 && Math.abs(row - lp.y) <= 1) return true;
        }
        return false;
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

    // Reset world to initial state (for new games)
    rebuild() {
        this.structures = {};
        this._generate();
    }

    // Get walkable tile positions on a given island (for spawning on non-destroyed tiles)
    getWalkableTiles(islandType) {
        const type = islandType === 'blue' ? T.BLUE : islandType === 'red' ? T.RED : T.HUB;
        const tiles = [];
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (this.tiles[r][c] === type) {
                    tiles.push({ x: c + 0.5, y: r + 0.5 });
                }
            }
        }
        return tiles;
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
                if (struct && !this._isStructDrawn(struct, c, r)) {
                    this._drawLargeStructure(ctx, struct, screen, camera);
                }
            }
        }
        this._drawnStructsThisFrame = {}; // reset per-frame tracking
    }

    _isStructDrawn(name, c, r) {
        // Only draw each structure name once (at its first tile)
        const key = name;
        if (this._drawnStructsThisFrame && this._drawnStructsThisFrame[key]) return true;
        if (!this._drawnStructsThisFrame) this._drawnStructsThisFrame = {};
        this._drawnStructsThisFrame[key] = true;
        return false;
    }

    _drawLargeStructure(ctx, name, screen, camera) {
        const z = camera.zoom;
        const sx = screen.x;
        const sy = screen.y - 16 * z;
        const tw = camera.scaledTileW;

        switch (name) {
            case 'Barricade': {
                // Stacked stone blocks
                ctx.fillStyle = '#8888AA';
                const bw = tw * 0.8, bh = 18 * z;
                ctx.fillRect(sx - bw/2, sy - bh, bw, bh);
                ctx.fillStyle = '#666688';
                ctx.fillRect(sx - bw/2, sy - bh, bw, 3 * z);
                ctx.fillRect(sx - bw/2, sy - bh/2, bw, 2 * z);
                // Cracks
                ctx.strokeStyle = '#555577';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx - 5*z, sy - bh + 4*z);
                ctx.lineTo(sx + 3*z, sy - bh/2);
                ctx.stroke();
                break;
            }
            case 'Watch Tower': {
                // Tall wooden tower with platform
                const baseW = 10 * z, height = 45 * z;
                // Legs
                ctx.fillStyle = '#6B4226';
                ctx.fillRect(sx - baseW/2, sy - height, 3*z, height);
                ctx.fillRect(sx + baseW/2 - 3*z, sy - height, 3*z, height);
                // Cross beams
                ctx.fillRect(sx - baseW/2, sy - height * 0.5, baseW, 2*z);
                // Platform
                ctx.fillStyle = '#8B5E3C';
                ctx.fillRect(sx - baseW * 0.8, sy - height - 4*z, baseW * 1.6, 6*z);
                // Roof
                ctx.fillStyle = '#AA7744';
                ctx.beginPath();
                ctx.moveTo(sx - baseW, sy - height - 4*z);
                ctx.lineTo(sx, sy - height - 18*z);
                ctx.lineTo(sx + baseW, sy - height - 4*z);
                ctx.closePath();
                ctx.fill();
                // Beacon light
                ctx.fillStyle = '#FFDD44';
                ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.003) * 0.3;
                ctx.beginPath();
                ctx.arc(sx, sy - height - 12*z, 4*z, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }
            case 'Stone Wall': {
                // Wide stone wall spanning multiple tiles
                const wallW = tw * 1.5, wallH = 22 * z;
                ctx.fillStyle = '#7777AA';
                ctx.fillRect(sx - wallW/2, sy - wallH, wallW, wallH);
                // Stone texture lines
                ctx.strokeStyle = '#5555889';
                ctx.lineWidth = 1;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(sx - wallW/2, sy - wallH + i * 5 * z);
                    ctx.lineTo(sx + wallW/2, sy - wallH + i * 5 * z);
                    ctx.stroke();
                }
                // Battlements
                ctx.fillStyle = '#8888BB';
                for (let i = 0; i < 5; i++) {
                    ctx.fillRect(sx - wallW/2 + i * wallW/4 - 3*z, sy - wallH - 6*z, 6*z, 6*z);
                }
                break;
            }
            case 'Shield Pylon': {
                // Crystal pylon with energy glow
                const pw = 8 * z, ph = 30 * z;
                ctx.fillStyle = '#44CCDD';
                ctx.beginPath();
                ctx.moveTo(sx, sy - ph);
                ctx.lineTo(sx + pw/2, sy);
                ctx.lineTo(sx - pw/2, sy);
                ctx.closePath();
                ctx.fill();
                // Energy glow
                ctx.fillStyle = 'rgba(68,200,255,0.2)';
                ctx.beginPath();
                ctx.arc(sx, sy - ph/2, 20*z, 0, Math.PI * 2);
                ctx.fill();
                // Pulse ring
                const pulse = (Date.now() % 2000) / 2000;
                ctx.strokeStyle = `rgba(68,220,255,${0.5 - pulse * 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(sx, sy - ph/2, 12*z + pulse * 15*z, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'Turret Platform': {
                // Metal platform with cannon
                const platW = tw * 0.7, platH = 8 * z;
                ctx.fillStyle = '#667788';
                ctx.fillRect(sx - platW/2, sy - platH, platW, platH);
                // Cannon barrel
                ctx.fillStyle = '#445566';
                ctx.fillRect(sx - 3*z, sy - platH - 16*z, 6*z, 16*z);
                // Cannon top
                ctx.fillStyle = '#556677';
                ctx.fillRect(sx - 5*z, sy - platH - 18*z, 10*z, 4*z);
                break;
            }
            case 'Reinforced Dome': {
                // Large translucent dome
                const domeR = tw * 0.9;
                ctx.fillStyle = 'rgba(180,200,220,0.15)';
                ctx.beginPath();
                ctx.ellipse(sx, sy - 8*z, domeR, domeR * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(200,220,240,0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(sx, sy - 8*z, domeR, domeR * 0.6, 0, Math.PI, 0);
                ctx.stroke();
                // Ribs
                for (let i = 0; i < 4; i++) {
                    const ang = (i / 4) * Math.PI;
                    ctx.beginPath();
                    ctx.moveTo(sx - Math.cos(ang) * domeR, sy - 8*z);
                    ctx.quadraticCurveTo(sx, sy - 8*z - domeR * 0.6, sx + Math.cos(ang) * domeR, sy - 8*z);
                    ctx.stroke();
                }
                break;
            }
            case 'Garden Dome': {
                // Green-tinted dome with plants
                const gr = tw * 0.6;
                ctx.fillStyle = 'rgba(50,180,80,0.2)';
                ctx.beginPath();
                ctx.ellipse(sx, sy - 6*z, gr, gr * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(100,220,100,0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
                // Plant sprouts
                ctx.fillStyle = '#44BB44';
                for (let i = -2; i <= 2; i++) {
                    ctx.fillRect(sx + i * 8*z - z, sy - 4*z, 2*z, -6*z);
                    ctx.beginPath();
                    ctx.arc(sx + i * 8*z, sy - 10*z, 3*z, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            default: {
                let spriteKey = null;
                if (name === 'Water Purifier') spriteKey = 'struct_water';
                else if (name === 'Solar Array') spriteKey = 'struct_solar';
                else if (name === 'Habitat Module') spriteKey = 'struct_habitat';
                else if (name === 'Comms Beacon') spriteKey = 'struct_beacon';
                else if (name === 'Landing Pad') spriteKey = 'struct_landing_pad';
                else if (name === 'Garden Dome') spriteKey = 'struct_garden';

                if (spriteKey && this.sprites.get(spriteKey)) {
                    const spr = this.sprites.get(spriteKey);
                    const drawW = 48 * z;
                    const drawH = 56 * z;
                    ctx.drawImage(spr, sx - drawW / 2, sy - drawH + 16 * z, drawW, drawH);
                } else {
                    // Generic structure fallback
                    const isSustain = name.includes('Garden') || name.includes('Water') || name.includes('Solar') || name.includes('Habitat') || name.includes('Comms') || name.includes('Landing');
                    ctx.fillStyle = isSustain ? '#44DD88' : '#FF8844';
                    ctx.globalAlpha = 0.8;
                    const sw = tw * 0.5, sh = 20 * z;
                    ctx.fillRect(sx - sw/2, sy - sh, sw, sh);
                    ctx.globalAlpha = 1;
                }
                break;
            }
        }
        // Structure name label
        ctx.font = `${Math.floor(6 * z)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFF';
        ctx.globalAlpha = 0.8;
        ctx.fillText(name, sx, sy + 8 * z);
        ctx.globalAlpha = 1;
    }

    // ---- Spawning ----
    getSpawnPositions(islandType, count) {
        const type = islandType === 'blue' ? T.BLUE : islandType === 'red' ? T.RED : T.HUB;
        const allTiles = [];
        for (let r = 1; r < MAP_ROWS - 1; r++) {
            for (let c = 1; c < MAP_COLS - 1; c++) {
                if (this.tiles[r][c] !== type) continue;
                
                // Exclude feeder positions
                const isBlueFeeder = (islandType === 'blue' && Math.abs(c - ISLANDS.blue.cx) <= 1 && Math.abs(r - (ISLANDS.blue.cy - 3)) <= 1);
                const isRedFeeder = (islandType === 'red' && Math.abs(c - ISLANDS.red.cx) <= 1 && Math.abs(r - (ISLANDS.red.cy - 3)) <= 1);
                if (isBlueFeeder || isRedFeeder) continue;

                allTiles.push({ x: c + 0.5, y: r + 0.5 });
            }
        }
        // Shuffle
        for (let i = allTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
        }
        // Pick with minimum spacing to avoid clumping
        const chosen = [];
        const MIN_SPACING = 1.5;
        for (const tile of allTiles) {
            if (chosen.length >= count) break;
            let tooClose = false;
            for (const c of chosen) {
                if (dist(tile.x, tile.y, c.x, c.y) < MIN_SPACING) { tooClose = true; break; }
            }
            if (!tooClose) chosen.push(tile);
        }
        return chosen;
    }

    getIslandCenter(name) {
        const island = ISLANDS[name];
        return { x: island.cx, y: island.cy };
    }
}
