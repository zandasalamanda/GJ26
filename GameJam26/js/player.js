// ============================================
// FLAT-EARTHRZ — Player
// ============================================

import { PLAYER_SPEED, PLAYER_SPEED_BOOSTED, PLAYER_INVENTORY_SIZE, HARVEST_TIME, HARVEST_TIME_FRENZY, TOSS_SPEED, TOSS_ARC_HEIGHT, MAT_COLORS, dist, lerp, ISLANDS, LEAP_DURATION, LEAP_ARC, easeInOutCubic } from './utils.js';

export class Player {
    constructor(id, island, sprites) {
        this.id = id; // 'blue' or 'red'
        this.island = island; // which island they belong to
        this.x = 0; // tile coords (float)
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.facing = 'down'; // up, down, left, right
        this.inventory = []; // array of material IDs
        this.selectedSlot = 0;
        this.state = 'idle'; // idle, walking, harvesting, crafting, tossing
        this.harvestProgress = 0;
        this.harvestTarget = null;
        this.craftProgress = 0;
        this.sprites = sprites;
        this.animFrame = 0;
        this.animTimer = 0;
        this.bobOffset = 0;
        this.bobTimer = 0;

        // Power-up states
        this.speedBoosted = false;
        this.harvestFrenzy = false;
        this.doubleYield = false;
        this.powerupTimers = { speed: 0, frenzy: 0, double: 0 };

        // Visual
        this.shadow = true;
        this.flashTimer = 0;
        this.emoteText = '';
        this.emoteTimer = 0;

        // Leap state
        this.leaping = false;
        this.leapProgress = 0;
        this.leapFrom = { x: 0, y: 0 };
        this.leapTo = { x: 0, y: 0 };
        this.leapCooldown = 0;
        this.lastIsoMoveX = 0;
        this.lastIsoMoveY = 0;

        // Per-player craft menu state
        this.craftMenuOpen = false;
        this.craftMenuMode = 'craft';
        this.craftMenuSelection = 0;

        // Animation extras
        this.harvestBobTimer = 0;
        this.hitShakeX = 0;
        this.hitShakeY = 0;
        this.hitShakeTimer = 0;

        // Barrier pushback
        this.pushbackVX = 0;
        this.pushbackVY = 0;
        this.denyCooldown = 0;

        // Alien carry
        this.carriedAlien = null;
        this.speedMultiplier = 1.0; // hunger/debuff modifier
    }

    get speed() {
        const base = this.speedBoosted ? PLAYER_SPEED_BOOSTED : PLAYER_SPEED;
        return base * this.speedMultiplier;
    }

    get currentItem() {
        return this.inventory[this.selectedSlot] || null;
    }

    get inventoryFull() {
        return this.inventory.length >= PLAYER_INVENTORY_SIZE;
    }

    addItem(material) {
        if (this.inventoryFull) return false;
        this.inventory.push(material);
        return true;
    }

    removeItem(index) {
        if (index < 0 || index >= this.inventory.length) return null;
        const item = this.inventory.splice(index, 1)[0];
        if (this.selectedSlot >= this.inventory.length && this.selectedSlot > 0) {
            this.selectedSlot = this.inventory.length - 1;
        }
        return item;
    }

    removeSelectedItem() {
        return this.removeItem(this.selectedSlot);
    }

    // Remove specific materials from inventory, returns true if successful
    removeMaterials(recipe) {
        // Check if we have enough
        const counts = {};
        for (const item of this.inventory) {
            counts[item] = (counts[item] || 0) + 1;
        }
        for (const [mat, qty] of Object.entries(recipe)) {
            if ((counts[mat] || 0) < qty) return false;
        }
        // Remove them
        for (const [mat, qty] of Object.entries(recipe)) {
            let removed = 0;
            for (let i = this.inventory.length - 1; i >= 0 && removed < qty; i--) {
                if (this.inventory[i] === mat) {
                    this.inventory.splice(i, 1);
                    removed++;
                }
            }
        }
        if (this.selectedSlot >= this.inventory.length && this.selectedSlot > 0) {
            this.selectedSlot = Math.max(0, this.inventory.length - 1);
        }
        return true;
    }

    // Check if player has the materials for a recipe
    hasMaterials(recipe) {
        const counts = {};
        for (const item of this.inventory) {
            counts[item] = (counts[item] || 0) + 1;
        }
        for (const [mat, qty] of Object.entries(recipe)) {
            if ((counts[mat] || 0) < qty) return false;
        }
        return true;
    }

