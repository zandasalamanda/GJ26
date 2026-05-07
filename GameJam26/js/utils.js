// ============================================
// FLAT-EARTHURZ — Utils & Constants
// ============================================

// ---- Display ----
export const GAME_W = 1280;
export const GAME_H = 720;
export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_COLS = 44;
export const MAP_ROWS = 28;

// ---- Timing ----
export const TARGET_FPS = 60;
export const FRAME_TIME = 1000 / TARGET_FPS;

// ---- Player ----
export const PLAYER_SPEED = 0.28;
export const PLAYER_SPEED_BOOSTED = 0.45;
export const PLAYER_INVENTORY_SIZE = 8;
export const HARVEST_TIME = 1500; // ms
export const HARVEST_TIME_FRENZY = 200;
export const TOSS_SPEED = 3.5;
export const TOSS_ARC_HEIGHT = 40;
export const CRAFT_TIME = 2000; // ms

// ---- Resources ----
export const RESOURCE_HP = 3;
export const RESOURCE_RESPAWN_TIME = 12000; // ms
export const RESOURCE_RESPAWN_TIME_MIN = 8000;

// ---- Orders ----
export const ORDER_BASE_TIME = 90; // seconds
export const ORDERS_PER_ROUND = 6;
export const TOTAL_ROUNDS = 5;
export const STAR_THRESHOLD_3 = 0.6; // complete in < 60% of time
export const STAR_THRESHOLD_2 = 0.85; // complete in < 85% of time

// ---- Power-ups ----
export const POWERUP_DURATION = 12000; // ms
export const POWERUP_SPAWN_INTERVAL = 20000; // ms

// ---- Materials ----
export const MAT = {
    // Raw (harvestable)
    WOOD: 'wood',
    STONE: 'stone',
    CRYSTAL: 'crystal',
    ORE: 'ore',
    COAL: 'coal',
    FIBER: 'fiber',
    // Processed
    STICKS: 'sticks',
    PEBBLES: 'pebbles',
    PLANKS: 'planks',
    BRICKS: 'bricks',
    CRYSTAL_SHARDS: 'crystal_shards',
    METAL_INGOT: 'metal_ingot',
    ROPE: 'rope',
};

// Display names
export const MAT_NAMES = {
    [MAT.WOOD]: 'Wood',
    [MAT.STONE]: 'Stone',
    [MAT.CRYSTAL]: 'Crystal',
    [MAT.ORE]: 'Ore',
    [MAT.COAL]: 'Coal',
    [MAT.FIBER]: 'Fiber',
    [MAT.STICKS]: 'Sticks',
    [MAT.PEBBLES]: 'Pebbles',
    [MAT.PLANKS]: 'Planks',
    [MAT.BRICKS]: 'Bricks',
    [MAT.CRYSTAL_SHARDS]: 'Crystal Shards',
    [MAT.METAL_INGOT]: 'Metal Ingot',
    [MAT.ROPE]: 'Rope',
};

// Material colors for icons/particles
export const MAT_COLORS = {
    [MAT.WOOD]: '#8B5E3C',
    [MAT.STONE]: '#8888AA',
    [MAT.CRYSTAL]: '#44DDFF',
    [MAT.ORE]: '#CC7733',
    [MAT.COAL]: '#333344',
    [MAT.FIBER]: '#55BB55',
    [MAT.STICKS]: '#A07040',
    [MAT.PEBBLES]: '#9999BB',
    [MAT.PLANKS]: '#C4873B',
    [MAT.BRICKS]: '#BB5544',
    [MAT.CRYSTAL_SHARDS]: '#66EEFF',
    [MAT.METAL_INGOT]: '#AABBCC',
    [MAT.ROPE]: '#998855',
};

// ---- Processing Recipes ----
export const PROCESSING_RECIPES = [
    { input: { [MAT.WOOD]: 1 }, output: { [MAT.STICKS]: 2 }, name: 'Chop Sticks' },
    { input: { [MAT.STONE]: 1 }, output: { [MAT.PEBBLES]: 2 }, name: 'Crush Pebbles' },
    { input: { [MAT.WOOD]: 2 }, output: { [MAT.PLANKS]: 1 }, name: 'Saw Planks' },
    { input: { [MAT.STONE]: 2 }, output: { [MAT.BRICKS]: 1 }, name: 'Kiln Bricks' },
    { input: { [MAT.CRYSTAL]: 1 }, output: { [MAT.CRYSTAL_SHARDS]: 2 }, name: 'Split Crystal' },
    { input: { [MAT.ORE]: 1, [MAT.COAL]: 1 }, output: { [MAT.METAL_INGOT]: 1 }, name: 'Smelt Ingot' },
    { input: { [MAT.FIBER]: 2 }, output: { [MAT.ROPE]: 1 }, name: 'Weave Rope' },
];

