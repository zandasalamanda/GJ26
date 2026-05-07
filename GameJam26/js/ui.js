// ============================================
// ALIEN ASSEMBLY LINE — UI System
// ============================================

import { GAME_W, GAME_H, PALETTE, MAT_NAMES, MAT_COLORS, PLAYER_INVENTORY_SIZE, formatTime, CONSTRUCTION_RECIPES, PROCESSING_RECIPES, TOTAL_ROUNDS } from './utils.js';

export class UIManager {
    constructor(sprites) {
        this.sprites = sprites;
        this.craftMenuOpen = false;
        this.craftMenuPlayer = null;
        this.craftMenuMode = 'craft';
        this.craftMenuSelection = 0;
        this.notifications = [];
        this.floatingTexts = [];
    }

    addNotification(text, color = '#FFF', duration = 2000) {
        this.notifications.push({ text, color, timer: duration, maxTimer: duration });
    }

    addFloatingText(x, y, text, color = '#FFF') {
        this.floatingTexts.push({ x, y, text, color, timer: 1500, vy: -0.8, alpha: 1 });
    }

    update(dt) {
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].timer -= dt;
            if (this.notifications[i].timer <= 0) this.notifications.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.timer -= dt;
            ft.y += ft.vy;
            ft.alpha = Math.max(0, ft.timer / 1500);
            if (ft.timer <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    drawHUD(ctx, orderManager, players, gameState) {
        this._drawOrderBar(ctx, orderManager);
        this._drawInventory(ctx, players[0], 8, GAME_H - 80, 'left');
        this._drawInventory(ctx, players[1], GAME_W - 210, GAME_H - 80, 'right');
        this._drawStarCounter(ctx, orderManager);
        if (orderManager.combo >= 2) this._drawCombo(ctx, orderManager.combo);
        this._drawNotifications(ctx);
        this._drawFloatingTexts(ctx);
        this._drawControls(ctx);
    }

    _drawOrderBar(ctx, orderManager) {
        const order = orderManager.currentOrder;
        if (!order) return;

        ctx.fillStyle = 'rgba(10,10,30,0.85)';
        ctx.fillRect(0, 0, GAME_W, 60);
        ctx.fillStyle = PALETTE.ui.panelEdge;
        ctx.fillRect(0, 60, GAME_W, 2);

        ctx.font = '14px "Press Start 2P"';
        ctx.fillStyle = order.isRush ? '#FFD700' : '#FFF';
        ctx.textAlign = 'left';
        const prefix = order.isRush ? '⚡ RUSH: ' : '';
        ctx.fillText(`${prefix}${order.itemName}`, 12, 24);

        ctx.fillStyle = PALETTE.ui.accent1;
        ctx.fillText(`${order.delivered}/${order.quantity}`, 12, 48);

        const pipX = 160;
        for (let i = 0; i < order.quantity; i++) {
            ctx.fillStyle = i < order.delivered ? PALETTE.ui.accent1 : '#333';
            ctx.fillRect(pipX + i * 20, 38, 16, 10);
        }

        const timerW = 360;
        const timerX = GAME_W / 2 - timerW / 2 + 80;
        ctx.fillStyle = '#222';
        ctx.fillRect(timerX, 14, timerW, 14);
        const ratio = order.timeRatio;
        let timerColor = PALETTE.ui.accent1;
        if (ratio < 0.5) timerColor = PALETTE.ui.warning;
        if (ratio < 0.25) timerColor = PALETTE.ui.danger;
        ctx.fillStyle = timerColor;
        ctx.fillRect(timerX, 14, timerW * ratio, 14);

        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = order.urgent ? '#FF3333' : '#CCC';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(order.timeRemaining), timerX + timerW / 2, 48);

        if (order.urgent) {
            const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255,50,50,${pulse})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(1, 1, GAME_W - 2, 58);
        }

        const next = orderManager.nextOrderPreview;
        if (next) {
            ctx.font = '10px "Press Start 2P"';
            ctx.fillStyle = '#777';
            ctx.textAlign = 'right';
            ctx.fillText(`NEXT: ${next.itemName} x${next.quantity}`, GAME_W - 12, 22);
        }