    cycleSlot(dir) {
        if (this.inventory.length === 0) return;
        this.selectedSlot = ((this.selectedSlot + dir) % this.inventory.length + this.inventory.length) % this.inventory.length;
    }

    showEmote(text, duration = 1500) {
        this.emoteText = text;
        this.emoteTimer = duration;
    }

    update(dt, moveInput, world) {
        // Power-up timers
        for (const key of Object.keys(this.powerupTimers)) {
            if (this.powerupTimers[key] > 0) {
                this.powerupTimers[key] -= dt;
                if (this.powerupTimers[key] <= 0) {
                    if (key === 'speed') this.speedBoosted = false;
                    if (key === 'frenzy') this.harvestFrenzy = false;
                    if (key === 'double') this.doubleYield = false;
                }
            }
        }

        // Emote timer
        if (this.emoteTimer > 0) this.emoteTimer -= dt;

        // Flash timer
        if (this.flashTimer > 0) this.flashTimer -= dt;

        // Bob animation
        this.bobTimer += dt * 0.005;
        this.bobOffset = Math.sin(this.bobTimer * 3) * 1;

        // Harvest bob timer
        if (this.state === 'harvesting') {
            this.harvestBobTimer += dt;
        } else {
            this.harvestBobTimer = 0;
        }

        // Hit shake
        if (this.hitShakeTimer > 0) {
            this.hitShakeTimer -= dt;
            this.hitShakeX = (Math.random() - 0.5) * 4;
            this.hitShakeY = (Math.random() - 0.5) * 2;
        } else {
            this.hitShakeX = 0;
            this.hitShakeY = 0;
        }

        // Leap animation
        if (this.leaping) {
            this.leapProgress += dt / LEAP_DURATION;
            if (this.leapProgress >= 1) {
                this.leapProgress = 1;
                this.x = this.leapTo.x;
                this.y = this.leapTo.y;
                this.leaping = false;
                this.state = 'idle';
            } else {
                const t = easeInOutCubic(this.leapProgress);
                this.x = lerp(this.leapFrom.x, this.leapTo.x, t);
                this.y = lerp(this.leapFrom.y, this.leapTo.y, t);
            }
            return; // skip normal movement during leap
        }

        // Movement
        if (this.state === 'idle' || this.state === 'walking') {
            const { dx, dy } = moveInput;
            if (dx !== 0 || dy !== 0) {
                this.state = 'walking';

                let isoMoveX = (dx + dy) * 0.5;
                let isoMoveY = (dy - dx) * 0.5;
                // Normalize so all directions move at equal speed
                const isoLen = Math.sqrt(isoMoveX * isoMoveX + isoMoveY * isoMoveY);
                if (isoLen > 0) { isoMoveX /= isoLen; isoMoveY /= isoLen; }
                // Scale by 0.707 to match original forward speed feel
                isoMoveX *= 0.707; isoMoveY *= 0.707;
                this.lastIsoMoveX = isoMoveX;
                this.lastIsoMoveY = isoMoveY;

                const newX = this.x + isoMoveX * this.speed * (dt / 16);
                const newY = this.y + isoMoveY * this.speed * (dt / 16);

                if (world.canMoveTo(newX, this.y, this.island)) {
                    this.x = newX;
                }
                if (world.canMoveTo(this.x, newY, this.island)) {
                    this.y = newY;
                }

                if (Math.abs(dx) > Math.abs(dy)) {
                    this.facing = dx > 0 ? 'right' : 'left';
                } else {
                    this.facing = dy > 0 ? 'down' : 'up';
                }

                this.animTimer += dt;
                if (this.animTimer > 150) {
                    this.animTimer = 0;
                    this.animFrame = (this.animFrame + 1) % 4;
                }
            } else {
                this.state = 'idle';
                this.animFrame = 0;
            }

            // Apply barrier pushback (decays quickly)
            if (this.denyCooldown > 0) this.denyCooldown -= dt;
            if (Math.abs(this.pushbackVX) > 0.001 || Math.abs(this.pushbackVY) > 0.001) {
                const pbX = this.x + this.pushbackVX * (dt / 16);
                const pbY = this.y + this.pushbackVY * (dt / 16);
                if (world.canMoveTo(pbX, this.y, this.island)) this.x = pbX;
                if (world.canMoveTo(this.x, pbY, this.island)) this.y = pbY;
                this.pushbackVX *= 0.75;
                this.pushbackVY *= 0.75;
            }
        }
    }

    startLeap(toX, toY) {
        this.leaping = true;
        this.leapProgress = 0;
        this.leapFrom = { x: this.x, y: this.y };
        this.leapTo = { x: toX, y: toY };
        this.state = 'leaping';
    }

