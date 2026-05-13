// ============================================
// ALIEN ASSEMBLY LINE — Sprite Manager
// ============================================
import { TILE_W, TILE_H, MAT, MAT_COLORS, PALETTE } from './utils.js';

export class SpriteManager {
    constructor() {
        this.sprites = {};  // canvas sprites (static)
        this.images = {};   // Image elements (animated GIFs)
        this.loaded = false;
    }

    async load(onProgress) {
        onProgress(0.1, 'Generating tiles...');
        this._generateTiles();
        onProgress(0.3, 'Generating resources...');
        this._generateResources();
        onProgress(0.5, 'Generating machines...');
        this._generateMachines();
        onProgress(0.6, 'Generating icons...');
        this._generateIcons();
        onProgress(0.7, 'Loading aliens...');
        await this._loadAliens();
        onProgress(0.9, 'Generating UI...');
        this._generateUI();
        onProgress(0.95, 'Generating structures...');
        this._generateStructures();
        onProgress(1.0, 'Ready!');
        this.loaded = true;
    }

    get(name) { return this.sprites[name]; }
    getImg(name) { return this.images[name]; }

    _c(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
    }

    _darken(hex, f) {
        if (!hex.startsWith('#')) return hex;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgb(${Math.floor(r*f)},${Math.floor(g*f)},${Math.floor(b*f)})`;
    }

    _lighten(hex, f) {
        if (!hex.startsWith('#')) return hex;
        const r = Math.min(255,parseInt(hex.slice(1,3),16)*f), g = Math.min(255,parseInt(hex.slice(3,5),16)*f), b = Math.min(255,parseInt(hex.slice(5,7),16)*f);
        return `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
    }

    // Add white outline to a canvas sprite, returns new canvas
    _outline(src, thickness = 1) {
        const pad = thickness + 1;
        const c = this._c(src.width + pad * 2, src.height + pad * 2);
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        // Draw offset copies for outline
        for (let dy = -thickness; dy <= thickness; dy++) {
            for (let dx = -thickness; dx <= thickness; dx++) {
                if (dx === 0 && dy === 0) continue;
                x.drawImage(src, pad + dx, pad + dy);
            }
        }
        // Tint all drawn pixels white
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = '#FFFFFF';
        x.fillRect(0, 0, c.width, c.height);
        // Draw original on top
        x.globalCompositeOperation = 'source-over';
        x.drawImage(src, pad, pad);
        return c;
    }

    // Draw an animated GIF Image with white outline onto ctx at runtime
    drawOutlinedImage(ctx, img, x, y, w, h, cropX, cropY, cropW, cropH) {
        // Use a cached temp canvas
        if (!this._tmpCanvas || this._tmpCanvas.width < w + 6 || this._tmpCanvas.height < h + 6) {
            this._tmpCanvas = this._c(w + 6, h + 6);
        }
        const tmp = this._tmpCanvas;
        const tc = tmp.getContext('2d');
        tc.imageSmoothingEnabled = false;
        tc.clearRect(0, 0, tmp.width, tmp.height);
        // Draw offset copies
        const offsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
        for (const [ox, oy] of offsets) {
            tc.drawImage(img, cropX, cropY, cropW, cropH, 3 + ox, 3 + oy, w, h);
        }
        // Tint white
        tc.globalCompositeOperation = 'source-in';
        tc.fillStyle = '#FFFFFF';
        tc.fillRect(0, 0, tmp.width, tmp.height);
        // Draw original
        tc.globalCompositeOperation = 'source-over';
        tc.drawImage(img, cropX, cropY, cropW, cropH, 3, 3, w, h);
        // Blit to main canvas
        ctx.drawImage(tmp, 0, 0, w + 6, h + 6, x - 3, y - 3, w + 6, h + 6);
    }

