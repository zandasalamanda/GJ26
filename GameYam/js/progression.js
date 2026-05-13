// ============================================
// FLAT-EARTHRZ — Build Progression System
// ============================================

import { MAT, MAT_NAMES } from './utils.js';

// Linear build queue — players always know what to build next.
// Each structure has: name, description, recipe (simplified to 2-3 mats),
// category (defense/sustain), tilePositions (where it appears on hub),
// and a defenseValue / sustainValue used for win/loss scoring.

export const BUILD_STAGES = [
    // --- Tier 1: Shelter (before shower 1) ---
    {
        name: 'Barricade',
        desc: 'Basic rock wall to deflect small debris',
        recipe: { [MAT.STONE]: 3, [MAT.WOOD]: 2 },
        category: 'defense',
        defenseValue: 10,
        sustainValue: 0,
        tier: 0,
    },
    {
        name: 'Watch Tower',
        desc: 'Tall lookout to spot incoming meteors',
        recipe: { [MAT.WOOD]: 4, [MAT.FIBER]: 2 },
        category: 'defense',
        defenseValue: 15,
        sustainValue: 0,
        tier: 0,
    },
    {
        name: 'Stone Wall',
        desc: 'Reinforced perimeter wall segment',
        recipe: { [MAT.STONE]: 4, [MAT.ORE]: 1 },
        category: 'defense',
        defenseValue: 20,
        sustainValue: 0,
        tier: 0,
    },

    // --- Tier 2: Defense (before shower 3) ---
    {
        name: 'Shield Pylon',
        desc: 'Crystal-powered energy barrier node',
        recipe: { [MAT.CRYSTAL]: 3, [MAT.ORE]: 2 },
        category: 'defense',
        defenseValue: 30,
        sustainValue: 0,
        tier: 1,
    },
    {
        name: 'Turret Platform',
        desc: 'Anti-meteor cannon emplacement',
        recipe: { [MAT.ORE]: 3, [MAT.COAL]: 2, [MAT.STONE]: 2 },
        category: 'defense',
        defenseValue: 35,
        sustainValue: 0,
        tier: 1,
    },
    {
        name: 'Reinforced Dome',
        desc: 'Heavy overhead protection for the hub',
        recipe: { [MAT.STONE]: 3, [MAT.CRYSTAL]: 2, [MAT.ORE]: 2 },
        category: 'defense',
        defenseValue: 40,
        sustainValue: 0,
        tier: 1,
    },

    // --- Tier 3: Sustainability (before shower 5) ---
    {
        name: 'Garden Dome',
        desc: 'Sealed greenhouse for growing alien flora',
        recipe: { [MAT.FIBER]: 4, [MAT.CRYSTAL]: 2 },
        category: 'sustain',
        defenseValue: 0,
        sustainValue: 25,
        tier: 2,
    },
    {
        name: 'Water Purifier',
        desc: 'Filters void-moisture into drinkable water',
        recipe: { [MAT.CRYSTAL]: 3, [MAT.STONE]: 2 },
        category: 'sustain',
        defenseValue: 0,
        sustainValue: 30,
        tier: 2,
    },
    {
        name: 'Solar Array',
        desc: 'Crystal panels that harvest cosmic energy',
        recipe: { [MAT.CRYSTAL]: 3, [MAT.ORE]: 3 },
        category: 'sustain',
        defenseValue: 5,
        sustainValue: 30,
        tier: 2,
    },
    {
        name: 'Habitat Module',
        desc: 'Living quarters for permanent settlement',
        recipe: { [MAT.WOOD]: 3, [MAT.STONE]: 3, [MAT.FIBER]: 2 },
        category: 'sustain',
        defenseValue: 5,
        sustainValue: 35,
        tier: 2,
    },

    // --- Final: Victory structures ---
    {
        name: 'Comms Beacon',
        desc: 'Signal tower to call for rescue',
        recipe: { [MAT.CRYSTAL]: 4, [MAT.ORE]: 3 },
        category: 'sustain',
        defenseValue: 10,
        sustainValue: 40,
        tier: 3,
    },
    {
        name: 'Landing Pad',
        desc: 'Flat platform for evacuation ships',
        recipe: { [MAT.STONE]: 4, [MAT.ORE]: 3, [MAT.WOOD]: 2 },
        category: 'sustain',
        defenseValue: 10,
        sustainValue: 40,
        tier: 3,
    },
];