        const recipe = CONSTRUCTION_RECIPES.find(r => r.name === order.itemName);
        if (recipe) {
            ctx.font = '9px "Press Start 2P"';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#999';
            const reqText = Object.entries(recipe.recipe).map(([m,q]) => `${q}×${(MAT_NAMES[m]||m).substring(0,6)}`).join('  ');
            ctx.fillText(reqText, GAME_W - 12, 48);
        }
    }

    _drawInventory(ctx, player, x, y, align) {
        const slotSize = 24;
        const padding = 2;
        const cols = 4;
        const rows = 2;

        const panelW = cols * (slotSize + padding) + padding + 8;
        const panelH = rows * (slotSize + padding) + padding + 26;
        ctx.fillStyle = 'rgba(10,10,30,0.8)';
        ctx.fillRect(x - 4, y - 22, panelW, panelH);
        ctx.strokeStyle = player.id === 'blue' ? '#4488FF66' : '#FF444466';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 4, y - 22, panelW, panelH);

        ctx.font = '10px "Press Start 2P"';
        ctx.fillStyle = player.id === 'blue' ? '#4488FF' : '#FF4444';
        ctx.textAlign = 'left';
        ctx.fillText(player.id === 'blue' ? 'P1-BLUE' : 'P2-RED', x, y - 8);

        for (let i = 0; i < PLAYER_INVENTORY_SIZE; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const sx = x + col * (slotSize + padding);
            const sy = y + row * (slotSize + padding);

            ctx.fillStyle = i === player.selectedSlot ? '#334' : '#1a1a2a';
            ctx.fillRect(sx, sy, slotSize, slotSize);

            if (i === player.selectedSlot) {
                ctx.strokeStyle = '#00FFAA';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx, sy, slotSize, slotSize);
            }

            if (i < player.inventory.length) {
                const item = player.inventory[i];
                const icon = this.sprites.get(`icon_${item}`);
                if (icon) {
                    ctx.drawImage(icon, sx + 2, sy + 2, slotSize - 4, slotSize - 4);
                } else {
                    ctx.fillStyle = MAT_COLORS[item] || '#888';
                    ctx.fillRect(sx + 4, sy + 4, slotSize - 8, slotSize - 8);
                }
            }
        }
    }

    _drawStarCounter(ctx, orderManager) {
        const x = GAME_W / 2;
        const y = GAME_H - 18;
        ctx.font = '14px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.ui.star;
        ctx.fillText(`★ ${orderManager.totalStars}`, x, y);
        ctx.fillStyle = '#777';
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText(`Round ${orderManager.round + 1}/${TOTAL_ROUNDS}`, x, y + 16);
    }

    _drawCombo(ctx, combo) {
        ctx.save();
        ctx.font = '16px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.globalAlpha = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
        ctx.fillText(`COMBO x${combo}!`, GAME_W / 2, 90);
        ctx.restore();
    }

    _drawNotifications(ctx) {
        for (let i = 0; i < this.notifications.length; i++) {
            const n = this.notifications[i];
            ctx.save();
            ctx.font = '12px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.globalAlpha = Math.min(1, n.timer / 500);
            ctx.fillStyle = n.color;
            ctx.fillText(n.text, GAME_W / 2, 110 + i * 20);
            ctx.restore();
        }
    }

    _drawFloatingTexts(ctx) {
        for (const ft of this.floatingTexts) {
            ctx.save();
            ctx.font = '10px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.globalAlpha = ft.alpha;
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }

    _drawControls(ctx) {
        ctx.save();
        ctx.font = '9px "Press Start 2P"';
        ctx.globalAlpha = 0.5;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#88BBFF';
        ctx.fillText('P1: WASD  E-Harvest  Q-Toss  F-Craft  R-Process', 8, GAME_H - 120);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FF8888';
        ctx.fillText('P2: Arrows  /-Harvest  .-Toss  ,-Craft  M-Process', GAME_W - 8, GAME_H - 120);
        ctx.restore();
    }

    // ---- Craft Menu ----
    drawCraftMenu(ctx, player, craftingSystem) {
        if (!this.craftMenuOpen) return;

        const menuW = 500;
        const menuH = 360;
        const mx = GAME_W / 2 - menuW / 2;
        const my = GAME_H / 2 - menuH / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);

        ctx.fillStyle = PALETTE.ui.panel;
        ctx.fillRect(mx, my, menuW, menuH);
        ctx.strokeStyle = PALETTE.ui.panelEdge;
        ctx.lineWidth = 3;
        ctx.strokeRect(mx, my, menuW, menuH);

        ctx.font = '14px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.ui.accent1;
        const title = this.craftMenuMode === 'craft' ? 'CRAFT ITEM' : 'PROCESS MATERIAL';
        ctx.fillText(title, GAME_W / 2, my + 30);

        const recipes = this.craftMenuMode === 'craft'
            ? craftingSystem.getAvailableRecipes()
            : PROCESSING_RECIPES;

        const startY = my + 56;
        const visibleCount = Math.min(recipes.length, 10);

        for (let i = 0; i < visibleCount; i++) {
            const recipe = recipes[i];
            const ry = startY + i * 26;
            const selected = i === this.craftMenuSelection;
            const canDo = this.craftMenuMode === 'craft'
                ? player.hasMaterials(recipe.recipe)
                : player.hasMaterials(recipe.input);

            if (selected) {
                ctx.fillStyle = 'rgba(0,255,170,0.15)';
                ctx.fillRect(mx + 8, ry - 10, menuW - 16, 24);
            }

            ctx.font = '10px "Press Start 2P"';
            ctx.textAlign = 'left';
            ctx.fillStyle = canDo ? (selected ? '#00FFAA' : '#CCC') : '#555';
            ctx.fillText(recipe.name, mx + 16, ry + 4);

            ctx.textAlign = 'right';
            ctx.font = '9px "Press Start 2P"';
            const reqs = this.craftMenuMode === 'craft' ? recipe.recipe : recipe.input;
            const reqText = Object.entries(reqs)
                .map(([m, q]) => `${q}×${(MAT_NAMES[m] || m).substring(0, 8)}`)
                .join('  ');
            ctx.fillStyle = canDo ? '#888' : '#444';
            ctx.fillText(reqText, mx + menuW - 16, ry + 4);
        }

        ctx.font = '9px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('↑↓ Select | Enter to Craft | ESC Close', GAME_W / 2, my + menuH - 14);
    }

    openCraftMenu(player, mode = 'craft') {
        this.craftMenuOpen = true;
        this.craftMenuPlayer = player;
        this.craftMenuMode = mode;
        this.craftMenuSelection = 0;
    }

    closeCraftMenu() {
        this.craftMenuOpen = false;
        this.craftMenuPlayer = null;
    }

    // Draw a per-player craft menu confined to a horizontal region of the screen
    drawCraftMenuForPlayer(ctx, player, craftingSystem, areaX, areaW) {
        const isBlue = player.id === 'blue';
        const accent      = isBlue ? '#66BBFF' : '#FF7755';
        const accentDim   = isBlue ? '#2255AA' : '#992200';
        const bgColor     = isBlue ? 'rgba(0,15,50,0.93)' : 'rgba(50,8,0,0.93)';
        const borderColor = isBlue ? '#4488FF' : '#FF4422';
        const selectBg    = isBlue ? 'rgba(0,100,255,0.18)' : 'rgba(255,70,0,0.18)';
        const hint        = isBlue
            ? 'W/S: Select   E: Confirm   F: Close'
            : '\u2191\u2193: Select   /: Confirm   ,: Close';

        const menuW = Math.min(460, areaW - 16);
        const menuH = 320;
        const mx = areaX + (areaW - menuW) / 2;
        const my = Math.floor(GAME_H / 2 - menuH / 2);

        ctx.save();

        // Dim this player's area
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(areaX, 0, areaW, GAME_H);

        // Panel background + border
        ctx.fillStyle = bgColor;
        ctx.fillRect(mx, my, menuW, menuH);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(mx, my, menuW, menuH);

        // Title
        const modeLabel = player.craftMenuMode === 'craft' ? 'CRAFT' : 'PROCESS';
        const pLabel    = isBlue ? 'P1 \u2014 ' : 'P2 \u2014 ';
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        ctx.fillText(pLabel + modeLabel, mx + menuW / 2, my + 26);

        const recipes = player.craftMenuMode === 'craft'
            ? craftingSystem.getAvailableRecipes()
            : PROCESSING_RECIPES;

        const startY = my + 46;

        for (let i = 0; i < Math.min(recipes.length, 10); i++) {
            const recipe = recipes[i];
            const ry = startY + i * 24;
            const selected = i === player.craftMenuSelection;
            const canDo = player.craftMenuMode === 'craft'
                ? player.hasMaterials(recipe.recipe)
                : player.hasMaterials(recipe.input);

            if (selected) {
                ctx.fillStyle = selectBg;
                ctx.fillRect(mx + 8, ry - 9, menuW - 16, 22);
            }

            ctx.font = '9px "Press Start 2P"';
            ctx.textAlign = 'left';
            ctx.fillStyle = canDo ? (selected ? accent : '#CCC') : '#555';
            ctx.fillText(recipe.name, mx + 14, ry + 4);

            const reqs = player.craftMenuMode === 'craft' ? recipe.recipe : recipe.input;
            const reqText = Object.entries(reqs)
                .map(([m, q]) => `${q}\u00d7${(MAT_NAMES[m] || m).substring(0, 8)}`).join('  ');
            ctx.textAlign = 'right';
            ctx.font = '8px "Press Start 2P"';
            ctx.fillStyle = canDo ? '#888' : '#444';
            ctx.fillText(reqText, mx + menuW - 14, ry + 4);
        }

        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#555';
        ctx.fillText(hint, mx + menuW / 2, my + menuH - 12);

        ctx.restore();
    }

    // ---- Screens ----

    drawTitleScreen(ctx, time) {
        // Deep space background
        ctx.fillStyle = '#040410';
        ctx.fillRect(0, 0, GAME_W, GAME_H);

        // Stars with parallax
        for (let i = 0; i < 120; i++) {
            const speed = (i % 3 + 1) * 0.005;
            const sx = (i * 137 + time * speed * 3) % GAME_W;
            const sy = (i * 97 + Math.sin(time * 0.001 + i * 0.5) * 8) % GAME_H;
            const brightness = Math.sin(time * 0.003 + i) * 40 + 80;
            const size = i % 5 === 0 ? 3 : (i % 3 === 0 ? 2 : 1);
            ctx.fillStyle = `rgba(${brightness + 60},${brightness + 40},${brightness + 100},${0.5 + Math.sin(time * 0.005 + i) * 0.3})`;
            ctx.fillRect(Math.floor(sx), Math.floor(sy), size, size);
        }

        // Floating flat islands in the background
        const drawFlatIsland = (ix, iy, w, h, color, t) => {
            const bob = Math.sin(t * 0.002 + ix * 0.1) * 8;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(ix, iy + bob);
            ctx.lineTo(ix + w / 2, iy - h + bob);
            ctx.lineTo(ix + w, iy + bob);
            ctx.lineTo(ix + w * 0.85, iy + h * 0.4 + bob);
            ctx.lineTo(ix + w * 0.15, iy + h * 0.4 + bob);
            ctx.closePath();
            ctx.fill();
            // Edge
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(ix, iy + bob);
            ctx.lineTo(ix + w * 0.15, iy + h * 0.4 + bob);
            ctx.lineTo(ix + w * 0.85, iy + h * 0.4 + bob);
            ctx.lineTo(ix + w, iy + bob);
            ctx.closePath();
            ctx.fill();
        };
        drawFlatIsland(100, 460, 180, 60, '#2a5c5c', time);
        drawFlatIsland(980, 420, 200, 70, '#6b3a2a', time + 1000);
        drawFlatIsland(500, 500, 160, 50, '#4a4a3a', time + 2000);

        // Title with glow and animation
        ctx.save();
        const scale = 1 + Math.sin(time * 0.002) * 0.04;
        ctx.translate(GAME_W / 2, 180);
        ctx.scale(scale, scale);

        // Title shadow
        ctx.font = '44px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText('FLAT-EARTHURZ', 3, 3);

        // Main title with glow
        ctx.shadowColor = '#00FFAA';
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#00FFAA';
        ctx.fillText('FLAT-EARTHURZ', 0, 0);

        // Second pass for extra glow
        ctx.shadowBlur = 50;
        ctx.globalAlpha = 0.4;
        ctx.fillText('FLAT-EARTHURZ', 0, 0);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();

        // Subtitle
        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText('Cooperative Flat World Construction', GAME_W / 2, 240);

        // Decorative line
        const lineW = 300;
        ctx.strokeStyle = '#00FFAA33';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(GAME_W / 2 - lineW, 260);
        ctx.lineTo(GAME_W / 2 + lineW, 260);
        ctx.stroke();

        // Controls
        ctx.font = '11px "Press Start 2P"';
        ctx.fillStyle = '#4488FF';
        ctx.fillText('Player 1 (Blue): WASD + E/Q/F/R', GAME_W / 2, 310);
        ctx.fillStyle = '#FF4444';
        ctx.fillText('Player 2 (Red): Arrows + / . , M', GAME_W / 2, 340);

        // How to play
        ctx.font = '9px "Press Start 2P"';
        ctx.fillStyle = '#555';
        ctx.fillText('Harvest resources • Toss between islands • Craft & Deliver!', GAME_W / 2, 390);

        // Start prompt
        const blink = Math.sin(time * 0.005) > 0;
        if (blink) {
            ctx.font = '16px "Press Start 2P"';
            ctx.fillStyle = '#FFF';
            ctx.shadowColor = '#FFF';
            ctx.shadowBlur = 10;
            ctx.fillText('PRESS SPACE TO START', GAME_W / 2, 480);
            ctx.shadowBlur = 0;
        }

        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = '#333';
        ctx.fillText('Game Jam 2026', GAME_W / 2, GAME_H - 16);
    }

    drawPauseOverlay(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.font = '24px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFF';
        ctx.fillText('PAUSED', GAME_W / 2, GAME_H / 2 - 20);
        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = '#888';
        ctx.fillText('Press ESC to resume', GAME_W / 2, GAME_H / 2 + 20);
    }

    drawRoundResults(ctx, summary, time) {
        ctx.fillStyle = 'rgba(5,5,20,0.9)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);

        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.ui.accent1;
        ctx.fillText(`ROUND ${summary.round + 1} COMPLETE`, GAME_W / 2, 120);

        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = '#CCC';
        ctx.fillText(`Orders Completed: ${summary.completed}/${summary.totalOrders}`, GAME_W / 2, 200);
        ctx.fillText(`Orders Failed: ${summary.failed}`, GAME_W / 2, 230);
        ctx.fillText(`Max Combo: ${summary.maxCombo}x`, GAME_W / 2, 260);

        ctx.fillStyle = PALETTE.ui.star;
        ctx.font = '24px "Press Start 2P"';
        ctx.fillText(`★ ${summary.totalStars}/${summary.maxStars}`, GAME_W / 2, 330);

        const ratio = summary.totalStars / summary.maxStars;
        let rating = 'D';
        if (ratio >= 0.9) rating = 'S';
        else if (ratio >= 0.7) rating = 'A';
        else if (ratio >= 0.5) rating = 'B';
        else if (ratio >= 0.3) rating = 'C';

        ctx.font = '40px "Press Start 2P"';
        ctx.fillStyle = rating === 'S' ? '#FFD700' : rating === 'A' ? '#00FFAA' : '#CCC';
        ctx.fillText(rating, GAME_W / 2, 420);

        const blink = Math.sin(time * 0.005) > 0;
        if (blink) {
            ctx.font = '12px "Press Start 2P"';
            ctx.fillStyle = '#888';
            ctx.fillText('Press SPACE to continue', GAME_W / 2, 530);
        }
    }

    drawGameOver(ctx, totalStars, rounds, time) {
        ctx.fillStyle = '#080818';
        ctx.fillRect(0, 0, GAME_W, GAME_H);

        ctx.font = '24px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('GAME COMPLETE!', GAME_W / 2, 160);

        ctx.font = '16px "Press Start 2P"';
        ctx.fillStyle = '#CCC';
        ctx.fillText(`Total Stars: ${totalStars}`, GAME_W / 2, 260);
        ctx.fillText(`Rounds: ${rounds}`, GAME_W / 2, 300);

        const blink = Math.sin(time * 0.005) > 0;
        if (blink) {
            ctx.font = '12px "Press Start 2P"';
            ctx.fillStyle = '#888';
            ctx.fillText('Press SPACE to play again', GAME_W / 2, 480);
        }
    }
}
