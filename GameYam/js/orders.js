// ============================================
// ALIEN ASSEMBLY LINE — Order System
// ============================================

import { ORDER_BASE_TIME, ORDERS_PER_ROUND, TOTAL_ROUNDS, STAR_THRESHOLD_3, STAR_THRESHOLD_2, CONSTRUCTION_RECIPES, pick, randInt } from './utils.js';

export class Order {
    constructor(itemName, quantity, timeLimit) {
        this.itemName = itemName;
        this.quantity = quantity;
        this.delivered = 0;
        this.timeLimit = timeLimit;
        this.timeRemaining = timeLimit;
        this.completed = false;
        this.failed = false;
        this.stars = 0;
        this.isRush = false;
    }

    update(dt) {
        if (this.completed || this.failed) return;
        this.timeRemaining -= dt / 1000;
        if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
            this.failed = true;
        }
    }

    deliver() {
        if (this.completed || this.failed) return false;
        this.delivered++;
        if (this.delivered >= this.quantity) {
            this.completed = true;
            const timeRatio = 1 - (this.timeRemaining / this.timeLimit);
            if (timeRatio <= STAR_THRESHOLD_3) this.stars = 3;
            else if (timeRatio <= STAR_THRESHOLD_2) this.stars = 2;
            else this.stars = 1;
            if (this.isRush) this.stars = Math.min(3, this.stars + 1);
        }
        return true;
    }

    get progress() {
        return this.delivered / this.quantity;
    }

    get timeRatio() {
        return this.timeRemaining / this.timeLimit;
    }

    get urgent() {
        return this.timeRatio < 0.25 && !this.completed && !this.failed;
    }
}

export class OrderManager {
    constructor(crafting) {
        this.crafting = crafting;
        this.currentOrder = null;
        this.orderQueue = [];
        this.completedOrders = [];
        this.round = 0;
        this.orderIndex = 0;
        this.totalStars = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.roundComplete = false;
        this.ordersPerRound = ORDERS_PER_ROUND;
    }

    startRound(roundNumber) {
        this.round = roundNumber;
        this.crafting.setRound(roundNumber);
        this.orderQueue = [];
        this.completedOrders = [];
        this.orderIndex = 0;
        this.roundComplete = false;
        this.combo = 0;

        // Generate orders for this round
        const available = this.crafting.getAvailableRecipes();
        const count = this.ordersPerRound + Math.floor(roundNumber / 2);

        for (let i = 0; i < count; i++) {
            const recipe = pick(available);
            // Difficulty scaling
            const minQty = 1;
            const maxQty = Math.min(3, 1 + Math.floor(roundNumber / 2));
            const quantity = randInt(minQty, maxQty);

            // Time scales with quantity and round
            const baseTime = ORDER_BASE_TIME - roundNumber * 5;
            const timeLimit = Math.max(40, baseTime + quantity * 15);

            const order = new Order(recipe.name, quantity, timeLimit);

            // 20% chance of rush order after round 2
            if (roundNumber >= 2 && Math.random() < 0.2) {
                order.isRush = true;
                order.timeLimit = Math.floor(order.timeLimit * 0.7);
                order.timeRemaining = order.timeLimit;
            }

            this.orderQueue.push(order);
        }

        this.nextOrder();
    }

    nextOrder() {
        if (this.orderIndex >= this.orderQueue.length) {
            this.roundComplete = true;
            this.currentOrder = null;
            return false;
        }
        this.currentOrder = this.orderQueue[this.orderIndex];
        this.orderIndex++;
        return true;
    }

    update(dt) {
        if (!this.currentOrder || this.roundComplete) return;

        this.currentOrder.update(dt);

        if (this.currentOrder.failed) {
            this.combo = 0;
            this.completedOrders.push(this.currentOrder);
            this.nextOrder();
        }
    }

    // Try to deliver an item for the current order
    deliverItem(itemName) {
        if (!this.currentOrder || this.currentOrder.completed || this.currentOrder.failed) return false;
        if (this.currentOrder.itemName !== itemName) return false;

        this.currentOrder.deliver();

        if (this.currentOrder.completed) {
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            // Combo bonus stars
            let bonusStars = 0;
            if (this.combo >= 3) bonusStars = 1;
            if (this.combo >= 5) bonusStars = 2;
            this.currentOrder.stars = Math.min(3, this.currentOrder.stars + bonusStars);

            this.totalStars += this.currentOrder.stars;
            this.completedOrders.push(this.currentOrder);
            this.nextOrder();
        }

        return true;
    }

    get nextOrderPreview() {
        if (this.orderIndex < this.orderQueue.length) {
            return this.orderQueue[this.orderIndex];
        }
        return null;
    }

    getRoundSummary() {
        const completed = this.completedOrders.filter(o => o.completed).length;
        const failed = this.completedOrders.filter(o => o.failed).length;
        const totalPossible = this.orderQueue.length * 3;
        return {
            completed,
            failed,
            totalOrders: this.orderQueue.length,
            totalStars: this.totalStars,
            maxStars: totalPossible,
            maxCombo: this.maxCombo,
            round: this.round,
        };
    }
}