// Difficulty presets
export const DIFFICULTY = {
    easy:   { label: 'Easy',   showerInterval: 480000, resourceMult: 1.5, showerDuration: 12000, meteorCount: 6  },
    normal: { label: 'Normal', showerInterval: 300000, resourceMult: 1.0, showerDuration: 18000, meteorCount: 10 },
    hard:   { label: 'Hard',   showerInterval: 180000, resourceMult: 0.75, showerDuration: 24000, meteorCount: 15 },
};

export const TOTAL_SHOWERS = 5;
export const DEFENSE_THRESHOLD = 80;   // need this much defense to survive final shower
export const SUSTAIN_THRESHOLD = 80;   // need this much sustainability to win

export class ProgressionManager {
    constructor() {
        this.buildIndex = 0;        // index into BUILD_STAGES
        this.completed = [];        // indices of completed builds
        this.difficulty = 'normal';
        this.showerCount = 0;       // how many showers have happened
        this.showerTimer = 0;       // ms until next shower
        this.diffSettings = DIFFICULTY.normal;
    }

    setDifficulty(diff) {
        this.difficulty = diff;
        this.diffSettings = DIFFICULTY[diff] || DIFFICULTY.normal;
        this.showerTimer = this.diffSettings.showerInterval;
    }

    reset() {
        this.buildIndex = 0;
        this.completed = [];
        this.showerCount = 0;
        this.showerTimer = this.diffSettings.showerInterval;
    }

    // Current build target (or null if all done)
    getCurrentBuild() {
        if (this.buildIndex >= BUILD_STAGES.length) return null;
        return BUILD_STAGES[this.buildIndex];
    }

    // Check if a player has materials for the current build
    canBuild(player) {
        const build = this.getCurrentBuild();
        if (!build) return false;
        return player.hasMaterials(build.recipe);
    }

    // Complete the current build — returns the build info
    completeBuild(player) {
        const build = this.getCurrentBuild();
        if (!build) return null;
        if (!player.removeMaterials(build.recipe)) return null;
        this.completed.push(this.buildIndex);
        this.buildIndex++;
        return build;
    }

    // Score calculations
    get defenseScore() {
        return this.completed.reduce((sum, idx) => sum + BUILD_STAGES[idx].defenseValue, 0);
    }

    get sustainScore() {
        return this.completed.reduce((sum, idx) => sum + BUILD_STAGES[idx].sustainValue, 0);
    }

    get totalBuilt() {
        return this.completed.length;
    }

    get allBuilt() {
        return this.buildIndex >= BUILD_STAGES.length;
    }

    // Showers remaining
    get showersRemaining() {
        return TOTAL_SHOWERS - this.showerCount;
    }

    // Get recipe description for HUD display
    getRecipeList(build) {
        if (!build) return [];
        return Object.entries(build.recipe).map(([mat, qty]) => ({
            material: mat,
            name: MAT_NAMES[mat] || mat,
            needed: qty,
        }));
    }

    // Check what player has vs what's needed
    getRecipeProgress(build, player) {
        if (!build) return [];
        const counts = {};
        for (const item of player.inventory) {
            counts[item] = (counts[item] || 0) + 1;
        }
        return Object.entries(build.recipe).map(([mat, qty]) => ({
            material: mat,
            name: MAT_NAMES[mat] || mat,
            needed: qty,
            have: counts[mat] || 0,
            done: (counts[mat] || 0) >= qty,
        }));
    }
}