    hitShake() {
        this.hitShakeTimer = 180;
    }

    draw(ctx, camera) {
        const screen = camera.worldToScreen(this.x, this.y);
        const z = camera.zoom;

        // Leap arc offset
        const leapArc = this.leaping ? Math.sin(this.leapProgress * Math.PI) * LEAP_ARC * z : 0;

        // Shadow (shrinks during leap)
        const shadowScale = this.leaping ? (1 - Math.sin(this.leapProgress * Math.PI) * 0.6) : 1;
        ctx.fillStyle = `rgba(0,0,0,${0.3 * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 6 * z, 18 * z * shadowScale, 6 * z * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Player sprite — use animated GIF Image if available
        const isHarvesting = this.state === 'harvesting';
        const spriteKey = isHarvesting ? `${this.id}_tool` : `${this.id}_idle`;
        const img = this.sprites.getImg(spriteKey);

        const spriteSize = Math.floor(72 * z);
        // walkBob: left-right sway while walking
        const walkBob = this.state === 'walking' ? Math.sin(this.animTimer * 0.03) * 3 * z : 0;
        // idleBob: gentle up-down bounce when idle — abs(sin) so always bounces upward
        const idleBob = (this.state === 'idle') ? Math.abs(Math.sin(this.bobTimer * 0.8)) * 5 * z : 0;

        // drawY used for labels/UI elements only (no bob so label stays grounded)
        const drawY = screen.y - spriteSize + 8 * z - leapArc;
        const drawX = screen.x - spriteSize / 2;

        ctx.save();

        // Flash effect for power-ups
        if (this.flashTimer > 0 && Math.floor(this.flashTimer / 80) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        if (img) {
            const isImage = img instanceof HTMLImageElement;
            // Crop center of 1000x1000 GIF — 3:4 ratio crop
            const cropX = 200, cropY = 100, cropW = 600, cropH = 800;
            const drawW = spriteSize * 0.75;
            const drawH = spriteSize;
            const feetY = screen.y;
            // Directional lunge toward harvest target — alien bops INTO the resource
            let lungeX = 0, lungeY = 0;
            if (this.state === 'harvesting' && this.harvestTarget) {
                const tsc = camera.worldToScreen(this.harvestTarget.x, this.harvestTarget.y);
                const dx = tsc.x - screen.x;
                const dy = tsc.y - screen.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                // pow(abs(sin), 0.4) = sharp surge forward, slow return — "bonk" feel
                const lunge = Math.pow(Math.abs(Math.sin(this.harvestBobTimer * 0.014)), 0.4) * 11 * z;
                lungeX = (dx / len) * lunge;
                lungeY = (dy / len) * lunge;
            }
            const sprDrawY = feetY - drawH * 0.65 + walkBob - idleBob - leapArc + lungeY + this.hitShakeY * z;
            const sprDrawX = screen.x - drawW / 2 + lungeX + this.hitShakeX * z;
            if (this.facing === 'left') {
                // Center pivot matches sprDrawY + drawH/2
                ctx.translate(screen.x + lungeX + this.hitShakeX * z,
                    feetY - drawH * 0.65 + drawH / 2 + walkBob - idleBob - leapArc + lungeY + this.hitShakeY * z);
                ctx.scale(-1, 1);
                if (isImage && img.naturalWidth > 0) {
                    ctx.drawImage(img, cropX, cropY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH);
                } else {
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                }
            } else {
                if (isImage && img.naturalWidth > 0) {
                    ctx.drawImage(img, cropX, cropY, cropW, cropH, sprDrawX, sprDrawY, drawW, drawH);
                } else {
                    ctx.drawImage(img, screen.x - img.width / 2, sprDrawY + (drawH - img.height) / 2);
                }
            }
        }

        ctx.restore();

        // Held item indicator (above head)
        if (this.currentItem) {
            const iconSprite = this.sprites.get(`icon_${this.currentItem}`);
            if (iconSprite) {
                const icoSize = Math.floor(20 * z);
                ctx.drawImage(iconSprite, screen.x - icoSize / 2, drawY - icoSize * 0.4, icoSize, icoSize);
            }
        }

        // Harvest progress bar
        if (this.state === 'harvesting' && this.harvestProgress > 0) {
            const barW = Math.floor(36 * z);
            const barH = Math.floor(6 * z);
            const barX = screen.x - barW / 2;
            const barY = drawY - 4 * z;
            ctx.fillStyle = '#111';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
            ctx.fillStyle = '#222';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = '#00FFAA';
            ctx.fillRect(barX, barY, barW * this.harvestProgress, barH);
        }

        // Emote bubble
        if (this.emoteTimer > 0 && this.emoteText) {
            ctx.save();
            ctx.font = `${Math.floor(12 * z)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            const alpha = Math.min(1, this.emoteTimer / 300);
            ctx.globalAlpha = alpha;
            const tw = ctx.measureText(this.emoteText).width;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(screen.x - tw / 2 - 4, drawY - 30 * z - (1 - alpha) * 15, tw + 8, Math.floor(16 * z));
            ctx.fillStyle = '#FFF';
            ctx.fillText(this.emoteText, screen.x, drawY - 16 * z - (1 - alpha) * 15);
            ctx.restore();
        }

        // Player label
        ctx.save();
        ctx.font = `${Math.floor(10 * z)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.fillStyle = this.id === 'blue' ? '#88BBFF' : '#FF8888';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const label = this.id === 'blue' ? 'P1' : 'P2';
        ctx.strokeText(label, screen.x, drawY - 2 * z);
        ctx.fillText(label, screen.x, drawY - 2 * z);
        ctx.restore();

        // Carried alien indicator (mini sprite on back)
        if (this.carriedAlien) {
            const az = z * 0.35;
            const ax = screen.x + 8 * z;
            const ay = drawY + 5 * z + Math.sin(this.bobTimer * 1.5) * 2 * z;
            // Mini body
            ctx.fillStyle = this.carriedAlien.bodyColor;
            ctx.beginPath();
            ctx.roundRect(ax - 4 * az, ay - 2 * az, 8 * az, 10 * az, 2 * az);
            ctx.fill();
            // Mini head
            ctx.beginPath();
            ctx.arc(ax, ay - 4 * az, 4 * az, 0, Math.PI * 2);
            ctx.fill();
            // Visor
            ctx.fillStyle = this.carriedAlien.eyeColor;
            ctx.fillRect(ax - 2.5 * az, ay - 5 * az, 5 * az, 2 * az);
            // "!" indicator
            ctx.fillStyle = '#FFDD44';
            ctx.font = `${Math.floor(6 * z)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.fillText('!', ax, ay - 8 * az);
        }
    }
}

