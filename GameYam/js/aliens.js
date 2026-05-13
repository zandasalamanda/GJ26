// ============================================
// FLAT-EARTHRZ — Mini Alien Population System
// ============================================

import { dist, randRange, randInt, ISLANDS } from './utils.js';

// ---- Individual Alien ----
export class MiniAlien {
    constructor(island, x, y, id) {
        this.island = island;       // 'blue' or 'red'
        this.id = id;               // unique identifier
        this.x = x;
        this.y = y;
        this.homeX = x;
        this.homeY = y;
        this.alive = true;
        this.safe = false;          // true when on hub island
        this.carried = false;       // true when being carried by player
        this.carriedBy = null;      // reference to carrying player

        // Roaming AI
        this.targetX = x;
        this.targetY = y;
        this.roamTimer = randRange(1000, 3000);
        this.speed = 0.03;          // slow wander

        // Panic state
        this.panicking = false;
        this.panicTimer = 0;

        // Animation
        this.bobTimer = 0;
        this.direction = 1;         // 1 = right, -1 = left
        this.emoteText = '';
        this.emoteTimer = 0;
        this.bodyColor = island === 'blue' ? '#44BBDD' : '#DD5533';
        this.eyeColor = island === 'blue' ? '#AAEEFF' : '#FFAA88';

        // Cute sound timer
        this.soundTimer = randRange(2000, 8000);
    }

