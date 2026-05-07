// ============================================
// ALIEN ASSEMBLY LINE — Main Game
// ============================================
import { GAME_W, GAME_H, ISLANDS, TOTAL_ROUNDS, HARVEST_TIME, HARVEST_TIME_FRENZY, CRAFT_TIME, MAT_COLORS, MAT_NAMES, dist, lerp, isoToScreen, CONSTRUCTION_RECIPES, PROCESSING_RECIPES, POWERUP_TYPES, POWERUP_DURATION, POWERUP_SPAWN_INTERVAL, LEAP_ZONES, randRange, randInt, pick } from './utils.js';
import { InputManager } from './input.js';
import { SpriteManager } from './sprites.js';
import { Camera } from './camera.js';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { World, T } from './world.js';
import { ResourceManager } from './resources.js';
import { Player, TossedItem } from './player.js';
import { CraftingSystem } from './crafting.js';
import { OrderManager } from './orders.js';
import { UIManager } from './ui.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = GAME_W;
canvas.height = GAME_H;
ctx.imageSmoothingEnabled = false;

// Scale canvas to fill window
function resize() {
    const s = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
    canvas.style.width = Math.floor(GAME_W * s) + 'px';
    canvas.style.height = Math.floor(GAME_H * s) + 'px';
}
window.addEventListener('resize', resize);
resize();

// ---- Game State ----
const STATE = { LOADING: 0, TITLE: 1, PLAYING: 2, PAUSED: 3, ROUND_END: 4, GAME_OVER: 5, CRAFTING: 6 };
let state = STATE.LOADING;
let gameTime = 0;
let roundStarsTotal = 0;
let currentRound = 0;

// ---- Systems ----
const input = new InputManager();
const sprites = new SpriteManager();
const camera = new Camera();
const particles = new ParticleSystem();
const audio = new AudioManager();
let world, resources, crafting, orders, ui;
let player1, player2, players;
let tossedItems = [];
let powerups = [];
let powerupTimer = 0;
let hazardTimer = 0;
let hazardActive = null;
let roundSummary = null;
let craftingPlayer = null;

// Machine positions (tile coords)
const CRAFTER_POS = { x: ISLANDS.hub.cx - 1, y: ISLANDS.hub.cy - 1 };
const FURNACE_POS = { x: ISLANDS.hub.cx + 2, y: ISLANDS.hub.cy - 1 };
const DELIVERY_POS = { x: ISLANDS.hub.cx, y: ISLANDS.hub.cy + 2 };

// ---- Init ----
async function init() {
    await sprites.load((p, t) => {
        const bar = document.getElementById('loading-bar');
        const txt = document.getElementById('loading-text');
        if (bar) bar.style.width = (p * 100) + '%';
        if (txt) txt.textContent = t;
    });
    world = new World(sprites);
    resources = new ResourceManager(world, sprites);
    crafting = new CraftingSystem();
    orders = new OrderManager(crafting);
    ui = new UIManager(sprites);
    setupPlayers();
    state = STATE.TITLE;
    document.getElementById('loading-screen').classList.add('hidden');
    requestAnimationFrame(loop);
}

function setupPlayers() {
    player1 = new Player('blue', 'blue', sprites);
    player2 = new Player('red', 'red', sprites);
    const bc = world.getIslandCenter('blue');
    const rc = world.getIslandCenter('red');
    player1.x = bc.x; player1.y = bc.y;
    player2.x = rc.x; player2.y = rc.y;
    players = [player1, player2];
    camera.snapTo((bc.x + rc.x) / 2, (bc.y + rc.y) / 2);
}

function startRound(roundNum) {
    currentRound = roundNum;
    resources.spawnInitial();
    orders.startRound(roundNum);
    tossedItems = [];
    powerups = [];
    powerupTimer = POWERUP_SPAWN_INTERVAL;
    hazardActive = null;
    state = STATE.PLAYING;
    audio.init();
    audio.resume();
    audio.startMusic();
}

// ---- Main Loop ----
let lastTime = 0;
function loop(timestamp) {
    const dt = Math.min(timestamp - (lastTime || timestamp), 33);
    lastTime = timestamp;
    gameTime = timestamp;
    input.update();

    switch (state) {
        case STATE.TITLE: updateTitle(); break;
        case STATE.PLAYING: updatePlaying(dt); break;
        case STATE.PAUSED: updatePaused(); break;
        case STATE.ROUND_END: updateRoundEnd(); break;
        case STATE.GAME_OVER: updateGameOver(); break;
    }
    requestAnimationFrame(loop);
}

