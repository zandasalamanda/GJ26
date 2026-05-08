// ============================================
// FLAT-EARTHRZ — UI System
// ============================================

import { GAME_W, GAME_H, PALETTE, MAT_NAMES, MAT_COLORS, PLAYER_INVENTORY_SIZE, formatTime, PROCESSING_RECIPES } from './utils.js';
import { BUILD_STAGES, TOTAL_SHOWERS, DIFFICULTY, DEFENSE_THRESHOLD, SUSTAIN_THRESHOLD } from './progression.js';

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

    drawHUD(ctx, progression, players, gameState, hubStockpile = {}) {
        this._drawBuildChecklist(ctx, progression, players, hubStockpile);
        this._drawDefenseBar(ctx, progression);
        this._drawInventory(ctx, players[0], 8, GAME_H - 80, 'left');
        this._drawInventory(ctx, players[1], GAME_W - 210, GAME_H - 80, 'right');
        this._drawShowerInfo(ctx, progression);
        this._drawNotifications(ctx);
        this._drawFloatingTexts(ctx);
        this._drawControls(ctx);
    }

    _drawBuildChecklist(ctx, progression, players, hubStockpile = {}) {
        const build = progression.getCurrentBuild();
        ctx.fillStyle = 'rgba(10,10,30,0.85)';
        ctx.fillRect(0, 0, GAME_W, 56);
        ctx.fillStyle = PALETTE.ui.panelEdge;
        ctx.fillRect(0, 56, GAME_W, 2);

        if (!build) {
            ctx.font = '12px "Press Start 2P"';
            ctx.fillStyle = '#00FFAA';
            ctx.textAlign = 'center';
            ctx.fillText('ALL STRUCTURES BUILT! Prepare for final shower!', GAME_W / 2, 30);
            return;
        }

        // Build name
        ctx.font = '11px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#00FFAA';
        ctx.fillText(`BUILD: ${build.name}`, 12, 18);
        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = '#888';
        ctx.fillText(build.desc, 12, 34);

        // Material checklist — from hub stockpile
        let matX = 12;
        ctx.font = '8px "Press Start 2P"';
        for (const [mat, qty] of Object.entries(build.recipe)) {
            const have = hubStockpile[mat] || 0;
            const done = have >= qty;
            ctx.fillStyle = done ? '#00FF88' : '#FF6644';
            const label = `${done ? '✓' : '✗'} ${MAT_NAMES[mat] || mat}: ${have}/${qty}`;
            ctx.fillText(label, matX, 50);
            matX += ctx.measureText(label).width + 16;
        }

        // Defense / Sustain scores on right
        ctx.textAlign = 'right';
        ctx.font = '9px "Press Start 2P"';
        ctx.fillStyle = '#FF8844';
        ctx.fillText(`DEF: ${progression.defenseScore}`, GAME_W - 12, 18);
        ctx.fillStyle = '#44DD88';
        ctx.fillText(`SUS: ${progression.sustainScore}`, GAME_W - 12, 34);
        ctx.fillStyle = '#888';
        ctx.fillText(`${progression.totalBuilt}/${BUILD_STAGES.length} built`, GAME_W - 12, 50);
    }

    _drawDefenseBar(ctx, progression) {
        // Defense progress bar — shows survival readiness
        const barY = 60;
        const barH = 6;
        const barX = 12;
        const barW = GAME_W - 24;
        const defPct = Math.min(1, progression.defenseScore / DEFENSE_THRESHOLD);
        const susPct = Math.min(1, progression.sustainScore / SUSTAIN_THRESHOLD);
        const totalPct = (defPct + susPct) / 2;

        // Background
        ctx.fillStyle = 'rgba(20,20,40,0.7)';
        ctx.fillRect(barX, barY, barW, barH);

        // Defense half (left)
        const halfW = barW / 2 - 2;
        ctx.fillStyle = defPct >= 1 ? '#44FF88' : '#FF8844';
        ctx.fillRect(barX, barY, halfW * defPct, barH);

        // Sustain half (right)
        ctx.fillStyle = susPct >= 1 ? '#44DDFF' : '#FFDD44';
        ctx.fillRect(barX + halfW + 4, barY, halfW * susPct, barH);

        // Labels
        ctx.font = '6px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#999';
        ctx.fillText(`DEF ${Math.floor(defPct * 100)}%`, barX + 2, barY + barH + 10);
        ctx.textAlign = 'right';
        ctx.fillText(`SUS ${Math.floor(susPct * 100)}%`, barX + barW - 2, barY + barH + 10);
        ctx.textAlign = 'center';
        ctx.fillStyle = totalPct >= 1 ? '#44FF88' : '#AAA';
        ctx.fillText(totalPct >= 1 ? '✓ SURVIVABLE' : `${Math.floor(totalPct * 100)}% Ready`, GAME_W / 2, barY + barH + 10);
    }

    _drawShowerInfo(ctx, progression) {
        const x = GAME_W / 2;
        const y = GAME_H - 18;
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'center';
        // Shower countdown
        const secsLeft = Math.ceil(progression.showerTimer / 1000);
        const timeStr = formatTime(secsLeft);
        const urgent = secsLeft < 30;
        ctx.fillStyle = urgent ? '#FF4444' : '#FFDD44';
        ctx.fillText(`☄ Shower ${progression.showerCount + 1}/${TOTAL_SHOWERS} in ${timeStr}`, x, y);
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
        // Deep space gradient
        const grad = ctx.createLinearGradient(0, 0, 0, GAME_H);
        grad.addColorStop(0, '#060818');
        grad.addColorStop(0.5, '#0a0a20');
        grad.addColorStop(1, '#040410');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GAME_W, GAME_H);

        // Stars — multiple layers
        for (let i = 0; i < 150; i++) {
            const speed = (i % 3 + 1) * 0.004;
            const sx = (i * 137 + time * speed * 2) % GAME_W;
            const sy = (i * 97 + Math.sin(time * 0.001 + i * 0.5) * 6) % GAME_H;
            const brightness = Math.sin(time * 0.003 + i) * 40 + 100;
            const size = i % 7 === 0 ? 3 : (i % 3 === 0 ? 2 : 1);
            ctx.fillStyle = `rgba(${brightness + 60},${brightness + 40},${brightness + 100},${0.4 + Math.sin(time * 0.005 + i) * 0.3})`;
            ctx.fillRect(Math.floor(sx), Math.floor(sy), size, size);
        }

        // Meteor streaks in background
        for (let i = 0; i < 3; i++) {
            const mt = (time * 0.3 + i * 2000) % 6000;
            if (mt < 800) {
                const mx = (i * 400 + 200) + mt * 0.8;
                const my = 50 + i * 120 + mt * 0.3;
                const alpha = 1 - mt / 800;
                ctx.strokeStyle = `rgba(255,120,40,${alpha * 0.6})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(mx, my);
                ctx.lineTo(mx - 40, my - 15);
                ctx.stroke();
                ctx.fillStyle = `rgba(255,200,80,${alpha})`;
                ctx.beginPath();
                ctx.arc(mx, my, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Three floating islands — larger and more detailed
        const drawIsland = (ix, iy, w, h, color, edgeColor, t, label) => {
            const bob = Math.sin(t * 0.0015 + ix * 0.08) * 10;
            const y = iy + bob;
            // Island body
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(ix, y);
            ctx.lineTo(ix + w / 2, y - h);
            ctx.lineTo(ix + w, y);
            ctx.lineTo(ix + w * 0.85, y + h * 0.5);
            ctx.lineTo(ix + w * 0.15, y + h * 0.5);
            ctx.closePath();
            ctx.fill();
            // Edge shadow
            ctx.fillStyle = edgeColor;
            ctx.beginPath();
            ctx.moveTo(ix, y);
            ctx.lineTo(ix + w * 0.15, y + h * 0.5);
            ctx.lineTo(ix + w * 0.85, y + h * 0.5);
            ctx.lineTo(ix + w, y);
            ctx.closePath();
            ctx.fill();
            // Label
            ctx.font = '7px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(label, ix + w / 2, y - h - 6 + bob);
            // Surface details — little shapes
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            for (let j = 0; j < 4; j++) {
                const dx = w * 0.2 + j * w * 0.18;
                const dy = -h * 0.3 + Math.sin(j * 2 + t * 0.001) * 3;
                ctx.fillRect(ix + dx - 3, y + dy, 6, 4);
            }
        };
        drawIsland(50, 420, 220, 70, '#1a4a4a', '#0d2d2d', time, 'BLUE WORLD');
        drawIsland(GAME_W - 290, 400, 240, 75, '#5a2a1a', '#3a1a0a', time + 1200, 'RED WORLD');
        drawIsland(GAME_W / 2 - 100, 480, 200, 55, '#3a3a2a', '#2a2a1a', time + 600, 'THE HUB');

        // Connecting lines (bridges hint)
        ctx.strokeStyle = 'rgba(0,255,170,0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(250, 420);
        ctx.lineTo(GAME_W / 2 - 60, 480);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(GAME_W - 100, 400);
        ctx.lineTo(GAME_W / 2 + 60, 475);
        ctx.stroke();
        ctx.setLineDash([]);

        // ---- Title ----
        ctx.save();
        const scale = 1 + Math.sin(time * 0.002) * 0.03;
        ctx.translate(GAME_W / 2, 110);
        ctx.scale(scale, scale);
        ctx.font = '48px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText('FLAT-EARTHRZ', 3, 3);
        ctx.shadowColor = '#00FFAA';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#00FFAA';
        ctx.fillText('FLAT-EARTHRZ', 0, 0);
        ctx.shadowBlur = 60;
        ctx.globalAlpha = 0.3;
        ctx.fillText('FLAT-EARTHRZ', 0, 0);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.font = '10px "Press Start 2P"';
        ctx.fillStyle = '#557';
        ctx.textAlign = 'center';
        ctx.fillText('A Cooperative Survival Story', GAME_W / 2, 152);

        // ---- Two info cards side by side ----
        const cardW = 380;
        const cardH = 130;
        const cardGap = 40;
        const cardY = 185;
        const leftX = GAME_W / 2 - cardGap / 2 - cardW;
        const rightX = GAME_W / 2 + cardGap / 2;

        // Left card — Story
        ctx.fillStyle = 'rgba(0,20,30,0.7)';
        ctx.fillRect(leftX, cardY, cardW, cardH);
        ctx.strokeStyle = '#00FFAA33';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftX, cardY, cardW, cardH);
        ctx.font = '9px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#00FFAA';
        ctx.fillText('THE STORY', leftX + 14, cardY + 20);
        ctx.font = '7px "Press Start 2P"';
        ctx.fillStyle = '#8899AA';
        const storyLines = [
            'Two alien species crash-landed on',
            'floating flat worlds in the void.',
            'A center island is their only hope.',
            'Build civilization together. Survive',
            '5 meteor showers. The final one will',
            'destroy your worlds... but you might',
            'just live on together.',
        ];
        for (let i = 0; i < storyLines.length; i++) {
            ctx.fillText(storyLines[i], leftX + 14, cardY + 38 + i * 13);
        }

        // Right card — Controls
        ctx.fillStyle = 'rgba(20,0,20,0.7)';
        ctx.fillRect(rightX, cardY, cardW, cardH);
        ctx.strokeStyle = '#FFDD4433';
        ctx.lineWidth = 1;
        ctx.strokeRect(rightX, cardY, cardW, cardH);
        ctx.font = '9px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFDD44';
        ctx.fillText('CONTROLS', rightX + 14, cardY + 20);
        ctx.font = '7px "Press Start 2P"';
        ctx.fillStyle = '#4488FF';
        ctx.fillText('P1 (Blue)', rightX + 14, cardY + 40);
        ctx.fillStyle = '#7799CC';
        ctx.fillText('WASD  E-Harvest  Q-Toss', rightX + 14, cardY + 55);
        ctx.fillText('F-Build  R-Process', rightX + 14, cardY + 68);
        ctx.fillStyle = '#FF5544';
        ctx.fillText('P2 (Red)', rightX + 14, cardY + 88);
        ctx.fillStyle = '#CC8877';
        ctx.fillText('Arrows  /-Harvest  .-Toss', rightX + 14, cardY + 103);
        ctx.fillText(',-Build  M-Process  Enter', rightX + 14, cardY + 116);

        // Start prompt
        const blink = Math.sin(time * 0.005) > 0;
        if (blink) {
            ctx.font = '14px "Press Start 2P"';
            ctx.fillStyle = '#FFF';
            ctx.shadowColor = '#00FFAA';
            ctx.shadowBlur = 15;
            ctx.textAlign = 'center';
            ctx.fillText('PRESS SPACE TO START', GAME_W / 2, 365);
            ctx.shadowBlur = 0;
        }

        ctx.font = '7px "Press Start 2P"';
        ctx.fillStyle = '#222';
        ctx.textAlign = 'center';
        ctx.fillText('Game Jam 2026', GAME_W / 2, GAME_H - 12);
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

    drawDifficultySelect(ctx, selectedIdx, diffKeys, time) {
        ctx.fillStyle = '#040410';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00FFAA';
        ctx.fillText('SELECT DIFFICULTY', GAME_W / 2, 160);
        const labels = ['EASY', 'NORMAL', 'HARD'];
        const descs = ['8 min between showers', '5 min between showers', '3 min between showers'];
        const colors = ['#44FF44', '#FFDD44', '#FF4444'];
        for (let i = 0; i < 3; i++) {
            const y = 260 + i * 80;
            const sel = i === selectedIdx;
            if (sel) { ctx.fillStyle = 'rgba(0,255,170,0.1)'; ctx.fillRect(GAME_W/2-250, y-25, 500, 55); }
            ctx.font = sel ? '18px "Press Start 2P"' : '14px "Press Start 2P"';
            ctx.fillStyle = sel ? colors[i] : '#555';
            ctx.fillText(labels[i], GAME_W / 2, y);
            ctx.font = '9px "Press Start 2P"';
            ctx.fillStyle = sel ? '#AAA' : '#444';
            ctx.fillText(descs[i], GAME_W / 2, y + 22);
        }
        if (Math.sin(time * 0.005) > 0) {
            ctx.font = '11px "Press Start 2P"'; ctx.fillStyle = '#888';
            ctx.fillText('A/D or Arrows to select \u2022 SPACE/ENTER to confirm', GAME_W / 2, 560);
        }
    }

    drawShowerWarning(ctx, timer, showerNum, totalShowers, time) {
        const alpha = 0.3 + Math.sin(time * 0.01) * 0.15;
        ctx.fillStyle = `rgba(255,30,0,${alpha})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.font = '22px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillStyle = '#FF4444';
        ctx.fillText('\u26A0 METEOR SHOWER INCOMING \u26A0', GAME_W / 2, GAME_H / 2 - 30);
        ctx.font = '14px "Press Start 2P"'; ctx.fillStyle = '#FFD700';
        ctx.fillText(`Shower ${showerNum}/${totalShowers}`, GAME_W / 2, GAME_H / 2 + 10);
        ctx.font = '28px "Press Start 2P"'; ctx.fillStyle = '#FFF';
        ctx.fillText(Math.ceil(timer / 1000).toString(), GAME_W / 2, GAME_H / 2 + 60);
    }

    drawShowerActive(ctx, timer, showerNum, totalShowers) {
        ctx.font = '12px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillStyle = '#FF4444';
        ctx.fillText(`\u2604 SHOWER ${showerNum}/${totalShowers} \u2014 ${Math.ceil(timer/1000)}s`, GAME_W / 2, GAME_H - 40);
    }

    drawWinScreen(ctx, progression, time) {
        ctx.fillStyle = '#040420'; ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.font = '28px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.fillStyle = '#00FFAA'; ctx.shadowColor = '#00FFAA'; ctx.shadowBlur = 20;
        ctx.fillText('CIVILIZATION SAVED', GAME_W / 2, 140); ctx.shadowBlur = 0;
        ctx.font = '11px "Press Start 2P"'; ctx.fillStyle = '#CCC';
        ctx.fillText('The final shower destroyed both outer worlds,', GAME_W / 2, 220);
        ctx.fillText('but your civilization endures on the center hub.', GAME_W / 2, 245);
        ctx.fillText('Two species, once stranded, now thrive as one.', GAME_W / 2, 270);
        ctx.font = '10px "Press Start 2P"';
        ctx.fillStyle = '#FF8844'; ctx.fillText(`Defense: ${progression.defenseScore}`, GAME_W / 2, 340);
        ctx.fillStyle = '#44DD88'; ctx.fillText(`Sustainability: ${progression.sustainScore}`, GAME_W / 2, 365);
        ctx.fillStyle = '#FFDD44'; ctx.fillText(`Structures: ${progression.totalBuilt}/${BUILD_STAGES.length}`, GAME_W / 2, 390);
        if (Math.sin(time * 0.005) > 0) {
            ctx.font = '12px "Press Start 2P"'; ctx.fillStyle = '#888';
            ctx.fillText('Press SPACE to play again', GAME_W / 2, 500);
        }
    }

    drawLossScreen(ctx, progression, time) {
        ctx.fillStyle = '#100404'; ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.font = '28px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.fillStyle = '#FF3333'; ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 20;
        ctx.fillText('CIVILIZATION LOST', GAME_W / 2, 140); ctx.shadowBlur = 0;
        ctx.font = '11px "Press Start 2P"'; ctx.fillStyle = '#999';
        ctx.fillText('The meteors were too powerful.', GAME_W / 2, 220);
        ctx.fillText('Without adequate defense and sustainability,', GAME_W / 2, 245);
        ctx.fillText('the hub crumbled into the void.', GAME_W / 2, 270);
        ctx.font = '10px "Press Start 2P"';
        ctx.fillStyle = '#FF8844'; ctx.fillText(`Defense: ${progression.defenseScore} (need 80)`, GAME_W / 2, 340);
        ctx.fillStyle = '#44DD88'; ctx.fillText(`Sustain: ${progression.sustainScore} (need 80)`, GAME_W / 2, 365);
        if (Math.sin(time * 0.005) > 0) {
            ctx.font = '12px "Press Start 2P"'; ctx.fillStyle = '#888';
            ctx.fillText('Press SPACE to try again', GAME_W / 2, 500);
        }
    }

    drawGameOver(ctx, a, b, time) {
        ctx.fillStyle = '#080818'; ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.font = '24px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFD700';
        ctx.fillText('GAME OVER', GAME_W / 2, GAME_H / 2);
        if (Math.sin(time * 0.005) > 0) {
            ctx.font = '12px "Press Start 2P"'; ctx.fillStyle = '#888';
            ctx.fillText('Press SPACE to play again', GAME_W / 2, GAME_H / 2 + 60);
        }
    }
}