// Tossed item in flight
export class TossedItem {
    constructor(material, fromX, fromY, toX, toY) {
        this.material = material;
        this.fromX = fromX;
        this.fromY = fromY;
        this.toX = toX;
        this.toY = toY;
        this.x = fromX;
        this.y = fromY;
        this.progress = 0;
        this.speed = TOSS_SPEED;
        this.arcHeight = TOSS_ARC_HEIGHT;
        this.alive = true;
        this.totalDist = dist(fromX, fromY, toX, toY);
        this.duration = Math.max(500, this.totalDist * 150);
        this.elapsed = 0;
    }

    update(dt) {
        this.elapsed += dt;
        this.progress = Math.min(1, this.elapsed / this.duration);
        this.x = lerp(this.fromX, this.toX, this.progress);
        this.y = lerp(this.fromY, this.toY, this.progress);

        if (this.progress >= 1) {
            this.alive = false;
        }
    }

    getScreenY(camera) {
        const screen = camera.worldToScreen(this.x, this.y);
        // Arc: parabola peaking at midpoint
        const arc = Math.sin(this.progress * Math.PI) * this.arcHeight;
        return screen.y - arc;
    }

    draw(ctx, camera, sprites) {
        const screen = camera.worldToScreen(this.x, this.y);
        const z = camera.zoom;
        const arc = Math.sin(this.progress * Math.PI) * this.arcHeight * z;
        const drawY = screen.y - arc;

        // Shadow on ground
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 3 * z, 6 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Item
        const icoSize = Math.floor(18 * z);
        const icon = sprites.get(`icon_${this.material}`);
        if (icon) {
            ctx.drawImage(icon, screen.x - icoSize / 2, drawY - icoSize / 2, icoSize, icoSize);
        } else {
            ctx.fillStyle = MAT_COLORS[this.material] || '#FFF';
            ctx.fillRect(screen.x - icoSize / 3, drawY - icoSize / 3, icoSize * 0.66, icoSize * 0.66);
        }

        // Sparkle trail
        ctx.fillStyle = MAT_COLORS[this.material] || '#FFF';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(screen.x - 1 + Math.random() * 3, drawY + Math.random() * 6, 3, 3);
        ctx.globalAlpha = 1;
    }
}