// ---- Title ----
let titleMusicStarted = false;
function updateTitle() {
    // Start title music on first interaction
    if (!titleMusicStarted && input.anyKeyPressed()) {
        audio.init(); audio.resume();
        audio.startMusic();
        titleMusicStarted = true;
    }
    if (input.confirm()) {
        audio.init(); audio.resume();
        if (!titleMusicStarted) { audio.startMusic(); titleMusicStarted = true; }
        setupPlayers();
        resources.nodes = [];
        roundStarsTotal = 0;
        startRound(0);
    }
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    ui.drawTitleScreen(ctx, gameTime);
}

// ---- Playing ----
function updatePlaying(dt) {
    // ESC: close craft menus first, then pause
    if (input.pause()) {
        if (player1.craftMenuOpen) { player1.craftMenuOpen = false; return; }
        if (player2.craftMenuOpen) { player2.craftMenuOpen = false; return; }
        state = STATE.PAUSED; return;
    }

    // Per-player craft menu input (handled BEFORE movement so nav keys don't move)
    handleCraftMenuInput(player1,
        input.isJustPressed('KeyW'), input.isJustPressed('KeyS'),
        input.isJustPressed('KeyE'), input.isJustPressed('KeyF'));
    handleCraftMenuInput(player2,
        input.isJustPressed('ArrowUp'), input.isJustPressed('ArrowDown'),
        input.isJustPressed('Slash'), input.isJustPressed('Comma'));

    // Movement — freeze player while their menu is open
    const m1 = player1.craftMenuOpen ? { dx: 0, dy: 0 } : input.getP1Movement();
    const m2 = player2.craftMenuOpen ? { dx: 0, dy: 0 } : input.getP2Movement();
    player1.update(dt, m1, world);
    player2.update(dt, m2, world);

    // Player actions
    handlePlayerActions(player1, input.p1Interact(), input.p1Toss(), input.p1Craft(), input.p1Process(), input.p1CycleLeft(), input.p1CycleRight(), dt);
    handlePlayerActions(player2, input.p2Interact(), input.p2Toss(), input.p2Craft(), input.p2Process(), input.p2CycleLeft(), input.p2CycleRight(), dt);

    // Resources
    resources.update(dt);

    // Tossed items
    for (let i = tossedItems.length - 1; i >= 0; i--) {
        const item = tossedItems[i];
        item.update(dt);
        particles.emitTossTrail(
            ...Object.values(camera.worldToScreen(item.x, item.y)),
            MAT_COLORS[item.material]
        );
        if (!item.alive) {
            // Land - try to give to nearest player or drop
            handleItemLand(item);
            tossedItems.splice(i, 1);
        }
    }

    // Orders
    orders.update(dt);
    if (orders.currentOrder && orders.currentOrder.urgent) {
        if (Math.floor(gameTime / 500) % 2 === 0) audio.playTimerWarning();
    }
    if (orders.roundComplete) {
        roundSummary = orders.getRoundSummary();
        roundStarsTotal += roundSummary.totalStars;
        audio.stopMusic();
        audio.playOrderComplete();
        state = STATE.ROUND_END;
    }

    // Power-up spawning
    powerupTimer -= dt;
    if (powerupTimer <= 0) {
        spawnPowerup();
        powerupTimer = POWERUP_SPAWN_INTERVAL + randRange(-3000, 3000);
    }
    updatePowerups(dt);

    // Leap detection — check if players are near leap zones
    checkLeapZone(player1);
    checkLeapZone(player2);

    // Camera
    camera.followPlayers(player1.x, player1.y, player2.x, player2.y);
    camera.zoomSmoothing = 0.04;
    camera.update(dt);

    // Particles
    particles.update(dt);

    // Ambient trail — world-space so particles stay behind as player moves
    if (Math.random() < 0.30) {
        const iso = isoToScreen(player1.x, player1.y);
        particles.emitAmbientTrail(iso.x, iso.y, '#44DDFF99', 1);
    }
    if (Math.random() < 0.30) {
        const iso = isoToScreen(player2.x, player2.y);
        particles.emitAmbientTrail(iso.x, iso.y, '#FF664499', 1);
    }

    // UI
    ui.update(dt);

    // ---- Draw ----
    drawPlayingScene();
}