    update(dt, world, showerTimer) {
        this.bobTimer += dt * 0.003;

        // Emote decay
        if (this.emoteTimer > 0) this.emoteTimer -= dt;

        // If carried, don't move independently
        if (this.carried) return;


        // Check if close to shower — panic!
        if (showerTimer > 0 && showerTimer < 5000 && !this.safe) {
            if (!this.panicking) {
                this.panicking = true;
                this.showEmote('!!!');
            }
            this.panicTimer += dt;
            // Erratic movement
            if (this.panicTimer > 400) {
                this.panicTimer = 0;
                const angle = randRange(0, Math.PI * 2);
                this.targetX = this.x + Math.cos(angle) * randRange(1, 2);
                this.targetY = this.y + Math.sin(angle) * randRange(1, 2);
            }
            this.speed = 0.08; // Faster when panicking
        } else {
            this.panicking = false;
            this.speed = 0.03;
        }

        // Roaming AI
        this.roamTimer -= dt;
        if (this.roamTimer <= 0) {
            this.roamTimer = randRange(2000, 5000);
            // Pick random nearby target on same island
            const island = ISLANDS[this.island];
            if (island) {
                const angle = randRange(0, Math.PI * 2);
                const r = randRange(0.5, island.radius * 0.7);
                this.targetX = island.cx + Math.cos(angle) * r;
                this.targetY = island.cy + Math.sin(angle) * r;
            }
        }

        // If safe on hub, roam the hub instead
        if (this.safe) {
            this.roamTimer -= dt;
            if (this.roamTimer <= 0) {
                this.roamTimer = randRange(3000, 6000);
                const hub = ISLANDS.hub;
                const angle = randRange(0, Math.PI * 2);
                const r = randRange(0.5, hub.radius * 0.5);
                this.targetX = hub.cx + Math.cos(angle) * r;
                this.targetY = hub.cy + Math.sin(angle) * r;
            }
        }

        // Move toward target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.2) {
            const mx = (dx / d) * this.speed;
            const my = (dy / d) * this.speed;
            const newX = this.x + mx;
            const newY = this.y + my;
            // Check walkability
            if (world.isWalkable(Math.floor(newX), Math.floor(newY))) {
                this.x = newX;
                this.y = newY;
                this.direction = mx > 0 ? 1 : mx < 0 ? -1 : this.direction;
            } else {
                // Stuck — pick new target
                this.roamTimer = 0;
            }
        }
    }

    draw(ctx, camera, sprites) {
        if (this.carried) return; // drawn on player instead

        const sc = camera.worldToScreen(this.x, this.y);
        if (!camera.isOnScreen(sc.x, sc.y)) return;
        const z = camera.zoom;
        const bob = Math.sin(this.bobTimer * 4) * 2 * z;
        
        // Use player GIF sprite at smaller scale
        const spriteKey = `${this.island}_idle`;
        const img = sprites ? sprites.getImg(spriteKey) : null;
        
        const spriteSize = Math.floor(40 * z); // Smaller than player (72 * z)
        const drawY = sc.y;
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(sc.x, sc.y + 1 * z, 5 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        if (img) {
            ctx.save();
            const isImage = img instanceof HTMLImageElement;
            const cropX = 200, cropY = 100, cropW = 600, cropH = 800;
            const drawW = spriteSize * 0.75;
            const drawH = spriteSize;
            const sprDrawY = sc.y - drawH * 0.65 + bob;
            const sprDrawX = sc.x - drawW / 2;

            if (this.panicking) {
                // Flash when panicking
                if (Math.sin(this.bobTimer * 30) > 0) {
                    ctx.globalAlpha = 0.5;
                }
            }

            if (this.direction < 0) { // Facing left
                ctx.translate(sc.x, sc.y - drawH * 0.65 + drawH / 2 + bob);
                ctx.scale(-1, 1);
                if (isImage && img.naturalWidth > 0) {
                    ctx.drawImage(img, cropX, cropY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH);
                } else {
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                }
            } else { // Facing right
                if (isImage && img.naturalWidth > 0) {
                    ctx.drawImage(img, cropX, cropY, cropW, cropH, sprDrawX, sprDrawY, drawW, drawH);
                } else {
                    ctx.drawImage(img, sc.x - img.width / 2, sprDrawY + (drawH - img.height) / 2);
                }
            }
            ctx.restore();
        }

        // Safe indicator
        if (this.safe) {
            ctx.fillStyle = '#44FF88';
            ctx.font = `${Math.floor(6 * z)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.fillText('✓', sc.x, sc.y - spriteSize * 0.8 + bob);
        }

        // Emote
        if (this.emoteTimer > 0 && this.emoteText) {
            ctx.fillStyle = '#FFF';
            ctx.font = `${Math.floor(5 * z)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.globalAlpha = Math.min(1, this.emoteTimer / 300);
            ctx.fillText(this.emoteText, sc.x, sc.y - spriteSize + bob);
            ctx.globalAlpha = 1;
        }
    }

    showEmote(text) {
        this.emoteText = text;
        this.emoteTimer = 1500;
    }

    static playDeathSound() {
        try {
            if (!MiniAlien._audioCtx) {
                MiniAlien._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = MiniAlien._audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Sad low drop noise
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
            osc.type = 'sawtooth';
            
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch(e) {}
    }

    // Place alien on hub as safe
    markSafe() {
        this.safe = true;
        this.carried = false;
        this.carriedBy = null;
        // Position on hub
        const hub = ISLANDS.hub;
        this.x = hub.cx + randRange(-2, 2);
        this.y = hub.cy + randRange(-2, 2);
        this.targetX = this.x;
        this.targetY = this.y;
        this.showEmote('SAFE!');
    }

    // Return to home island (when game resets or after shower if alive)
    returnHome() {
        this.safe = false;
        this.carried = false;
        this.carriedBy = null;
        this.x = this.homeX;
        this.y = this.homeY;
        this.targetX = this.homeX;
        this.targetY = this.homeY;
    }
}

// ---- Population Manager ----
export class AlienPopulationManager {
    constructor() {
        this.blueAliens = [];
        this.redAliens = [];
        this.blueHunger = 100;      // 0-100, starts full
        this.redHunger = 100;
        this.hungerDecayRate = 0.4;  // per second
        this.feedAmount = 25;        // hunger restored per feeding
        this.debuffs = [];           // active debuffs from lost aliens
    }

    init(world) {
        this.blueAliens = [];
        this.redAliens = [];
        this.blueHunger = 100;
        this.redHunger = 100;
        this.debuffs = [];

        // Spawn 5 blue aliens on blue island
        const blueSpots = world.getSpawnPositions('blue', 5);
        for (let i = 0; i < blueSpots.length; i++) {
            this.blueAliens.push(new MiniAlien('blue', blueSpots[i].x, blueSpots[i].y, `blue_${i}`));
        }

        // Spawn 5 red aliens on red island
        const redSpots = world.getSpawnPositions('red', 5);
        for (let i = 0; i < redSpots.length; i++) {
            this.redAliens.push(new MiniAlien('red', redSpots[i].x, redSpots[i].y, `red_${i}`));
        }
    }

    get allAliens() {
        return [...this.blueAliens, ...this.redAliens];
    }

    get blueSafeCount() {
        return this.blueAliens.filter(a => a.safe || a.carried).length;
    }

    get redSafeCount() {
        return this.redAliens.filter(a => a.safe || a.carried).length;
    }

    get blueAliveCount() {
        return this.blueAliens.filter(a => a.alive).length;
    }

    get redAliveCount() {
        return this.redAliens.filter(a => a.alive).length;
    }

    update(dt, world, showerTimer) {
        // Update all aliens
        for (const alien of this.allAliens) {
            if (!alien.alive) continue;
            alien.update(dt, world, showerTimer);
        }

        // Hunger decay
        const decay = this.hungerDecayRate * (dt / 1000);
        this.blueHunger = Math.max(0, this.blueHunger - decay);
        this.redHunger = Math.max(0, this.redHunger - decay);

        // Starvation logic
        if (!this.starvationTimer) this.starvationTimer = 0;
        
        if (this.blueHunger === 0 || this.redHunger === 0) {
            this.starvationTimer += dt;
            if (this.starvationTimer > 8000) { // Die every 8 seconds at 0 food
                this.starvationTimer = 0;
                
                // Try to kill a blue alien
                if (this.blueHunger === 0) {
                    const aliveBlue = this.blueAliens.filter(a => a.alive && !a.safe);
                    if (aliveBlue.length > 0) {
                        aliveBlue[0].alive = false;
                        MiniAlien.playDeathSound();
                    }
                }
                
                // Try to kill a red alien
                if (this.redHunger === 0) {
                    const aliveRed = this.redAliens.filter(a => a.alive && !a.safe);
                    if (aliveRed.length > 0) {
                        aliveRed[0].alive = false;
                        MiniAlien.playDeathSound();
                    }
                }
            }
        } else {
            this.starvationTimer = 0;
        }
    }

    // Feed a population
    feedBlue() {
        this.blueHunger = Math.min(100, this.blueHunger + this.feedAmount);
    }

    feedRed() {
        this.redHunger = Math.min(100, this.redHunger + this.feedAmount);
    }

    // Get speed multiplier based on hunger
    getSpeedMultiplier(playerIsland) {
        const hunger = playerIsland === 'blue' ? this.blueHunger : this.redHunger;
        if (hunger <= 25) return 0.5;       // Very slow
        if (hunger <= 50) return 0.75;      // Slow
        return 1.0;                          // Normal
    }

    // Kill aliens that aren't safe when a shower hits
    processShowerDamage() {
        const lost = [];
        for (const alien of this.allAliens) {
            if (!alien.alive) continue;
            if (alien.carried) {
                // Drop carried alien — they're lost
                alien.carried = false;
                alien.carriedBy = null;
            }
            if (!alien.safe) {
                alien.alive = false;
                lost.push(alien);
            }
        }

        // Apply debuffs for each lost alien
        const DEBUFF_TYPES = ['slowness', 'harvest_fatigue', 'inventory_shrink', 'no_toss', 'resource_drain'];
        for (const alien of lost) {
            const type = DEBUFF_TYPES[randInt(0, DEBUFF_TYPES.length - 1)];
            this.debuffs.push({
                type,
                source: alien.island,
                duration: 60000, // 60s debuff
                timer: 60000,
            });
        }

        return lost.length;
    }

    // Return all surviving aliens to their home islands after shower
    returnSurvivorsHome() {
        for (const alien of this.allAliens) {
            if (!alien.alive) continue;
            alien.returnHome();
        }
    }

    // Find nearest alien to a position (for pickup)
    findNearestAlien(x, y, playerIsland, maxDist = 1.5) {
        const pool = playerIsland === 'blue' ? this.blueAliens : this.redAliens;
        let nearest = null;
        let nearestDist = maxDist;
        for (const alien of pool) {
            if (!alien.alive || alien.carried) continue;
            const d = dist(x, y, alien.x, alien.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = alien;
            }
        }
        return nearest;
    }

    // Try to pick up nearest alien
    pickupAlien(player, showerTimer) {
        // Only allow pickup within 45s of shower
        if (showerTimer > 45000) return null;

        // Check if player already carrying
        if (player.carriedAlien) return null;

        const alien = this.findNearestAlien(player.x, player.y, player.id);
        if (!alien) return null;

        alien.carried = true;
        alien.carriedBy = player;
        player.carriedAlien = alien;
        alien.showEmote('HELP!');
        return alien;
    }

    // Drop alien at current position (or mark safe if on hub)
    dropAlien(player, world) {
        if (!player.carriedAlien) return null;
        const alien = player.carriedAlien;
        alien.carried = false;
        alien.carriedBy = null;
        alien.x = player.x;
        alien.y = player.y;
        alien.targetX = player.x;
        alien.targetY = player.y;
        player.carriedAlien = null;

        // Check if dropped on hub — mark safe
        const tile = world.getTile(Math.floor(player.x), Math.floor(player.y));
        if (tile === 3) { // T.HUB
            alien.markSafe();
            return { safe: true, alien };
        }

        alien.showEmote('...');
        return { safe: false, alien };
    }

    // Update debuff timers
    updateDebuffs(dt) {
        for (let i = this.debuffs.length - 1; i >= 0; i--) {
            this.debuffs[i].timer -= dt;
            if (this.debuffs[i].timer <= 0) {
                this.debuffs.splice(i, 1);
            }
        }
    }

    // Check if a specific debuff type is active
    hasDebuff(type) {
        return this.debuffs.some(d => d.type === type);
    }

    draw(ctx, camera) {
        for (const alien of this.allAliens) {
            if (!alien.alive) continue;
            alien.draw(ctx, camera);
        }
    }
}