    _generateTiles() {
        const types = [
            { key: 'tile_blue', colors: PALETTE.blueIsland.ground, edge: PALETTE.blueIsland.edge },
            { key: 'tile_red', colors: PALETTE.redIsland.ground, edge: PALETTE.redIsland.edge },
            { key: 'tile_hub', colors: PALETTE.hub.ground, edge: PALETTE.hub.edge },
            { key: 'tile_bridge', colors: PALETTE.bridge.ground, edge: PALETTE.bridge.edge },
        ];
        for (const t of types) {
            for (let v = 0; v < t.colors.length; v++) {
                const c = this._c(TILE_W, TILE_H + 4);
                const x = c.getContext('2d');
                x.fillStyle = t.colors[v];
                x.beginPath();
                x.moveTo(TILE_W/2,0); x.lineTo(TILE_W,TILE_H/2); x.lineTo(TILE_W/2,TILE_H); x.lineTo(0,TILE_H/2);
                x.closePath(); x.fill();
                x.fillStyle = t.edge;
                x.beginPath();
                x.moveTo(0,TILE_H/2); x.lineTo(TILE_W/2,TILE_H); x.lineTo(TILE_W/2,TILE_H+4); x.lineTo(0,TILE_H/2+4);
                x.closePath(); x.fill();
                x.fillStyle = this._darken(t.edge, 0.8);
                x.beginPath();
                x.moveTo(TILE_W,TILE_H/2); x.lineTo(TILE_W/2,TILE_H); x.lineTo(TILE_W/2,TILE_H+4); x.lineTo(TILE_W,TILE_H/2+4);
                x.closePath(); x.fill();
                // Tile outline
                x.strokeStyle = this._lighten(t.colors[v], 1.3);
                x.lineWidth = 1;
                x.beginPath();
                x.moveTo(TILE_W/2,0); x.lineTo(TILE_W,TILE_H/2); x.lineTo(TILE_W/2,TILE_H); x.lineTo(0,TILE_H/2);
                x.closePath(); x.stroke();
                this.sprites[`${t.key}_${v}`] = c;
            }
        }
    }

    _generateResources() {
        // Tree (30x42)
        let c = this._c(30,42), x = c.getContext('2d');
        x.fillStyle='#4A2A10'; x.fillRect(13,28,5,14); // trunk
        x.fillStyle='#3A1E08'; x.fillRect(13,28,2,14); // trunk shadow
        x.fillStyle='#1A5A28'; x.fillRect(4,10,22,20); // dark leaves
        x.fillStyle='#2D8B46'; x.fillRect(5,6,20,18); // main leaves
        x.fillStyle='#3DAB56'; x.fillRect(8,8,10,6); // highlight
        x.fillStyle='#4CC866'; x.fillRect(10,9,4,3); // bright spot
        x.fillStyle='#1A5A28'; x.fillRect(7,18,6,4); // shadow detail
        x.fillStyle='#2D8B46'; x.fillRect(17,14,5,6); // leaf cluster
        this.sprites['node_tree'] = c;

        // Crystal (24x36)
        c = this._c(24,36); x = c.getContext('2d');
        x.fillStyle='#1A7799';
        x.beginPath(); x.moveTo(12,0); x.lineTo(22,14); x.lineTo(12,36); x.lineTo(2,14); x.closePath(); x.fill();
        x.fillStyle='#2299BB';
        x.beginPath(); x.moveTo(12,2); x.lineTo(20,14); x.lineTo(12,32); x.closePath(); x.fill();
        x.fillStyle='#44DDFF';
        x.beginPath(); x.moveTo(12,4); x.lineTo(18,14); x.lineTo(12,28); x.closePath(); x.fill();
        x.fillStyle='#88EEFF'; x.fillRect(13,6,3,5);
        x.fillStyle='#BBFFFF'; x.fillRect(14,8,2,2);
        // Small crystal
        x.fillStyle='#2299BB';
        x.beginPath(); x.moveTo(4,20); x.lineTo(9,12); x.lineTo(9,28); x.lineTo(4,28); x.closePath(); x.fill();
        x.fillStyle='#44DDFF'; x.fillRect(6,16,2,6);
        this.sprites['node_crystal'] = c;

        // Vine bush (24x20)
        c = this._c(24,20); x = c.getContext('2d');
        x.fillStyle='#1E6030'; x.fillRect(3,6,18,14); // dark base
        x.fillStyle='#2A7A38'; x.fillRect(4,4,16,12); // mid
        x.fillStyle='#3D9B50'; x.fillRect(6,5,12,8); // bright
        x.fillStyle='#5DBB70'; x.fillRect(8,6,5,3); // highlight
        // Vine tendrils
        x.fillStyle='#1E6030';
        x.fillRect(1,12,3,6); x.fillRect(20,10,3,8);
        x.fillRect(6,16,2,4); x.fillRect(16,15,2,5);
        this.sprites['node_bush'] = c;

        // Rock (28x22)
        c = this._c(28,22); x = c.getContext('2d');
        x.fillStyle='#445566'; x.fillRect(3,8,22,14); // shadow
        x.fillStyle='#667788'; x.fillRect(4,4,20,14); // base
        x.fillStyle='#8899AA'; x.fillRect(5,3,16,10); // mid
        x.fillStyle='#AABBCC'; x.fillRect(6,5,8,5); // highlight
        x.fillStyle='#556677'; x.fillRect(12,8,1,5); x.fillRect(18,6,1,4); // cracks
        this.sprites['node_rock'] = c;

        // Ore (28x22)
        c = this._c(28,22); x = c.getContext('2d');
        x.fillStyle='#664422'; x.fillRect(3,8,22,14);
        x.fillStyle='#886633'; x.fillRect(4,4,20,14);
        x.fillStyle='#AA8844'; x.fillRect(5,3,16,10);
        x.fillStyle='#CC9955'; x.fillRect(6,5,8,5);
        // Ore veins
        x.fillStyle='#FFAA44'; x.fillRect(8,7,3,3); x.fillRect(16,5,3,4); x.fillRect(12,11,4,2);
        x.fillStyle='#FFCC66'; x.fillRect(9,8,1,1); x.fillRect(17,6,1,1);
        this.sprites['node_ore'] = c;

        // Coal (28x22)
        c = this._c(28,22); x = c.getContext('2d');
        x.fillStyle='#111118'; x.fillRect(3,8,22,14);
        x.fillStyle='#222230'; x.fillRect(4,4,20,14);
        x.fillStyle='#333344'; x.fillRect(5,3,16,10);
        x.fillStyle='#444455'; x.fillRect(6,5,8,5);
        x.fillStyle='#555566'; x.fillRect(8,6,3,2); // slight sheen
        this.sprites['node_coal'] = c;
    }

