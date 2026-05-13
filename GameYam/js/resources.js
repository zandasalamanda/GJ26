// ============================================
// ALIEN ASSEMBLY LINE — Resources
// ============================================

import { NODE_TYPES, RESOURCE_HP, RESOURCE_RESPAWN_TIME, RESOURCE_RESPAWN_TIME_MIN, MAT_COLORS, randRange, randInt, dist } from './utils.js';

export class ResourceNode {
    constructor(type, x, y) {
        this.type = type;           // key from NODE_TYPES
        this.info = NODE_TYPES[type];
        this.x = x;                 // tile coords
        this.y = y;
        this.hp = this.info.hp;
        this.maxHp = this.info.hp;
        this.alive = true;
        this.respawnTimer = 0;
        this.shakeTimer = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.scale = 1;
    }

    hit() {
        if (!this.alive) return null;
        this.hp--;
        this.shakeTimer = 200;
        if (this.hp <= 0) {
            this.alive = false;
            this.respawnTimer = randRange(RESOURCE_RESPAWN_TIME_MIN, RESOURCE_RESPAWN_TIME);
            this.scale = 0;
            return this.info.material;
        }
        return null; // still alive, no drop yet (partial harvest)
    }

    update(dt) {
        // Shake animation
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.shakeX = (Math.random() - 0.5) * 2;
            this.shakeY = (Math.random() - 0.5) * 1;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        // Respawn
        if (!this.alive) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.alive = true;
                this.hp = this.maxHp;
                this.scale = 0;
            }
        }

        // Scale animation (grow in when spawning)
        if (this.alive && this.scale < 1) {
            this.scale = Math.min(1, this.scale + 0.02);
        }
    }

    draw(ctx, camera, sprites) {
        if (!this.alive && this.respawnTimer > 500) return;

        const screen = camera.worldToScreen(this.x, this.y);
        if (!camera.isOnScreen(screen.x, screen.y)) return;

        const spriteKey = this._getSpriteKey();
        const sprite = sprites.get(spriteKey);
        if (!sprite) return;

        const z = camera.zoom;
        const sw = sprite.width * z;
        const sh = sprite.height * z;
        const drawX = screen.x - sw / 2 + this.shakeX * z;
        const drawY = screen.y - sh + 6 * z + this.shakeY * z;

        ctx.save();
        if (this.scale < 1) {
            ctx.globalAlpha = this.scale;
            ctx.translate(drawX + sw / 2, drawY + sh);
            ctx.scale(this.scale, this.scale);
            ctx.translate(-(drawX + sw / 2), -(drawY + sh));
        }

        if (this.hp === 1 && this.maxHp > 1) {
            ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.7;
        }

        ctx.drawImage(sprite, drawX, drawY, sw, sh);
        ctx.restore();
    }

    _getSpriteKey() {
        switch (this.type) {
            case 'TREE': return 'node_tree';
            case 'BUSH': return 'node_bush';
            case 'CRYSTAL_N': return 'node_crystal';
            case 'ROCK': return 'node_rock';
            case 'ORE_VEIN': return 'node_ore';
            case 'COAL_DEP': return 'node_coal';
            default: return 'node_rock';
        }
    }
}

export class ResourceManager {
    constructor(world, sprites) {
        this.nodes = [];
        this.world = world;
        this.sprites = sprites;
    }

    spawnInitial() {
        // Blue island resources
        const blueSpots = this.world.getSpawnPositions('blue', 18);
        const blueTypes = ['TREE','TREE','TREE','TREE','TREE','TREE','BUSH','BUSH','BUSH','BUSH','CRYSTAL_N','CRYSTAL_N','CRYSTAL_N','TREE','TREE','BUSH','CRYSTAL_N','TREE'];
        for (let i = 0; i < Math.min(blueSpots.length, blueTypes.length); i++) {
            this.nodes.push(new ResourceNode(blueTypes[i], blueSpots[i].x, blueSpots[i].y));
        }

        // Red island resources
        const redSpots = this.world.getSpawnPositions('red', 18);
        const redTypes = ['ROCK','ROCK','ROCK','ROCK','ROCK','ROCK','ORE_VEIN','ORE_VEIN','ORE_VEIN','ORE_VEIN','COAL_DEP','COAL_DEP','COAL_DEP','COAL_DEP','ROCK','ROCK','ORE_VEIN','COAL_DEP'];
        for (let i = 0; i < Math.min(redSpots.length, redTypes.length); i++) {
            this.nodes.push(new ResourceNode(redTypes[i], redSpots[i].x, redSpots[i].y));
        }
    }

    update(dt) {
        for (const node of this.nodes) {
            node.update(dt);
        }
    }

    draw(ctx, camera) {
        // Sort by Y for depth
        const sorted = [...this.nodes].sort((a, b) => a.y - b.y);
        for (const node of sorted) {
            node.draw(ctx, camera, this.sprites);
        }
    }

    // Find nearest alive node within range of position
    findNearest(wx, wy, maxDist = 1.5) {
        let nearest = null;
        let nearestDist = maxDist;
        for (const node of this.nodes) {
            if (!node.alive) continue;
            const d = dist(wx, wy, node.x, node.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = node;
            }
        }
        return nearest;
    }
}