// ---- Construction Recipes ----
export const CONSTRUCTION_RECIPES = [
    // Basic Tier (Round 1+)
    { name: 'Fence', tier: 0, recipe: { [MAT.STICKS]: 3, [MAT.PEBBLES]: 3 } },
    { name: 'Wall', tier: 0, recipe: { [MAT.WOOD]: 4, [MAT.PEBBLES]: 2 } },
    { name: 'Foundation', tier: 0, recipe: { [MAT.STONE]: 4, [MAT.STICKS]: 2 } },
    { name: 'Roof', tier: 0, recipe: { [MAT.WOOD]: 2, [MAT.STONE]: 2 } },
    { name: 'Stairs', tier: 0, recipe: { [MAT.STONE]: 3, [MAT.STICKS]: 3 } },
    { name: 'Support Beam', tier: 0, recipe: { [MAT.WOOD]: 3, [MAT.STONE]: 1 } },
    // Mid Tier (Round 2+)
    { name: 'Ladder', tier: 1, recipe: { [MAT.ROPE]: 2, [MAT.STICKS]: 3 } },
    { name: 'Door', tier: 1, recipe: { [MAT.PLANKS]: 4, [MAT.METAL_INGOT]: 1 } },
    { name: 'Window', tier: 1, recipe: { [MAT.CRYSTAL_SHARDS]: 2, [MAT.PLANKS]: 2 } },
    { name: 'Chimney', tier: 1, recipe: { [MAT.BRICKS]: 3, [MAT.METAL_INGOT]: 1 } },
    // Advanced Tier (Round 4+)
    { name: 'Archway', tier: 2, recipe: { [MAT.STONE]: 3, [MAT.CRYSTAL_SHARDS]: 2 } },
    { name: 'Reinforced Wall', tier: 2, recipe: { [MAT.METAL_INGOT]: 2, [MAT.BRICKS]: 3 } },
    { name: 'Balcony', tier: 2, recipe: { [MAT.PLANKS]: 2, [MAT.ROPE]: 1, [MAT.METAL_INGOT]: 2 } },
    { name: 'Skylight', tier: 2, recipe: { [MAT.CRYSTAL_SHARDS]: 3, [MAT.PLANKS]: 2 } },
    { name: 'Suspension Bridge', tier: 2, recipe: { [MAT.ROPE]: 4, [MAT.METAL_INGOT]: 2 } },
];

// ---- Resource Node Types ----
export const NODE_TYPES = {
    TREE: { material: MAT.WOOD, island: 'blue', name: 'Tree', hp: 3 },
    BUSH: { material: MAT.FIBER, island: 'blue', name: 'Vine Bush', hp: 2 },
    CRYSTAL_N: { material: MAT.CRYSTAL, island: 'blue', name: 'Crystal Node', hp: 4 },
    ROCK: { material: MAT.STONE, island: 'red', name: 'Rock', hp: 3 },
    ORE_VEIN: { material: MAT.ORE, island: 'red', name: 'Ore Vein', hp: 4 },
    COAL_DEP: { material: MAT.COAL, island: 'red', name: 'Coal Deposit', hp: 2 },
};

// ---- Power-up Types ----
export const POWERUP_TYPES = {
    SPEED: { name: 'Speed Boost', color: '#FFDD44', icon: '⚡', desc: '+50% Speed' },
    FRENZY: { name: 'Harvest Frenzy', color: '#FF4444', icon: '🔥', desc: 'Instant Harvest' },
    DOUBLE: { name: 'Double Yield', color: '#44FF44', icon: '×2', desc: '2x Resources' },
    TIME_WARP: { name: 'Time Warp', color: '#AA44FF', icon: '⏳', desc: '+20s Timer' },
};