function handlePlayerActions(player, interact, toss, craft, process, cycleL, cycleR, dt) {
    if (cycleL) player.cycleSlot(-1);
    if (cycleR) player.cycleSlot(1);

    // Harvesting
    if (interact) {
        const node = resources.findNearest(player.x, player.y, 1.8);
        if (node) {
            if (player.inventoryFull) {
                player.showEmote('FULL!');
                audio.playError();
            } else {
                player.state = 'harvesting';
                player.harvestTarget = node;
                player.harvestProgress = 0;
            }
        } else {
            // Check delivery
            const dd = dist(player.x, player.y, DELIVERY_POS.x, DELIVERY_POS.y);
            if (dd < 2 && orders.currentOrder) {
                // Try to deliver current crafted item name
                // Player needs to have crafted item result stored - use selectedItem matching order name
                tryDeliver(player);
            }
        }
    }

    // Continue harvesting
    if (player.state === 'harvesting' && player.harvestTarget) {
        const harvestTime = player.harvestFrenzy ? HARVEST_TIME_FRENZY : HARVEST_TIME;
        player.harvestProgress += dt / harvestTime;
        if (player.harvestProgress >= 1) {
            const mat = player.harvestTarget.hit();
            if (mat) {
                const qty = player.doubleYield ? 2 : 1;
                for (let i = 0; i < qty; i++) player.addItem(mat);
                const sc = camera.worldToScreen(player.harvestTarget.x, player.harvestTarget.y);
                particles.emitHarvestSparks(sc.x, sc.y, MAT_COLORS[mat]);
                ui.addFloatingText(sc.x, sc.y - 10, `+${qty} ${MAT_NAMES[mat]}`, MAT_COLORS[mat]);
                audio.playChop();
                camera.shake(2, 100);
                player.hitShake(); // shake on successful hit
            } else {
                const sc = camera.worldToScreen(player.harvestTarget.x, player.harvestTarget.y);
                particles.emitNodeShake(sc.x, sc.y, MAT_COLORS[player.harvestTarget.info.material]);
                audio.playMine();
                player.hitShake(); // shake on every strike
            }
            if (!player.harvestTarget.alive || player.inventoryFull) {
                player.state = 'idle';
                player.harvestTarget = null;
            }
            player.harvestProgress = 0;
        }
    }

    // Stop harvesting if moving
    const isMoving = (player === player1 ? input.getP1Movement() : input.getP2Movement());
    if ((isMoving.dx !== 0 || isMoving.dy !== 0) && player.state === 'harvesting') {
        player.state = 'idle';
        player.harvestTarget = null;
        player.harvestProgress = 0;
    }

    // Toss
    if (toss && player.currentItem) {
        const mat = player.removeSelectedItem();
        if (mat) {
            // Toss toward hub center
            const ti = new TossedItem(mat, player.x, player.y, DELIVERY_POS.x, DELIVERY_POS.y);
            tossedItems.push(ti);
            audio.playToss();
            player.showEmote('TOSS!');
        }
    }

    // Craft (at crafter machine) — toggle player's own menu
    if (craft) {
        const dCrafter = dist(player.x, player.y, CRAFTER_POS.x, CRAFTER_POS.y);
        if (dCrafter < 2.5) {
            if (player.craftMenuOpen && player.craftMenuMode === 'craft') {
                player.craftMenuOpen = false;
            } else {
                player.craftMenuOpen = true;
                player.craftMenuMode = 'craft';
                player.craftMenuSelection = 0;
            }
        } else {
            player.showEmote('Go to Crafter!');
        }
    }

    // Process (at furnace/crafter) — toggle player's own menu
    if (process) {
        const dCrafter = dist(player.x, player.y, CRAFTER_POS.x, CRAFTER_POS.y);
        const dFurnace = dist(player.x, player.y, FURNACE_POS.x, FURNACE_POS.y);
        if (dCrafter < 2.5 || dFurnace < 2.5) {
            if (player.craftMenuOpen && player.craftMenuMode === 'process') {
                player.craftMenuOpen = false;
            } else {
                player.craftMenuOpen = true;
                player.craftMenuMode = 'process';
                player.craftMenuSelection = 0;
            }
        } else {
            player.showEmote('Go to Machine!');
        }
    }
}

