// ============================================
// ALIEN ASSEMBLY LINE â€” Main Game
// ============================================
import { GAME_W, GAME_H, ISLANDS, HARVEST_TIME, HARVEST_TIME_FRENZY, CRAFT_TIME, MAT_COLORS, MAT_NAMES, MAT, dist, lerp, isoToScreen, PROCESSING_RECIPES, POWERUP_TYPES, POWERUP_DURATION, POWERUP_SPAWN_INTERVAL, LEAP_ZONES, LEAP_DETECT_RADIUS, randRange, randInt, pick } from './utils.js';
import { InputManager } from './input.js';
import { SpriteManager } from './sprites.js';
import { Camera } from './camera.js';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { World, T } from './world.js';
import { ResourceManager } from './resources.js';
import { Player, TossedItem } from './player.js';
import { CraftingSystem } from './crafting.js';
import { ProgressionManager, BUILD_STAGES, TOTAL_SHOWERS, DEFENSE_THRESHOLD, SUSTAIN_THRESHOLD, DIFFICULTY } from './progression.js';
import { UIManager } from './ui.js';
import { Tutorial } from './tutorial.js';
import { AlienPopulationManager } from './aliens.js';

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
const STATE = { LOADING: 0, TITLE: 1, PLAYING: 2, PAUSED: 3, ROUND_END: 4, GAME_OVER: 5, DIFFICULTY_SELECT: 7, TUTORIAL: 8, SHOWER_WARNING: 9, SHOWER_ACTIVE: 10, WIN: 11, LOSS: 12, ADMIN: 13 };
let state = STATE.LOADING;
let gameTime = 0;

// ---- Systems ----
const input = new InputManager();
const sprites = new SpriteManager();
const camera = new Camera();
const particles = new ParticleSystem();
const audio = new AudioManager();
let world, resources, crafting, progression, ui, tutorial;
let player1, player2, players;
let tossedItems = [];
let powerups = [];
let powerupTimer = 0;
let hazardTimer = 0;
let hazardActive = null;
let roundSummary = null;
let craftingPlayer = null;
let groundItems = []; // items on the hub ground waiting for pickup
let hubStockpile = {}; // shared material storage â€” crafting draws from this
let warningSirenTimer = 0; // for countdown audio
let showerMusicStarted = false;
let alienPop; // alien population manager

// Machine positions (tile coords)
const CRAFTER_POS = { x: ISLANDS.hub.cx - 1, y: ISLANDS.hub.cy - 1 };
const FURNACE_POS = { x: ISLANDS.hub.cx + 2, y: ISLANDS.hub.cy - 1 };
const DELIVERY_POS = { x: ISLANDS.hub.cx, y: ISLANDS.hub.cy + 2 };
// Food storage positions — at the back (outer edge) of each planet
const BLUE_FEEDER_POS = { x: ISLANDS.blue.cx - ISLANDS.blue.radius + 2, y: ISLANDS.blue.cy };
const RED_FEEDER_POS = { x: ISLANDS.red.cx + ISLANDS.red.radius - 2, y: ISLANDS.red.cy };

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
    progression = new ProgressionManager();
    ui = new UIManager(sprites);
    tutorial = new Tutorial();
    alienPop = new AlienPopulationManager();
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

function startGame(difficulty) {
    world.rebuild();
    setupPlayers();
    progression.setDifficulty(difficulty);
    progression.reset();
    resources.nodes = [];
    resources.spawnInitial();
    alienPop.init(world);
    tossedItems = [];
    powerups = [];
    groundItems = [];
    hubStockpile = {};
    powerupTimer = POWERUP_SPAWN_INTERVAL;
    hazardActive = null;
    showerMusicStarted = false;
    warningSirenTimer = 0;
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
        case STATE.DIFFICULTY_SELECT: updateDifficultySelect(); break;
        case STATE.TUTORIAL: updateTutorial(dt); break;
        case STATE.PLAYING: updatePlaying(dt); break;
        case STATE.PAUSED: updatePaused(); break;
        case STATE.SHOWER_WARNING: updateShowerWarning(dt); break;
        case STATE.SHOWER_ACTIVE: updateShowerActive(dt); break;
        case STATE.WIN: updateWinScreen(); break;
        case STATE.LOSS: updateLossScreen(); break;
        case STATE.GAME_OVER: updateGameOver(); break;
    }
    requestAnimationFrame(loop);
}

// ---- Title ----
let titleMusicStarted = false;
function updateTitle() {
    if (!titleMusicStarted && input.anyKeyPressed()) {
        audio.init(); audio.resume();
        audio.startMusic();
        titleMusicStarted = true;
    }
    if (input.confirm()) {
        audio.init(); audio.resume();
        if (!titleMusicStarted) { audio.startMusic(); titleMusicStarted = true; }
        selectedDifficulty = 1; // default to Normal
        state = STATE.DIFFICULTY_SELECT;
    }
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    ui.drawTitleScreen(ctx, gameTime);
}

// ---- Difficulty Select ----
let selectedDifficulty = 1; // 0=Easy, 1=Normal, 2=Hard
const DIFF_KEYS = ['easy', 'normal', 'hard'];