    _generateMachines() {
        // Crafter (42x48)
        let c = this._c(42,48), x = c.getContext('2d');
        x.fillStyle='#2A2A4A'; x.fillRect(3,30,36,18); // base dark
        x.fillStyle='#3A3A5A'; x.fillRect(4,28,34,16); // base
        x.fillStyle='#4A4A6A'; x.fillRect(6,10,30,20); // body
        x.fillStyle='#5A5A7A'; x.fillRect(8,8,26,16); // top
        x.fillStyle='#002211'; x.fillRect(10,12,22,12); // screen bg
        x.fillStyle='#00FFAA'; x.fillRect(11,13,20,10); // screen
        // Scanlines
        for(let i=0;i<5;i++){x.fillStyle='rgba(0,0,0,0.15)';x.fillRect(11,14+i*2,20,1);}
        // Antenna
        x.fillStyle='#6A6A8A'; x.fillRect(19,0,4,10);
        x.fillStyle='#00FFAA'; x.fillRect(18,0,6,3);
        x.fillStyle='#00FF88'; x.fillRect(20,1,2,1); // blink
        // Buttons
        x.fillStyle='#FF4444'; x.fillRect(12,30,4,4);
        x.fillStyle='#44FF44'; x.fillRect(19,30,4,4);
        x.fillStyle='#4488FF'; x.fillRect(26,30,4,4);
        // Detail pipes
        x.fillStyle='#5A5A7A'; x.fillRect(8,38,26,2);
        x.fillStyle='#3A3A5A'; x.fillRect(6,26,30,2);
        this.sprites['machine_crafter'] = c;

        // Furnace (36x42)
        c = this._c(36,42); x = c.getContext('2d');
        x.fillStyle='#4A2010'; x.fillRect(3,16,30,26); // base
        x.fillStyle='#5A3020'; x.fillRect(4,14,28,22); // body
        x.fillStyle='#7A4030'; x.fillRect(5,8,26,18); // top
        x.fillStyle='#111'; x.fillRect(10,14,16,12); // opening
        x.fillStyle='#FF4400'; x.fillRect(12,20,12,6); // fire base
        x.fillStyle='#FF6622'; x.fillRect(14,17,8,6); // fire mid
        x.fillStyle='#FFAA22'; x.fillRect(16,15,4,5); // fire top
        x.fillStyle='#FFDD44'; x.fillRect(17,14,2,3); // fire tip
        // Chimney
        x.fillStyle='#5A3020'; x.fillRect(24,0,6,10);
        x.fillStyle='#7A4030'; x.fillRect(25,0,4,8);
        // Rivets
        x.fillStyle='#8A5040'; x.fillRect(6,12,2,2); x.fillRect(28,12,2,2);
        x.fillRect(6,32,2,2); x.fillRect(28,32,2,2);
        this.sprites['machine_furnace'] = c;

        // Delivery zone (larger, animated glow handled in draw)
        c = this._c(TILE_W+4, TILE_H+8); x = c.getContext('2d');
        const cx2 = (TILE_W+4)/2, cy2 = (TILE_H+8)/2 - 2;
        x.fillStyle='#008855';
        x.beginPath(); x.moveTo(cx2,cy2-TILE_H/2); x.lineTo(cx2+TILE_W/2,cy2); x.lineTo(cx2,cy2+TILE_H/2); x.lineTo(cx2-TILE_W/2,cy2); x.closePath(); x.fill();
        x.strokeStyle='#00FFAA'; x.lineWidth=1.5; x.stroke();
        // Inner diamond
        x.strokeStyle='#00FFCC'; x.lineWidth=0.5;
        x.beginPath(); x.moveTo(cx2,cy2-4); x.lineTo(cx2+6,cy2); x.lineTo(cx2,cy2+4); x.lineTo(cx2-6,cy2); x.closePath(); x.stroke();
        // Arrow down
        x.fillStyle='#00FFAA';
        x.fillRect(cx2-1,cy2-3,3,6);
        x.beginPath(); x.moveTo(cx2-3,cy2+1); x.lineTo(cx2+4,cy2+1); x.lineTo(cx2+0.5,cy2+5); x.closePath(); x.fill();
        this.sprites['delivery_zone'] = c;
    }