function handleItemLand(item) {
    audio.playLand();
    const sc = camera.worldToScreen(item.toX, item.toY);
    particles.emitHarvestSparks(sc.x, sc.y, MAT_COLORS[item.material], 4);

    // Check if any player is near the landing spot
    for (const p of players) {
        if (dist(p.x, p.y, item.toX, item.toY) < 2.5) {
            if (p.addItem(item.material)) {
                p.showEmote('CAUGHT!');
                audio.playPickup();
                return;
            }
        }
    }
    // Item lands on ground - give to any player on hub
    for (const p of players) {
        const t = world.getTile(Math.floor(p.x), Math.floor(p.y));
        if (t === T.HUB && !p.inventoryFull) {
            p.addItem(item.material);
            p.showEmote('+' + MAT_NAMES[item.material]);
            return;
        }
    }
    // Lost to void
    ui.addNotification('Item lost to the void!', '#FF4444');
}

function tryDeliver(player) {
    if (!orders.currentOrder) return;
    const orderName = orders.currentOrder.itemName;
    // Player's "crafted items" are tracked via a special tag in inventory
    // For simplicity, we check if the player has a crafted item matching
    const idx = player.inventory.indexOf('crafted_' + orderName);
    if (idx >= 0) {
        player.inventory.splice(idx, 1);
        if (player.selectedSlot >= player.inventory.length) player.selectedSlot = Math.max(0, player.inventory.length - 1);
        orders.deliverItem(orderName);
        const sc = camera.worldToScreen(DELIVERY_POS.x, DELIVERY_POS.y);
        particles.emitDeliveryBurst(sc.x, sc.y);
        audio.playDeliver();
        camera.shake(3, 150);
        ui.addNotification(`Delivered ${orderName}!`, '#00FFAA');
        if (orders.combo >= 2) {
            audio.playCombo();
            ui.addNotification(`COMBO x${orders.combo}!`, '#FFD700');
        }
    } else {
        player.showEmote('Need: ' + orderName);
        audio.playError();
    }
}

// ---- Per-Player Craft Menu Input ----
function handleCraftMenuInput(player, navUp, navDown, confirm, close) {
    if (!player.craftMenuOpen) return;
    const recipes = player.craftMenuMode === 'craft'
        ? crafting.getAvailableRecipes() : PROCESSING_RECIPES;
    if (navUp)   { player.craftMenuSelection = Math.max(0, player.craftMenuSelection - 1); audio.playUIClick(); }
    if (navDown) { player.craftMenuSelection = Math.min(recipes.length - 1, player.craftMenuSelection + 1); audio.playUIClick(); }
    if (close)   { player.craftMenuOpen = false; return; }
    if (confirm) {
        const idx = player.craftMenuSelection;
        if (player.craftMenuMode === 'craft') {
            if (crafting.canCraft(player, idx)) {
                const name = crafting.craft(player, idx);
                if (name) {
                    player.addItem('crafted_' + name);
                    const sc = camera.worldToScreen(CRAFTER_POS.x, CRAFTER_POS.y);
                    particles.emitCraftBurst(sc.x, sc.y);
                    audio.playCraft();
                    camera.shake(2, 100);
                    ui.addNotification(`${player.id === 'blue' ? 'P1' : 'P2'} crafted ${name}!`, '#00FFAA');
                    player.showEmote(name + '!');
                }
            } else {
                audio.playError();
                player.showEmote('Need materials!');
            }
        } else {
            if (crafting.canProcess(player, idx)) {
                const result = crafting.process(player, idx);
                if (result) {
                    const sc = camera.worldToScreen(FURNACE_POS.x, FURNACE_POS.y);
                    particles.emitCraftBurst(sc.x, sc.y, 10);
                    audio.playCraft();
                    ui.addNotification(`Processed: ${result.name}!`, '#44AAFF');
                }
            } else {
                audio.playError();
            }
        }
    }
}

// ---- Power-ups ----
function spawnPowerup() {
    const islands = ['blue', 'red'];
    const island = pick(islands);
    const positions = world.getSpawnPositions(island, 1);
    if (positions.length === 0) return;
    const pos = positions[0];
    const types = Object.keys(POWERUP_TYPES);
    const type = pick(types);
    powerups.push({ x: pos.x, y: pos.y, type, timer: 15000, bobTimer: 0 });
}

function updatePowerups(dt) {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.timer -= dt;
        p.bobTimer += dt * 0.005;
        if (p.timer <= 0) { powerups.splice(i, 1); continue; }

        // Check player collision
        for (const player of players) {
            if (dist(player.x, player.y, p.x, p.y) < 1.5) {
                applyPowerup(player, p.type);
                powerups.splice(i, 1);
                break;
            }
        }
    }
}

