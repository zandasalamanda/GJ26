// ============================================
// ALIEN ASSEMBLY LINE — Crafting System
// ============================================

import { PROCESSING_RECIPES, CONSTRUCTION_RECIPES, CRAFT_TIME, MAT_NAMES } from './utils.js';

export class CraftingSystem {
    constructor() {
        this.currentRound = 0;
    }

    setRound(round) {
        this.currentRound = round;
    }

    // Get available construction recipes based on current round
    getAvailableRecipes() {
        let maxTier = 0;
        if (this.currentRound >= 2) maxTier = 1;
        if (this.currentRound >= 4) maxTier = 2;
        return CONSTRUCTION_RECIPES.filter(r => r.tier <= maxTier);
    }

    // Get all processing recipes
    getProcessingRecipes() {
        return PROCESSING_RECIPES;
    }

    // Check if a player can craft a specific construction recipe
    canCraft(player, recipeIndex) {
        const available = this.getAvailableRecipes();
        if (recipeIndex < 0 || recipeIndex >= available.length) return false;
        return player.hasMaterials(available[recipeIndex].recipe);
    }

    // Execute a construction craft
    craft(player, recipeIndex) {
        const available = this.getAvailableRecipes();
        if (recipeIndex < 0 || recipeIndex >= available.length) return null;
        const recipe = available[recipeIndex];
        if (player.removeMaterials(recipe.recipe)) {
            return recipe.name;
        }
        return null;
    }

    // Check if a player can do a processing recipe
    canProcess(player, recipeIndex) {
        if (recipeIndex < 0 || recipeIndex >= PROCESSING_RECIPES.length) return false;
        return player.hasMaterials(PROCESSING_RECIPES[recipeIndex].input);
    }

    // Execute a processing recipe
    process(player, recipeIndex) {
        if (recipeIndex < 0 || recipeIndex >= PROCESSING_RECIPES.length) return null;
        const recipe = PROCESSING_RECIPES[recipeIndex];
        if (player.removeMaterials(recipe.input)) {
            // Add outputs to inventory
            const results = [];
            for (const [mat, qty] of Object.entries(recipe.output)) {
                for (let i = 0; i < qty; i++) {
                    if (player.addItem(mat)) {
                        results.push(mat);
                    }
                }
            }
            return { name: recipe.name, items: results };
        }
        return null;
    }

    // Find which processing recipes a player can execute
    getAvailableProcessing(player) {
        const available = [];
        for (let i = 0; i < PROCESSING_RECIPES.length; i++) {
            if (this.canProcess(player, i)) {
                available.push({ index: i, recipe: PROCESSING_RECIPES[i] });
            }
        }
        return available;
    }

    // Find which construction recipes a player can execute
    getAvailableCrafts(player) {
        const available = this.getAvailableRecipes();
        const result = [];
        for (let i = 0; i < available.length; i++) {
            if (player.hasMaterials(available[i].recipe)) {
                result.push({ index: i, recipe: available[i] });
            }
        }
        return result;
    }

    // Get a description of recipe requirements
    getRecipeDescription(recipe) {
        return Object.entries(recipe)
            .map(([mat, qty]) => `${qty}× ${MAT_NAMES[mat] || mat}`)
            .join(', ');
    }
}