    _generateIcons() {
        const iconSize = 14;
        for (const mat of Object.values(MAT)) {
            const c = this._c(iconSize, iconSize);
            const x = c.getContext('2d');
            const col = MAT_COLORS[mat] || '#888';
            x.fillStyle = col;
            x.fillRect(2, 2, 10, 10);
            x.fillStyle = 'rgba(255,255,255,0.3)';
            x.fillRect(3, 3, 4, 3);
            x.strokeStyle = '#FFF';
            x.lineWidth = 0.5;
            x.strokeRect(2, 2, 10, 10);
            this.sprites[`icon_${mat}`] = c;
        }
        // Star icons
        for (const [key, col] of [['icon_star','#FFD700'],['icon_star_empty','#444']]) {
            const c = this._c(14,14); const x = c.getContext('2d');
            x.fillStyle = col;
            x.beginPath();
            for(let i=0;i<10;i++){const a=(i*Math.PI)/5-Math.PI/2,r=i%2===0?7:3;x.lineTo(7+Math.cos(a)*r,7+Math.sin(a)*r);}
            x.closePath(); x.fill();
            if (col==='#FFD700'){x.fillStyle='#FFF';x.globalAlpha=0.3;x.fillRect(5,3,2,3);x.globalAlpha=1;}
            this.sprites[key] = c;
        }
    }