function applyPowerup(player, type) {
    const info = POWERUP_TYPES[type];
    audio.playPowerup();
    const sc = camera.worldToScreen(player.x, player.y);
    particles.emitPowerupCollect(sc.x, sc.y, info.color);
    ui.addNotification(`${info.name}!`, info.color);
    player.showEmote(info.icon);
    player.flashTimer = 500;

    switch (type) {
        case 'SPEED': player.speedBoosted = true; player.powerupTimers.speed = POWERUP_DURATION; break;
        case 'FRENZY': player.harvestFrenzy = true; player.powerupTimers.frenzy = POWERUP_DURATION; break;
        case 'DOUBLE': player.doubleYield = true; player.powerupTimers.double = POWERUP_DURATION; break;
        case 'TIME_WARP':
            if (orders.currentOrder) { orders.currentOrder.timeRemaining += 20; orders.currentOrder.timeLimit += 20; }
            break;
    }
}

// ---- Pause / Round End / Game Over ----
function updatePaused() {
    if (input.pause()) { state = STATE.PLAYING; return; }
    drawPlayingScene();
    ui.drawPauseOverlay(ctx);
}

function updateRoundEnd() {
    if (input.confirm()) {
        if (currentRound + 1 >= TOTAL_ROUNDS) {
            state = STATE.GAME_OVER;
        } else {
            setupPlayers();
            resources.nodes = [];
            startRound(currentRound + 1);
        }
        return;
    }
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    if (roundSummary) ui.drawRoundResults(ctx, roundSummary, gameTime);
}

function updateGameOver() {
    if (input.confirm()) { state = STATE.TITLE; return; }
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    ui.drawGameOver(ctx, roundStarsTotal, TOTAL_ROUNDS, gameTime);
}

// ---- Leap Zone Detection ----
function checkLeapZone(player) {
    if (player.leaping) return;
    if (player.leapCooldown > 0) return;
    if (player.state !== 'walking') return;

    for (const zone of LEAP_ZONES) {
        const d = dist(player.x, player.y, zone.from.x, zone.from.y);
        if (d > 1.2) continue;

        // Compute normalized leap direction
        const ldx = zone.to.x - zone.from.x;
        const ldy = zone.to.y - zone.from.y;
        const len = Math.sqrt(ldx * ldx + ldy * ldy);
        const dot = (player.lastIsoMoveX * ldx + player.lastIsoMoveY * ldy) / len;
        if (dot < 0.3) continue;

        if (!zone.allowedPlayers.includes(player.id)) {
            // BARRIER — deny and push back
            if (player.denyCooldown > 0) return; // don't spam
            player.denyCooldown = 1200;
            // Push in the opposite direction of the leap
            player.pushbackVX = -(ldx / len) * 0.18;
            player.pushbackVY = -(ldy / len) * 0.18;
            player.hitShake();
            player.showEmote('🚫 RESTRICTED', 1200);
            audio.playDeny();
            // Red flash burst at the edge
            const sc = camera.worldToScreen(zone.from.x, zone.from.y);
            particles.emitHarvestSparks(sc.x, sc.y, '#FF2244', 6);
            return;
        }

        // Permitted — do the leap
        player.startLeap(zone.to.x, zone.to.y);
        audio.playLeap();
        const sc = camera.worldToScreen(player.x, player.y);
        particles.emitHarvestSparks(sc.x, sc.y, player.id === 'blue' ? '#44DDFF' : '#FF6644', 8);
        return;
    }
}


// ---- Render ----
const SPLIT_DIST   = 20;
const UNSPLIT_DIST = 15;
const SPLIT_ZOOM   = 1.4; // per-player viewport zoom when split
let isSplit = false;