// ---- Color Palettes ----
export const PALETTE = {
    void: { bg: '#080818', stars: '#334' },
    blueIsland: {
        ground: ['#2a5c5c', '#2d6363', '#306868', '#285858'],
        accent: '#44BBAA',
        edge: '#1a3c3c',
        name: 'Verdant Glade',
    },
    redIsland: {
        ground: ['#6b3a2a', '#704030', '#753828', '#683525'],
        accent: '#CC7744',
        edge: '#3c1a0a',
        name: 'Molten Ridge',
    },
    hub: {
        ground: ['#4a4a3a', '#504830', '#484535', '#454030'],
        accent: '#CCAA44',
        edge: '#2a2a1a',
        name: 'Central Hub',
    },
    bridge: {
        ground: ['#5a4a30', '#554528'],
        edge: '#3a2a10',
    },
    ui: {
        bg: '#0c0c24',
        panel: '#1a1a3a',
        panelEdge: '#333366',
        text: '#eeeeff',
        textDim: '#666688',
        accent1: '#00ffaa',
        accent2: '#ff6644',
        accent3: '#44aaff',
        warning: '#ffaa00',
        danger: '#ff3333',
        star: '#ffdd44',
        starEmpty: '#333344',
    },
};

// ---- Island Definitions ----
export const ISLANDS = {
    blue: {
        cx: 9, cy: 14,
        radius: 6,
        tiles: [], // populated at runtime
    },
    red: {
        cx: 35, cy: 14,
        radius: 6,
        tiles: [],
    },
    hub: {
        cx: 22, cy: 14,
        radius: 5,
        tiles: [],
    },
};

// Bridge definitions (used as leap targets — NOT walkable tiles)
export const BRIDGES = [
    { from: 'blue', to: 'hub', r1: 12, r2: 16, c1: 15, c2: 17 },
    { from: 'hub', to: 'red', r1: 12, r2: 16, c1: 27, c2: 29 },
];

// Leap zone endpoints: walk to 'from' edge to leap to 'to' on the other island
export const LEAP_ZONES = [
    // Blue island edge → Hub
    { fromIsland: 'blue', toIsland: 'hub', from: { x: 15, y: 14 }, to: { x: 20, y: 14 }, allowedPlayers: ['blue'] },
    // Hub → Blue island
    { fromIsland: 'hub', toIsland: 'blue', from: { x: 17, y: 14 }, to: { x: 11, y: 14 }, allowedPlayers: ['blue'] },
    // Red island edge → Hub
    { fromIsland: 'red', toIsland: 'hub', from: { x: 29, y: 14 }, to: { x: 24, y: 14 }, allowedPlayers: ['red'] },
    // Hub → Red island
    { fromIsland: 'hub', toIsland: 'red', from: { x: 27, y: 14 }, to: { x: 33, y: 14 }, allowedPlayers: ['red'] },
];

export const LEAP_DURATION = 350; // ms — fast leap
export const LEAP_ARC = 120;     // pixels — high arc

// ---- Helper Functions ----

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export function isoToScreen(tileX, tileY) {
    return {
        x: (tileX - tileY) * (TILE_W / 2),
        y: (tileX + tileY) * (TILE_H / 2),
    };
}

export function screenToIso(screenX, screenY) {
    return {
        tileX: (screenX / (TILE_W / 2) + screenY / (TILE_H / 2)) / 2,
        tileY: (screenY / (TILE_H / 2) - screenX / (TILE_W / 2)) / 2,
    };
}

export function worldToScreen(wx, wy, camera) {
    const iso = isoToScreen(wx, wy);
    return {
        x: Math.floor(iso.x - camera.x + GAME_W / 2 + camera.shakeX),
        y: Math.floor(iso.y - camera.y + GAME_H / 2 + camera.shakeY),
    };
}

export function easeOutQuad(t) {
    return t * (2 - t);
}

export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

export function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function randInt(min, max) {
    return Math.floor(randRange(min, max + 1));
}

export function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Check if a point is inside an isometric diamond tile
export function pointInIsoDiamond(px, py, tileCenterX, tileCenterY) {
    const dx = Math.abs(px - tileCenterX);
    const dy = Math.abs(py - tileCenterY);
    return (dx / (TILE_W / 2) + dy / (TILE_H / 2)) <= 1;
}

// Simple AABB collision
export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Format seconds as M:SS
export function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Deep clone a simple object
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Count total items in a material bag
export function countBag(bag) {
    return Object.values(bag).reduce((sum, v) => sum + v, 0);
}