    async _loadAliens() {
        const files = {
            'blue_idle': 'BlueAlien.gif',
            'blue_tool': 'BlueAlienWPickaxe.gif',
            'red_idle': 'RedAlien.gif',
            'red_tool': 'RedAlienWAxe.gif',
        };
        const promises = Object.entries(files).map(([key, file]) => new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                // Store the live Image element for animated GIF support
                this.images[key] = img;
                resolve();
            };
            img.onerror = () => {
                // Fallback: create a static placeholder canvas
                const isBlue = key.startsWith('blue');
                const hasTool = key.includes('tool');
                const c = this._c(40, 40);
                const ctx = c.getContext('2d');
                // Body
                ctx.fillStyle = isBlue ? '#4488FF' : '#FF4444';
                ctx.fillRect(12, 6, 16, 16);
                // Head bump
                ctx.fillRect(15, 2, 10, 8);
                // Legs
                ctx.fillStyle = isBlue ? '#3366DD' : '#DD2222';
                ctx.fillRect(12, 22, 6, 12);
                ctx.fillRect(22, 22, 6, 12);
                // Eyes
                ctx.fillStyle = '#FFF';
                ctx.fillRect(15, 9, 4, 4);
                ctx.fillRect(21, 9, 4, 4);
                ctx.fillStyle = '#111';
                ctx.fillRect(17, 10, 2, 3);
                ctx.fillRect(23, 10, 2, 3);
                // Mouth
                ctx.fillStyle = '#222';
                ctx.fillRect(17, 16, 6, 2);
                // Tool
                if (hasTool) {
                    ctx.fillStyle = '#999';
                    ctx.fillRect(30, 8, 3, 16);
                    ctx.fillStyle = '#777';
                    ctx.fillRect(28, 6, 7, 4);
                }
                // Outline
                const outlined = this._outline(c, 1);
                this.images[key] = outlined; // store as canvas fallback
                resolve();
            };
            img.src = file;
        }));
        await Promise.all(promises);
    }

    _generateUI() {
        const pups = [
            {key:'powerup_speed',c:'#FFDD44'},
            {key:'powerup_frenzy',c:'#FF4444'},
            {key:'powerup_double',c:'#44FF44'},
            {key:'powerup_time',c:'#AA44FF'}
        ];
        for (const p of pups) {
            const c = this._c(18,18), x = c.getContext('2d');
            x.fillStyle = p.c;
            x.beginPath(); x.arc(9,9,7,0,Math.PI*2); x.fill();
            x.fillStyle = 'rgba(255,255,255,0.5)';
            x.beginPath(); x.arc(6,6,3,0,Math.PI*2); x.fill();
            x.strokeStyle = '#FFF'; x.lineWidth = 1;
            x.beginPath(); x.arc(9,9,7,0,Math.PI*2); x.stroke();
            this.sprites[p.key] = c;
        }
    }

    _generateStructures() {
        const W = 48, H = 56;
        const structs = [
            { key: 'struct_barricade', draw: (x) => {
                // Stacked stone blocks
                x.fillStyle = '#887766';
                x.fillRect(8, 30, 32, 12);
                x.fillStyle = '#776655';
                x.fillRect(10, 24, 28, 8);
                x.fillStyle = '#665544';
                x.fillRect(12, 18, 24, 8);
                // Wooden supports
                x.fillStyle = '#8B6914';
                x.fillRect(6, 20, 3, 22);
                x.fillRect(39, 20, 3, 22);
            }},
            { key: 'struct_watch_tower', draw: (x) => {
                // Tall tower
                x.fillStyle = '#8B6914';
                x.fillRect(19, 6, 10, 40);
                x.fillStyle = '#6B4F12';
                x.fillRect(17, 40, 14, 6);
                // Platform
                x.fillStyle = '#AA7722';
                x.fillRect(12, 4, 24, 6);
                // Antenna
                x.fillStyle = '#FFD700';
                x.fillRect(23, 0, 2, 6);
                x.fillStyle = '#FF4444';
                x.fillRect(22, 0, 4, 2);
            }},
            { key: 'struct_stone_wall', draw: (x) => {
                // Thick wall spanning width
                x.fillStyle = '#998877';
                x.fillRect(4, 26, 40, 16);
                x.fillStyle = '#887766';
                x.fillRect(6, 22, 36, 6);
                // Crenellations
                for (let i = 0; i < 5; i++) {
                    x.fillStyle = '#AA9988';
                    x.fillRect(6 + i * 8, 18, 5, 6);
                }
            }},
            { key: 'struct_shield_pylon', draw: (x) => {
                // Crystal pylon
                x.fillStyle = '#446688';
                x.fillRect(18, 16, 12, 26);
                // Crystal top
                x.fillStyle = '#66BBFF';
                x.beginPath(); x.moveTo(24, 4); x.lineTo(30, 16); x.lineTo(18, 16); x.fill();
                // Glow
                x.fillStyle = 'rgba(100,180,255,0.3)';
                x.beginPath(); x.arc(24, 20, 14, 0, Math.PI * 2); x.fill();
                // Base
                x.fillStyle = '#334455';
                x.fillRect(14, 40, 20, 6);
            }},
            { key: 'struct_turret', draw: (x) => {
                // Base platform
                x.fillStyle = '#556677';
                x.fillRect(10, 34, 28, 10);
                // Turret body
                x.fillStyle = '#778899';
                x.fillRect(16, 22, 16, 14);
                // Barrel
                x.fillStyle = '#445566';
                x.fillRect(20, 10, 8, 14);
                x.fillStyle = '#FF6644';
                x.fillRect(22, 8, 4, 4);
            }},
            { key: 'struct_dome', draw: (x) => {
                // Reinforced dome
                x.fillStyle = '#889999';
                x.beginPath(); x.arc(24, 30, 18, Math.PI, 0); x.fill();
                x.fillStyle = '#667788';
                x.fillRect(6, 30, 36, 8);
                // Ribs
                x.strokeStyle = '#AABBCC';
                x.lineWidth = 1;
                for (let a = 0.3; a < Math.PI; a += 0.5) {
                    x.beginPath();
                    x.moveTo(24 + Math.cos(a) * 18, 30 - Math.sin(a) * 18);
                    x.lineTo(24, 30);
                    x.stroke();
                }
            }},
            { key: 'struct_garden', draw: (x) => {
                // Glass dome
                x.fillStyle = 'rgba(100,220,150,0.4)';
                x.beginPath(); x.arc(24, 32, 16, Math.PI, 0); x.fill();
                x.strokeStyle = '#66DD99';
                x.lineWidth = 2;
                x.beginPath(); x.arc(24, 32, 16, Math.PI, 0); x.stroke();
                // Plants inside
                x.fillStyle = '#33AA44';
                x.fillRect(14, 28, 4, 8);
                x.fillRect(22, 24, 4, 12);
                x.fillRect(30, 26, 4, 10);
                x.fillStyle = '#44CC55';
                x.fillRect(15, 24, 2, 6);
                x.fillRect(23, 20, 2, 6);
                // Base
                x.fillStyle = '#554433';
                x.fillRect(8, 34, 32, 6);
            }},
            { key: 'struct_water', draw: (x) => {
                // Tank
                x.fillStyle = '#4488AA';
                x.fillRect(12, 18, 24, 22);
                // Water level
                x.fillStyle = '#66CCFF';
                x.fillRect(14, 24, 20, 14);
                // Pipes
                x.fillStyle = '#556677';
                x.fillRect(8, 30, 6, 4);
                x.fillRect(34, 30, 6, 4);
                // Base
                x.fillStyle = '#445566';
                x.fillRect(10, 38, 28, 6);
            }},
            { key: 'struct_solar', draw: (x) => {
                // Panel support
                x.fillStyle = '#667788';
                x.fillRect(22, 24, 4, 20);
                // Angled panels
                x.fillStyle = '#3366AA';
                x.beginPath();
                x.moveTo(6, 18); x.lineTo(42, 18);
                x.lineTo(38, 26); x.lineTo(10, 26);
                x.fill();
                // Panel shine
                x.fillStyle = '#4488DD';
                x.fillRect(12, 20, 8, 4);
                x.fillRect(28, 20, 8, 4);
                // Blue glow
                x.fillStyle = 'rgba(60,120,255,0.2)';
                x.beginPath(); x.arc(24, 22, 20, 0, Math.PI * 2); x.fill();
            }},
            { key: 'struct_habitat', draw: (x) => {
                // Rounded module
                x.fillStyle = '#887799';
                x.beginPath(); x.arc(24, 30, 16, 0, Math.PI * 2); x.fill();
                x.fillStyle = '#776688';
                x.fillRect(8, 30, 32, 12);
                // Windows
                x.fillStyle = '#FFEE88';
                x.fillRect(14, 26, 4, 4);
                x.fillRect(30, 26, 4, 4);
                // Door
                x.fillStyle = '#554466';
                x.fillRect(21, 32, 6, 10);
                x.fillStyle = '#FFDD66';
                x.fillRect(22, 34, 4, 6);
            }},
            { key: 'struct_beacon', draw: (x) => {
                // Tall signal tower
                x.fillStyle = '#998877';
                x.fillRect(20, 10, 8, 34);
                x.fillStyle = '#AA9988';
                x.fillRect(16, 40, 16, 6);
                // Antenna array
                x.fillStyle = '#FFD700';
                x.fillRect(10, 6, 28, 3);
                x.fillRect(23, 0, 2, 8);
                // Signal rings
                x.strokeStyle = 'rgba(255,215,0,0.4)';
                x.lineWidth = 1;
                x.beginPath(); x.arc(24, 6, 8, 0, Math.PI * 2); x.stroke();
                x.beginPath(); x.arc(24, 6, 14, 0, Math.PI * 2); x.stroke();
            }},
            { key: 'struct_landing_pad', draw: (x) => {
                // Flat platform
                x.fillStyle = '#778899';
                x.fillRect(4, 30, 40, 12);
                x.fillStyle = '#667788';
                x.fillRect(6, 28, 36, 4);
                // H marking
                x.fillStyle = '#FFD700';
                x.fillRect(14, 32, 3, 8);
                x.fillRect(31, 32, 3, 8);
                x.fillRect(14, 35, 20, 3);
                // Corner lights
                x.fillStyle = '#FF4444';
                x.fillRect(6, 30, 3, 3);
                x.fillRect(39, 30, 3, 3);
                x.fillStyle = '#44FF44';
                x.fillRect(6, 39, 3, 3);
                x.fillRect(39, 39, 3, 3);
            }},
        ];

        for (const s of structs) {
            const c = this._c(W, H);
            const x = c.getContext('2d');
            s.draw(x);
            this.sprites[s.key] = c;
        }
    }
}