function updateDifficultySelect() {
    if (input.isJustPressed('ArrowLeft') || input.isJustPressed('KeyA')) {
        selectedDifficulty = Math.max(0, selectedDifficulty - 1); audio.playUIClick();
    }
    if (input.isJustPressed('ArrowRight') || input.isJustPressed('KeyD')) {
        selectedDifficulty = Math.min(2, selectedDifficulty + 1); audio.playUIClick();
    }
    if (input.confirm()) {
        setupPlayers();
        resources.nodes = [];
        startGame(DIFF_KEYS[selectedDifficulty]);
        // Try starting tutorial
        if (tutorial.start()) {
            state = STATE.TUTORIAL;
        }
        return;
    }
    if (input.pause()) { state = STATE.TITLE; return; }
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    ui.drawDifficultySelect(ctx, selectedDifficulty, DIFF_KEYS, gameTime);
}

// ---- Tutorial ----
function updateTutorial(dt) {
    // Track player actions for tutorial checks
    if (input.getP1Movement().dx !== 0 || input.getP1Movement().dy !== 0) tutorial.p1Moved = true;
    if (input.p1Interact()) tutorial.p1Harvested = true;
    if (input.p1Toss()) tutorial.p1Tossed = true;
    if (input.p1Craft()) tutorial.p1Crafted = true;

    tutorial.update(dt, input);

    if (tutorial.isComplete) {
        state = STATE.PLAYING;
    }

    // Still run the game underneath during action steps
    const step = tutorial.currentStep;
    if (step && step.type === 'action') {
        updatePlaying(dt);
    } else {
        drawPlayingScene();
    }

    // Draw tutorial overlay on top
    tutorial.draw(ctx, gameTime);
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
        input.isJustPressed('Slash') || input.isJustPressed('Enter'), input.isJustPressed('Comma'));

    // Movement â€” freeze player while their menu is open
    const m1 = player1.craftMenuOpen ? { dx: 0, dy: 0 } : input.getP1Movement();
    const m2 = player2.craftMenuOpen ? { dx: 0, dy: 0 } : input.getP2Movement();
    player1.update(dt, m1, world);
    player2.update(dt, m2, world);

    // Player actions
    handlePlayerActions(player1, input.p1Interact(), input.p1Toss(), input.p1Craft(), input.p1Process(), input.p1CycleLeft(), input.p1CycleRight(), dt);
    handlePlayerActions(player2, input.p2Interact(), input.p2Toss(), input.p2Craft(), input.p2Process(), input.p2CycleLeft(), input.p2CycleRight(), dt);

    // Resources
    resources.update(dt);

    // Alien populations
    alienPop.update(dt, world, progression.showerTimer);
    alienPop.updateDebuffs(dt);

    // Apply hunger speed modifiers to players
    const p1SpeedMult = alienPop.getSpeedMultiplier(player1.id);
    const p2SpeedMult = alienPop.getSpeedMultiplier(player2.id);
    if (p1SpeedMult < 1) player1.speedMultiplier = p1SpeedMult;
    else player1.speedMultiplier = 1;
    if (p2SpeedMult < 1) player2.speedMultiplier = p2SpeedMult;
    else player2.speedMultiplier = 1;

    // Alien pickup/drop (Tab for P1, RShift for P2)
    if (input.p1Drop()) {
        if (player1.carriedAlien) {
            const result = alienPop.dropAlien(player1, world);
            if (result && result.safe) {
                audio.playPickup();
                ui.addNotification(`${result.alien.island} alien saved!`, '#44FF88');
            }
        } else {
            const picked = alienPop.pickupAlien(player1, progression.showerTimer);
            if (picked) {
                audio.playPickup();
                player1.showEmote('Got one!');
            } else if (progression.showerTimer > 45000) {
                player1.showEmote('Too early!');
            }
        }
    }
    if (input.p2Drop()) {
        if (player2.carriedAlien) {
            const result = alienPop.dropAlien(player2, world);
            if (result && result.safe) {
                audio.playPickup();
                ui.addNotification(`${result.alien.island} alien saved!`, '#44FF88');
            }
        } else {
            const picked = alienPop.pickupAlien(player2, progression.showerTimer);
            if (picked) {
                audio.playPickup();
                player2.showEmote('Got one!');
            } else if (progression.showerTimer > 45000) {
                player2.showEmote('Too early!');
            }
        }
    }

    // Tossed items
    for (let i = tossedItems.length - 1; i >= 0; i--) {
        const item = tossedItems[i];
        item.update(dt);
        // World-space trail â€” works in split screen
        particles.emitTossTrailWorld(item.x, item.y, MAT_COLORS[item.material]);
        if (!item.alive) {
            // Land - try to give to nearest player or drop
            handleItemLand(item);
            tossedItems.splice(i, 1);
        }
    }

    // Ground item auto-pickup + decay
    for (let i = groundItems.length - 1; i >= 0; i--) {
        groundItems[i].timer -= dt;
        if (groundItems[i].timer <= 0) { groundItems.splice(i, 1); continue; }
        // Visual-only items (already in hub stockpile) â€” don't re-pickup
        if (groundItems[i].visual) continue;
        for (const p of players) {
            if (dist(p.x, p.y, groundItems[i].x, groundItems[i].y) < 1.5 && !p.inventoryFull) {
                p.addItem(groundItems[i].material);
                p.showEmote('+' + MAT_NAMES[groundItems[i].material]);
                audio.playPickup();
                groundItems.splice(i, 1);
                break;
            }
        }
    }

    // Progression â€” shower timer
    progression.showerTimer -= dt;
    if (progression.showerTimer <= 0 && progression.showerCount < TOTAL_SHOWERS) {
        progression.showerTimer = 0;
        showerWarningTimer = 5000; // 5s warning before impact
        state = STATE.SHOWER_WARNING;
    }

    // Power-up spawning
    powerupTimer -= dt;
    if (powerupTimer <= 0) {
        spawnPowerup();
        powerupTimer = POWERUP_SPAWN_INTERVAL + randRange(-3000, 3000);
    }
    updatePowerups(dt);

    // Leap detection â€” check if players are near leap zones
    checkLeapZone(player1);
    checkLeapZone(player2);

    // Camera
    camera.followPlayers(player1.x, player1.y, player2.x, player2.y);
    camera.zoomSmoothing = 0.04;
    camera.update(dt);

    // Particles
    particles.update(dt);

    // Ambient trail â€” world-space so particles stay behind as player moves
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

    // Proximity checks
    const dCrafter = dist(player.x, player.y, CRAFTER_POS.x, CRAFTER_POS.y);
    const dFurnace = dist(player.x, player.y, FURNACE_POS.x, FURNACE_POS.y);
    const dBlueFeeder = dist(player.x, player.y, BLUE_FEEDER_POS.x, BLUE_FEEDER_POS.y);
    const dRedFeeder = dist(player.x, player.y, RED_FEEDER_POS.x, RED_FEEDER_POS.y);
    const nearCrafter = dCrafter < 2.5;
    const nearFurnace = dFurnace < 2.5;
    const nearBlueFeeder = dBlueFeeder < 2.5 && player.id === 'blue';
    const nearRedFeeder = dRedFeeder < 2.5 && player.id === 'red';
    const nearFeeder = nearBlueFeeder || nearRedFeeder;

    // ---- CONTEXT-SENSITIVE INTERACT (E / Enter) ----
    if (interact) {
        // Priority 1: Harvest nearby resource
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
        }
        // Priority 2: Feed at food storage
        else if (nearFeeder) {
            doFeedAction(player);
        }
        // Priority 3: Craft at crafter (toggle menu or build)
        else if (nearCrafter) {
            if (player.craftMenuOpen) {
                player.craftMenuOpen = false;
            } else {
                doCraftAction(player);
            }
        }
        // Priority 4: Process at furnace (toggle menu)
        else if (nearFurnace) {
            if (player.craftMenuOpen && player.craftMenuMode === 'process') {
                player.craftMenuOpen = false;
            } else {
                player.craftMenuOpen = true;
                player.craftMenuMode = 'process';
                player.craftMenuSelection = 0;
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
                player.hitShake();
            } else {
                const sc = camera.worldToScreen(player.harvestTarget.x, player.harvestTarget.y);
                particles.emitNodeShake(sc.x, sc.y, MAT_COLORS[player.harvestTarget.info.material]);
                audio.playMine();
                player.hitShake();
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

    // Toss item to hub
    if (toss && player.currentItem) {
        const mat = player.removeSelectedItem();
        if (mat) {
            const ti = new TossedItem(mat, player.x, player.y, DELIVERY_POS.x, DELIVERY_POS.y);
            tossedItems.push(ti);
            audio.playToss();
            player.showEmote('TOSS!');
        }
    }

    // Dedicated Craft shortcut (F / ,)
    if (craft) {
        if (nearCrafter) {
            doCraftAction(player);
        } else if (nearFeeder) {
            doFeedAction(player);
        } else {
            player.showEmote('Go to Crafter!');
        }
    }

    // Dedicated Process shortcut (R / M)
    if (process) {
        if (nearCrafter || nearFurnace) {
            if (player.craftMenuOpen && player.craftMenuMode === 'process') {
                player.craftMenuOpen = false;
            } else {
                player.craftMenuOpen = true;
                player.craftMenuMode = 'process';
                player.craftMenuSelection = 0;
            }
        } else if (nearFeeder) {
            doFeedAction(player);
        } else {
            player.showEmote('Go to Machine!');
        }
    }
}

function doCraftAction(player) {
    const build = progression.getCurrentBuild();
    if (!build) {
        player.showEmote('All built!');
    } else if (canBuildFromHub(build)) {
        for (const [mat, qty] of Object.entries(build.recipe)) {
            hubStockpile[mat] -= qty;
            if (hubStockpile[mat] <= 0) delete hubStockpile[mat];
        }
        progression.completed.push(progression.buildIndex);
        progression.buildIndex++;
        const sc = camera.worldToScreen(CRAFTER_POS.x, CRAFTER_POS.y);
        particles.emitCraftBurst(sc.x, sc.y);
        audio.playCraft();
        camera.shake(3, 150);
        ui.addNotification(`Built ${build.name}!`, '#00FFAA');
        player.showEmote(build.name + '!');
        placeStructure(build);
    } else {
        player.showEmote('Need materials!');
        audio.playError();
    }
}

function doFeedAction(player) {
    const dBlueFeeder = dist(player.x, player.y, BLUE_FEEDER_POS.x, BLUE_FEEDER_POS.y);
    const dRedFeeder = dist(player.x, player.y, RED_FEEDER_POS.x, RED_FEEDER_POS.y);
    if (dBlueFeeder < 2.5 && player.id === 'blue') {
        const idx = player.inventory.indexOf(MAT.FIBER);
        if (idx >= 0) {
            player.inventory.splice(idx, 1);
            alienPop.feedBlue();
            audio.playPickup();
            player.showEmote('Fed!');
            const sc = camera.worldToScreen(BLUE_FEEDER_POS.x, BLUE_FEEDER_POS.y);
            particles.emitHarvestSparks(sc.x, sc.y, '#55BB55', 8);
        } else {
            player.showEmote('Need Fiber!');
        }
    }
    if (dRedFeeder < 2.5 && player.id === 'red') {
        const idx = player.inventory.indexOf(MAT.COAL);
        if (idx >= 0) {
            player.inventory.splice(idx, 1);
            alienPop.feedRed();
            audio.playPickup();
            player.showEmote('Fed!');
            const sc = camera.worldToScreen(RED_FEEDER_POS.x, RED_FEEDER_POS.y);
            particles.emitHarvestSparks(sc.x, sc.y, '#FF6633', 8);
        } else {
            player.showEmote('Need Coal!');
        }
    }
}

function canBuildFromHub(build) {
    for (const [mat, qty] of Object.entries(build.recipe)) {
        if ((hubStockpile[mat] || 0) < qty) return false;
    }
    return true;
}

function handleItemLand(item) {
    audio.playLand();
    const sc = camera.worldToScreen(item.toX, item.toY);
    particles.emitHarvestSparks(sc.x, sc.y, MAT_COLORS[item.material], 4);

    const landTile = world.getTile(Math.floor(item.toX), Math.floor(item.toY));

    // Items landing on hub â†’ add to shared hub stockpile for crafting
    if (landTile === T.HUB || landTile === T.BRIDGE) {
        hubStockpile[item.material] = (hubStockpile[item.material] || 0) + 1;
        ui.addFloatingText(sc.x, sc.y - 10, '+' + MAT_NAMES[item.material] + ' (Hub)', MAT_COLORS[item.material]);
        audio.playPickup();
        // Drop a visual ground item briefly so player sees it
        groundItems.push({ material: item.material, x: item.toX, y: item.toY, timer: 2000, visual: true });
        return;
    }

    // Items landing on player islands â†’ give to nearby player or ground
    for (const p of players) {
        if (dist(p.x, p.y, item.toX, item.toY) < 2.5) {
            if (p.addItem(item.material)) {
                p.showEmote('CAUGHT!');
                audio.playPickup();
                return;
            }
        }
    }
    if (landTile !== T.VOID) {
        groundItems.push({ material: item.material, x: item.toX, y: item.toY, timer: 30000 });
        ui.addFloatingText(sc.x, sc.y - 10, '+' + MAT_NAMES[item.material], MAT_COLORS[item.material]);
    } else {
        ui.addNotification('Item lost to the void!', '#FF4444');
    }
}

// Structure placement positions on the hub island (expanded for radius 7)
const STRUCTURE_POSITIONS = [
    // Tier 1: Defense perimeter (outer ring)
    { x: ISLANDS.hub.cx - 3, y: ISLANDS.hub.cy - 4, size: 2 },  // Barricade (north-west)
    { x: ISLANDS.hub.cx + 3, y: ISLANDS.hub.cy - 4, size: 2 },  // Watch Tower (north-east)
    { x: ISLANDS.hub.cx, y: ISLANDS.hub.cy - 5, size: 3 },       // Stone Wall (north)
    // Tier 2: Advanced defense
    { x: ISLANDS.hub.cx + 5, y: ISLANDS.hub.cy, size: 2 },       // Shield Pylon (east)
    { x: ISLANDS.hub.cx - 5, y: ISLANDS.hub.cy, size: 2 },       // Turret Platform (west)
    { x: ISLANDS.hub.cx, y: ISLANDS.hub.cy, size: 4 },            // Reinforced Dome (center)
    // Tier 3: Sustainability
    { x: ISLANDS.hub.cx - 3, y: ISLANDS.hub.cy + 3, size: 2 },   // Garden Dome (south-west)
    { x: ISLANDS.hub.cx + 3, y: ISLANDS.hub.cy + 3, size: 2 },   // Water Purifier (south-east)
    { x: ISLANDS.hub.cx + 4, y: ISLANDS.hub.cy - 2, size: 2 },   // Solar Array (east)
    { x: ISLANDS.hub.cx - 4, y: ISLANDS.hub.cy + 1, size: 2 },   // Habitat Module (west)
    { x: ISLANDS.hub.cx, y: ISLANDS.hub.cy + 5, size: 2 },       // Comms Beacon (south)
    { x: ISLANDS.hub.cx - 1, y: ISLANDS.hub.cy + 4, size: 3 },   // Landing Pad (south)
];

function placeStructure(build) {
    const idx = progression.totalBuilt - 1;
    const pos = STRUCTURE_POSITIONS[idx % STRUCTURE_POSITIONS.length];
    const size = pos.size || 1;

    // Place main tile
    world.addStructureTile(pos.x, pos.y, build.name);

    // For multi-tile structures, expand to adjacent tiles
    if (size >= 2) {
        world.addStructureTile(pos.x + 1, pos.y, build.name);
        world.addStructureTile(pos.x, pos.y + 1, build.name);
    }
    if (size >= 3) {
        world.addStructureTile(pos.x - 1, pos.y, build.name);
        world.addStructureTile(pos.x + 1, pos.y + 1, build.name);
    }
    if (size >= 4) {
        world.addStructureTile(pos.x - 1, pos.y + 1, build.name);
        world.addStructureTile(pos.x, pos.y - 1, build.name);
    }

    // Particles at placement
    const sc = camera.worldToScreen(pos.x, pos.y);
    particles.emitDeliveryBurst(sc.x, sc.y);
    camera.shake(4, 200);
}

// ---- Per-Player Process Menu Input ----
function handleCraftMenuInput(player, navUp, navDown, confirm, close) {
    if (!player.craftMenuOpen) return;
    const recipes = PROCESSING_RECIPES;
    if (navUp)   { player.craftMenuSelection = Math.max(0, player.craftMenuSelection - 1); audio.playUIClick(); }
    if (navDown) { player.craftMenuSelection = Math.min(recipes.length - 1, player.craftMenuSelection + 1); audio.playUIClick(); }
    if (close)   { player.craftMenuOpen = false; return; }
    if (confirm) {
        const idx = player.craftMenuSelection;
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
            progression.showerTimer += 30000; // +30s to next shower
            break;
    }
}

// ---- Pause / Shower / Win / Loss ----
let showerWarningTimer = 0;

function updatePaused() {
    if (input.pause()) { state = STATE.PLAYING; return; }
    drawPlayingScene();
    ui.drawPauseOverlay(ctx);
}

function updateShowerWarning(dt) {
    showerWarningTimer -= dt;

    // Siren sound every 1.5s during countdown
    warningSirenTimer -= dt;
    if (warningSirenTimer <= 0) {
        audio.playShowerSiren();
        warningSirenTimer = 1500;
    }
    // Tick beep every 500ms in last 3 seconds
    if (showerWarningTimer < 3000 && Math.floor(showerWarningTimer / 500) !== Math.floor((showerWarningTimer + dt) / 500)) {
        audio.playWarningTick();
    }

    // Update players and resources so game stays animated during warning
    for (const p of players) {
        const isP1 = (p === player1);
        const movement = isP1 ? input.getP1Movement() : input.getP2Movement();
        p.update(dt, movement, world, camera, particles);
    }
    resources.update(dt);

    drawPlayingScene();
    ui.drawShowerWarning(ctx, showerWarningTimer, progression.showerCount + 1, TOTAL_SHOWERS, gameTime);
    if (showerWarningTimer <= 0) {
        state = STATE.SHOWER_ACTIVE;
        // Shorter, more intense shower durations
        showerActiveTimer = Math.max(4000, progression.diffSettings.showerDuration * 0.4);
        meteorSpawnTimer = 0;
        showerMusicStarted = false;
    }
}

let showerActiveTimer = 0;
let meteorSpawnTimer = 0;
let activeMeteors = [];

function updateShowerActive(dt) {
    showerActiveTimer -= dt;
    meteorSpawnTimer -= dt;

    // Start intense music on first frame
    if (!showerMusicStarted) {
        audio.startShowerMusic();
        showerMusicStarted = true;
    }

    // Update players/resources â€” game stays animated, players can still move
    for (const p of players) {
        const isP1 = (p === player1);
        const movement = isP1 ? input.getP1Movement() : input.getP2Movement();
        p.update(dt, movement, world, camera, particles);
    }
    resources.update(dt);

    // Spawn meteors rapidly and chaotically
    const baseInterval = showerActiveTimer > 0 ? (showerActiveTimer / (progression.diffSettings.meteorCount * 1.5)) : 200;
    const spawnInterval = Math.max(100, baseInterval + randRange(-100, 100));
    if (meteorSpawnTimer <= 0) {
        meteorSpawnTimer = spawnInterval;
        // Random position across all islands â€” more chaotic spread
        const tx = randRange(2, 42);
        const ty = randRange(7, 22);
        const fallTime = randRange(600, 1200); // much faster fall
        activeMeteors.push({
            x: tx, y: ty,
            timer: fallTime,
            maxTimer: fallTime,
        });
    }

    // Update meteors
    for (let i = activeMeteors.length - 1; i >= 0; i--) {
        const m = activeMeteors[i];
        m.timer -= dt;
        if (m.timer <= 0) {
            // IMPACT! â€” explosive
            const sc = camera.worldToScreen(m.x, m.y);
            particles.emitMeteorExplosion(sc.x, sc.y, 30);
            camera.shake(8, 350);
            audio.playMeteorExplosion();
            // Damage resource nodes near impact
            for (const node of resources.nodes) {
                if (dist(node.x, node.y, m.x, m.y) < 2.5) {
                    node.hit();
                }
            }
            activeMeteors.splice(i, 1);
        }
    }

    drawPlayingScene();
    // Draw falling meteors with bigger, more dramatic visuals
    for (const m of activeMeteors) {
        const sc = camera.worldToScreen(m.x, m.y);
        const progress = 1 - (m.timer / m.maxTimer);
        const altitude = (1 - progress) * 250;
        const radius = 5 + progress * 12;
        // Ground warning circle â€” grows and pulses
        const pulseAlpha = 0.2 + Math.sin(progress * 20) * 0.1;
        ctx.fillStyle = `rgba(255,30,0,${pulseAlpha + progress * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(sc.x, sc.y, radius * 2.5, radius * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Meteor body
        const glow = Math.floor(120 - progress * 100);
        ctx.fillStyle = `rgb(255,${glow},0)`;
        ctx.shadowColor = '#FF4400';
        ctx.shadowBlur = 15 + progress * 10;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y - altitude, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Fire trail behind meteor
        for (let t = 1; t <= 3; t++) {
            ctx.fillStyle = `rgba(255,${100 + t * 30},0,${0.4 - t * 0.1})`;
            ctx.beginPath();
            ctx.arc(sc.x + randRange(-2, 2), sc.y - altitude - t * 12, radius * (0.7 - t * 0.15), 0, Math.PI * 2);
            ctx.fill();
        }
        // Emit trailing particle sparks during fall
        particles.emitMeteorTrail(sc.x, sc.y - altitude);
    }
    ui.drawShowerActive(ctx, showerActiveTimer, progression.showerCount + 1, TOTAL_SHOWERS);

    if (showerActiveTimer <= 0) {
        // Shower complete
        activeMeteors = [];
        progression.showerCount++;
        progression.showerTimer = progression.diffSettings.showerInterval;

        // Resume normal music
        audio.startMusic();
        showerMusicStarted = false;

        // Process alien casualties
        const aliensLost = alienPop.processShowerDamage();
        if (aliensLost > 0) {
            ui.addNotification(aliensLost + ' aliens lost in the shower!', '#FF4444', 4000);
        }

        // Erode outer islands
        world.erodeIsland('blue', 2 + progression.showerCount);
        world.erodeIsland('red', 2 + progression.showerCount);

        // Progressive readiness check
        const showerNum = progression.showerCount;
        const requiredBuilds = Math.min(BUILD_STAGES.length, Math.ceil(showerNum * BUILD_STAGES.length / TOTAL_SHOWERS));
        const actualBuilds = progression.totalBuilt;

        if (showerNum >= TOTAL_SHOWERS) {
            // Final shower
            world.destroyIsland('blue');
            world.destroyIsland('red');
            const allAliensSafe = (alienPop.blueSafeCount === 5 && alienPop.redSafeCount === 5);
            const allBuilt = progression.totalBuilt >= BUILD_STAGES.length;
            if (allBuilt && allAliensSafe) {
                state = STATE.WIN;
            } else {
                state = STATE.LOSS;
            }
            audio.stopMusic();
        } else if (actualBuilds < requiredBuilds) {
            state = STATE.LOSS;
            ui.addNotification('Not enough builds! Need ' + requiredBuilds + ', have ' + actualBuilds, '#FF4444', 5000);
            audio.stopMusic();
        } else {
            alienPop.returnSurvivorsHome();
            state = STATE.PLAYING;
            ui.addNotification('Shower ' + progression.showerCount + '/' + TOTAL_SHOWERS + ' survived!', '#FFD700');
            if (progression.showerCount === TOTAL_SHOWERS - 1) {
                ui.addNotification('FINAL SHOWER APPROACHING! Get ALL aliens to the hub!', '#FF3333', 8000);
            }
        }
    }
}

function updateWinScreen() {
    if (input.confirm()) { state = STATE.TITLE; return; }
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    ui.drawWinScreen(ctx, progression, gameTime);
}

function updateLossScreen() {
    if (input.confirm()) { state = STATE.TITLE; return; }
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    ui.drawLossScreen(ctx, progression, gameTime);
}

function updateGameOver() {
    if (input.confirm()) { state = STATE.TITLE; return; }
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    ui.drawGameOver(ctx, 0, 0, gameTime);
}

// ---- Leap Zone Detection ----
function checkLeapZone(player) {
    if (player.leaping) return;
    if (player.leapCooldown > 0) return;
    if (player.state !== 'walking') return;

    for (const zone of LEAP_ZONES) {
        const d = dist(player.x, player.y, zone.from.x, zone.from.y);
        if (d > LEAP_DETECT_RADIUS) continue;

        // Compute normalized leap direction
        const ldx = zone.to.x - zone.from.x;
        const ldy = zone.to.y - zone.from.y;
        const len = Math.sqrt(ldx * ldx + ldy * ldy);
        const dot = (player.lastIsoMoveX * ldx + player.lastIsoMoveY * ldy) / len;
        if (dot < 0.3) continue;

        if (!zone.allowedPlayers.includes(player.id)) {
            // BARRIER â€” deny and push back
            if (player.denyCooldown > 0) return; // don't spam
            player.denyCooldown = 1200;
            // Push in the opposite direction of the leap
            player.pushbackVX = -(ldx / len) * 0.18;
            player.pushbackVY = -(ldy / len) * 0.18;
            player.hitShake();
            player.showEmote('ðŸš« RESTRICTED', 1200);
            audio.playDeny();
            // Red flash burst at the edge
            const sc = camera.worldToScreen(zone.from.x, zone.from.y);
            particles.emitHarvestSparks(sc.x, sc.y, '#FF2244', 6);
            return;
        }

        // Permitted â€” do the leap
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

    // Instant commit â€” no blend, no fade
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
    ui.drawHUD(ctx, progression, players, state, hubStockpile, alienPop);

    // Per-player craft menus â€” drawn as half-screen overlays, game keeps running
    if (player1.craftMenuOpen) {
        ui.drawCraftMenuForPlayer(ctx, player1, crafting, 0, GAME_W / 2);
    }
    if (player2.craftMenuOpen) {
        ui.drawCraftMenuForPlayer(ctx, player2, crafting, GAME_W / 2, GAME_W / 2);
    }

    // Admin panel overlay
    drawAdminPanel();
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

    // Food storage buildings on each planet
    drawFoodStorage(BLUE_FEEDER_POS, 'blue', cam);
    drawFoodStorage(RED_FEEDER_POS, 'red', cam);

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
    // Add aliens to depth sort
    if (alienPop) {
        for (const alien of alienPop.allAliens) {
            if (alien.alive && !alien.carried) {
                entities.push({ y: alien.y, draw: () => alien.draw(ctx, cam, sprites) });
            }
        }
    }
    entities.sort((a, b) => a.y - b.y);
    for (const e of entities) e.draw();

    // Ground items â€” small colored squares with bob
    for (const gi of groundItems) {
        const sc = cam.worldToScreen(gi.x, gi.y);
        if (!cam.isOnScreen(sc.x, sc.y)) continue;
        const z = cam.zoom;
        const bob = Math.sin(Date.now() * 0.004 + gi.x * 3) * 3 * z;
        const color = MAT_COLORS[gi.material] || '#FFF';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(sc.x - 4 * z, sc.y - 8 * z + bob, 8 * z, 8 * z);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(sc.x - 4 * z, sc.y - 8 * z + bob, 8 * z, 8 * z);
        ctx.globalAlpha = 1;
    }

    // Build checklist floating above crafter
    const build = progression.getCurrentBuild();
    if (build) {
        const crafterSc = cam.worldToScreen(CRAFTER_POS.x, CRAFTER_POS.y);
        if (cam.isOnScreen(crafterSc.x, crafterSc.y)) {
            const z = cam.zoom;
            const bx = crafterSc.x;
            const by = crafterSc.y - 50 * z;
            // Background panel
            const panW = 160 * z;
            const panH = 14 * z + Object.keys(build.recipe).length * 12 * z + 6 * z;
            ctx.fillStyle = 'rgba(5,10,25,0.85)';
            ctx.fillRect(bx - panW / 2, by - 2 * z, panW, panH);
            ctx.strokeStyle = '#00FFAA55';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - panW / 2, by - 2 * z, panW, panH);
            // Build name
            ctx.font = `${Math.floor(7 * z)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00FFAA';
            ctx.fillText(build.name, bx, by + 8 * z);
            // Material requirements â€” from hub stockpile
            let matY = by + 20 * z;
            ctx.font = `${Math.floor(6 * z)}px "Press Start 2P"`;
            for (const [mat, qty] of Object.entries(build.recipe)) {
                const have = hubStockpile[mat] || 0;
                const done = have >= qty;
                ctx.fillStyle = done ? '#44FF88' : '#FF6644';
                ctx.fillText(`${MAT_NAMES[mat] || mat}: ${have}/${qty} ${done ? 'âœ“' : ''}`, bx, matY);
                matY += 12 * z;
            }
        }
    }
    // World-space trail particles â€” drawn per-viewport with correct cam
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

function drawFoodStorage(pos, island, cam) {
    const sc = cam.worldToScreen(pos.x, pos.y);
    if (!cam.isOnScreen(sc.x, sc.y)) return;
    const z = cam.zoom;
    const w = 48 * z;
    const h = 52 * z;
    const bx = sc.x - w / 2;
    const by = sc.y - h;

    if (island === 'blue') {
        // Large greenhouse/feeding hut with vines
        // Foundation
        ctx.fillStyle = '#2a5c3c';
        ctx.fillRect(bx + 3 * z, by + h * 0.35, w - 6 * z, h * 0.65);
        // Walls
        ctx.fillStyle = '#3a7c4c';
        ctx.fillRect(bx + 5 * z, by + h * 0.38, w - 10 * z, h * 0.55);
        // Roof (large triangular)
        ctx.fillStyle = '#4a8c5c';
        ctx.beginPath();
        ctx.moveTo(bx - 4 * z, by + h * 0.38);
        ctx.lineTo(sc.x, by - 6 * z);
        ctx.lineTo(bx + w + 4 * z, by + h * 0.38);
        ctx.closePath();
        ctx.fill();
        // Roof ridge
        ctx.strokeStyle = '#5aAc6c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx - 4 * z, by + h * 0.38);
        ctx.lineTo(sc.x, by - 6 * z);
        ctx.lineTo(bx + w + 4 * z, by + h * 0.38);
        ctx.stroke();
        // Vine details (hanging from roof)
        ctx.fillStyle = '#55CC55';
        for (let i = 0; i < 5; i++) {
            const vx = bx + 6 * z + i * 9 * z;
            const vLen = 8 + Math.sin(Date.now() * 0.002 + i) * 3;
            ctx.fillRect(vx, by + h * 0.38, 2 * z, vLen * z);
            // Leaf at end
            ctx.beginPath();
            ctx.arc(vx + z, by + h * 0.38 + vLen * z, 2 * z, 0, Math.PI * 2);
            ctx.fill();
        }
        // Door
        ctx.fillStyle = '#1a3c2c';
        ctx.fillRect(sc.x - 5 * z, by + h * 0.55, 10 * z, h * 0.45);
        // Glowing food bowl inside
        ctx.fillStyle = '#88DDAA';
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.003) * 0.2;
        ctx.beginPath();
        ctx.arc(sc.x, by + h * 0.75, 5 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    } else {
        // Large forge/smokehouse
        // Main building
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(bx + 3 * z, by + h * 0.3, w - 6 * z, h * 0.7);
        // Stone base
        ctx.fillStyle = '#4a2a1a';
        ctx.fillRect(bx + 1 * z, by + h * 0.85, w - 2 * z, h * 0.15);
        // Chimney
        ctx.fillStyle = '#444';
        ctx.fillRect(sc.x + 10 * z, by - 12 * z, 8 * z, h * 0.45);
        // Smoke
        ctx.fillStyle = 'rgba(100,100,100,0.3)';
        const smokeBob = Math.sin(Date.now() * 0.002) * 3;
        ctx.beginPath();
        ctx.arc(sc.x + 14 * z + smokeBob, by - 16 * z, 4 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sc.x + 12 * z - smokeBob, by - 22 * z, 3 * z, 0, Math.PI * 2);
        ctx.fill();
        // Flat roof
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(bx - 2 * z, by + h * 0.28, w + 4 * z, 5 * z);
        // Fire window (glowing)
        ctx.fillStyle = '#FF6633';
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.005) * 0.3;
        ctx.fillRect(sc.x - 6 * z, by + h * 0.5, 12 * z, 8 * z);
        ctx.globalAlpha = 1;
        // Door
        ctx.fillStyle = '#2a1a0a';
        ctx.fillRect(sc.x - 5 * z, by + h * 0.6, 10 * z, h * 0.4);
        // Ember particles
        ctx.fillStyle = '#FF8844';
        for (let i = 0; i < 3; i++) {
            const ex = sc.x - 3 * z + Math.sin(Date.now() * 0.004 + i * 2) * 6 * z;
            const ey = by + h * 0.45 - i * 4 * z + Math.sin(Date.now() * 0.003 + i) * 2 * z;
            ctx.fillRect(ex, ey, 2 * z, 2 * z);
        }
    }

    // Label
    ctx.font = `${Math.floor(6 * z)}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = island === 'blue' ? '#88DDAA' : '#DDAA66';
    ctx.fillText('FEEDER', sc.x, by - 10 * z);

    // Hunger bar (wider, more visible)
    if (alienPop) {
        const hunger = island === 'blue' ? alienPop.blueHunger : alienPop.redHunger;
        const barW = 36 * z;
        const barH = 5 * z;
        const barX = sc.x - barW / 2;
        const barY = by - 6 * z;
        ctx.fillStyle = '#222';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        const pct = hunger / 100;
        ctx.fillStyle = pct > 0.5 ? '#44FF88' : pct > 0.25 ? '#FFAA44' : '#FF4444';
        ctx.fillRect(barX, barY, barW * pct, barH);
        // Percentage text on bar
        ctx.font = `${Math.floor(4 * z)}px "Press Start 2P"`;
        ctx.fillStyle = '#FFF';
        ctx.fillText(`${Math.floor(hunger)}%`, sc.x, barY + barH - 1);
    }
}

// ---- Admin Panel (Ctrl+Shift+K) ----
let adminOpen = false;
let adminSelection = 0;
const ADMIN_ACTIONS = [
    'Give All Materials',
    'Skip to Next Shower',
    'Complete Current Build',
    'Add 60s to Shower Timer',
];

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        adminOpen = !adminOpen;
        adminSelection = 0;
    }
    if (!adminOpen) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') adminSelection = Math.max(0, adminSelection - 1);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') adminSelection = Math.min(ADMIN_ACTIONS.length - 1, adminSelection + 1);
    if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        executeAdminAction(adminSelection);
    }
});

function executeAdminAction(idx) {
    const MAT = { WOOD:'wood', STONE:'stone', CRYSTAL:'crystal', ORE:'ore', COAL:'coal', FIBER:'fiber' };
    switch (idx) {
        case 0: // Give all materials to hub stockpile
            for (const m of Object.values(MAT)) {
                hubStockpile[m] = (hubStockpile[m] || 0) + 5;
            }
            ui.addNotification('ADMIN: Hub stockpile filled', '#FF00FF');
            break;
        case 1: // Skip to next shower
            progression.showerTimer = 0;
            ui.addNotification('ADMIN: Shower triggered', '#FF00FF');
            break;
        case 2: // Complete current build
            const build = progression.getCurrentBuild();
            if (build) {
                progression.completed.push(progression.buildIndex);
                progression.buildIndex++;
                const pos = STRUCTURE_POSITIONS[(progression.totalBuilt - 1) % STRUCTURE_POSITIONS.length];
                world.addStructureTile(pos.x, pos.y, build.name);
                ui.addNotification(`ADMIN: Built ${build.name}`, '#FF00FF');
            }
            break;
        case 3: // Add time
            progression.showerTimer += 60000;
            ui.addNotification('ADMIN: +60s added', '#FF00FF');
            break;
    }
}

function drawAdminPanel() {
    if (!adminOpen) return;
    ctx.fillStyle = 'rgba(80,0,80,0.85)';
    ctx.fillRect(GAME_W - 320, 10, 310, 30 + ADMIN_ACTIONS.length * 24);
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF00FF';
    ctx.fillText('ADMIN PANEL', GAME_W - 310, 28);
    for (let i = 0; i < ADMIN_ACTIONS.length; i++) {
        const y = 50 + i * 24;
        ctx.fillStyle = i === adminSelection ? '#FF00FF' : '#AA66AA';
        ctx.fillText(`${i === adminSelection ? '>' : ' '} ${ADMIN_ACTIONS[i]}`, GAME_W - 310, y);
    }
}

// ---- Start ----
init();