function drawPlayingScene() {
    const playerDist = dist(player1.x, player1.y, player2.x, player2.y);

    // Instant commit — no blend, no fade
    if (!isSplit && playerDist > SPLIT_DIST) isSplit = true;
    if (isSplit && playerDist < UNSPLIT_DIST) isSplit = false;

    ctx.clearRect(0, 0, GAME_W, GAME_H);
    ctx.fillStyle = '#080818';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    if (!isSplit) {
        drawSceneWithCamera(0, 0, GAME_W, GAME_H, camera);
    } else {
        const p1iso = isoToScreen(player1.x, player1.y);
        const p2iso = isoToScreen(player2.x, player2.y);
        drawViewportAt(0,          0, GAME_W / 2, GAME_H, p1iso.x, p1iso.y, SPLIT_ZOOM);
        drawViewportAt(GAME_W / 2, 0, GAME_W / 2, GAME_H, p2iso.x, p2iso.y, SPLIT_ZOOM);

        // Simple solid divider
        ctx.fillStyle = '#00FFAA';
        ctx.fillRect(GAME_W / 2 - 1, 0, 2, GAME_H);
    }

    // Draw particles AFTER all viewports are restored (no ctx.translate active)
    particles.draw(ctx);

    // HUD
    ui.drawHUD(ctx, orders, players, state);

    // Per-player craft menus — drawn as half-screen overlays, game keeps running
    if (player1.craftMenuOpen) {
        ui.drawCraftMenuForPlayer(ctx, player1, crafting, 0, GAME_W / 2);
    }
    if (player2.craftMenuOpen) {
        ui.drawCraftMenuForPlayer(ctx, player2, crafting, GAME_W / 2, GAME_W / 2);
    }
}

// Draw one viewport with a specific camera position (saves/restores camera state)
function drawViewportAt(clipX, clipY, clipW, clipH, camX, camY, zoom) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, clipW, clipH);
    ctx.clip();

    const savedX = camera.x, savedY = camera.y, savedZoom = camera.zoom;
    camera.x = camX;
    camera.y = camY;
    camera.zoom = zoom;

    // Shift so this viewport is centered in its clip region
    const offsetX = clipX + clipW / 2 - GAME_W / 2;
    ctx.translate(offsetX, 0);
    drawSceneWithCamera(clipX - offsetX, clipY, clipW, clipH, camera);
    ctx.translate(-offsetX, 0);

    camera.x = savedX;
    camera.y = savedY;
    camera.zoom = savedZoom;
    ctx.restore();
}

// Core scene rendering (used by both single and split screen)
function drawSceneWithCamera(areaX, areaY, areaW, areaH, cam) {
    // World tiles
    world.draw(ctx, cam);

    // Machines
    drawMachine('machine_crafter', CRAFTER_POS, cam);
    drawMachine('machine_furnace', FURNACE_POS, cam);
    drawMachine('delivery_zone', DELIVERY_POS, cam);

    // Power-ups
    for (const p of powerups) {
        const sc = cam.worldToScreen(p.x, p.y);
        if (!cam.isOnScreen(sc.x, sc.y)) continue;
        const z = cam.zoom;
        const bob = Math.sin(p.bobTimer * 3) * 4 * z;
        const info = POWERUP_TYPES[p.type];
        ctx.fillStyle = info.color;
        ctx.globalAlpha = 0.6 + Math.sin(p.bobTimer * 5) * 0.3;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y - 10 * z + bob, 8 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFF';
        ctx.font = `${Math.floor(10 * z)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.fillText(info.icon, sc.x, sc.y - 5 * z + bob);
    }

    // Depth-sorted entities
    const entities = [];
    for (const p of players) entities.push({ y: p.y, draw: () => p.draw(ctx, cam) });
    for (const item of tossedItems) entities.push({ y: item.y + 0.5, draw: () => item.draw(ctx, cam, sprites) });
    const sortedNodes = [...resources.nodes].sort((a, b) => a.y - b.y);
    for (const n of sortedNodes) {
        if (n.alive || n.respawnTimer <= 500) {
            entities.push({ y: n.y, draw: () => n.draw(ctx, cam, sprites) });
        }
    }
    entities.sort((a, b) => a.y - b.y);
    for (const e of entities) e.draw();

    // World-space trail particles — drawn per-viewport with correct cam
    particles.drawWorldParticles(ctx, cam);
    // NOTE: screen-space particles.draw is called in drawPlayingScene
}

function drawMachine(spriteKey, pos, cam) {
    const sc = cam.worldToScreen(pos.x, pos.y);
    const sprite = sprites.get(spriteKey);
    if (sprite && cam.isOnScreen(sc.x, sc.y)) {
        const z = cam.zoom;
        const sw = sprite.width * z;
        const sh = sprite.height * z;
        ctx.drawImage(sprite, sc.x - sw / 2, sc.y - sh + 12 * z, sw, sh);
        // Glow effect for crafter
        if (spriteKey === 'machine_crafter') {
            ctx.fillStyle = 'rgba(0,255,170,0.06)';
            ctx.beginPath();
            ctx.arc(sc.x, sc.y - 12 * z, 30 * z, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ---- Start ----
init();
