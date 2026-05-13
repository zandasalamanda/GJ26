// ============================================
// ALIEN ASSEMBLY LINE — Particle System
// ============================================

import { lerp, randRange, GAME_W, GAME_H } from './utils.js';

class Particle {
    constructor(x, y, vx, vy, color, size, life, gravity = 0, friction = 1, shape = 'square') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.maxLife = life;
        this.life = life;
        this.gravity = gravity;
        this.friction = friction;
        this.shape = shape; // 'square', 'circle', 'star', 'line'
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = randRange(-0.1, 0.1);
        this.alpha = 1;
    }

    update(dt) {
        this.life -= dt;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.rotation += this.rotSpeed;
        this.alpha = Math.max(0, this.life / this.maxLife);
    }

    draw(ctx) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        const s = this.size * (0.5 + 0.5 * this.alpha);

        if (this.shape === 'line') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-s, 0);
            ctx.lineTo(s, 0);
            ctx.stroke();
        } else {
            ctx.fillRect(-s / 2, -s / 2, s, s);
        }

        ctx.restore();
    }

    get dead() {
        return this.life <= 0;
    }
}

// World-space particle: stores iso coordinates so it trails correctly in split-screen
class WorldParticle {
    constructor(isoX, isoY, vx, vy, color, size, life) {
        this.isoX = isoX + randRange(-5, 5);
        this.isoY = isoY + randRange(-3, 3);
        this.vx = vx; // iso-pixels per frame
        this.vy = vy;
        this.color = color;
        this.size = size; // radius in iso-pixels (scaled by cam.zoom when drawn)
        this.maxLife = life;
        this.life = life;
        this.gravity = 0; // for debris arcs
    }
    update(dt) {
        this.life -= dt;
        this.vy += this.gravity * (dt / 16);
        this.isoX += this.vx * (dt / 16);
        this.isoY += this.vy * (dt / 16);
    }
    draw(ctx, cam) {
        const alpha = Math.max(0, this.life / this.maxLife);
        if (alpha <= 0) return;
        const sx = (this.isoX - cam.x) * cam.zoom + GAME_W / 2;
        const sy = (this.isoY - cam.y) * cam.zoom + GAME_H / 2;
        ctx.save();
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.fillRect(sx - (this.size * cam.zoom)/2, sy - (this.size * cam.zoom)/2, this.size * cam.zoom, this.size * cam.zoom);
        ctx.restore();
    }
    get dead() { return this.life <= 0; }
}

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.worldParticles = [];
        this.maxParticles = 500;
    }

    add(p) {
        if (this.particles.length < this.maxParticles) {
            this.particles.push(p);
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].dead) {
                this.particles.splice(i, 1);
            }
        }
        for (let i = this.worldParticles.length - 1; i >= 0; i--) {
            this.worldParticles[i].update(dt);
            if (this.worldParticles[i].dead) this.worldParticles.splice(i, 1);
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }
    }

    clear() {
        this.particles = [];
    }

    get count() {
        return this.particles.length;
    }

    // ---- Emission Presets ----

    emitHarvestSparks(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.add(new Particle(
                x + randRange(-6, 6),
                y + randRange(-6, 6),
                randRange(-2.5, 2.5),
                randRange(-3.5, -0.8),
                color,
                randRange(2, 5),
                randRange(400, 700),
                0.07,
                0.97,
                'square'
            ));
        }
    }

    emitCraftBurst(x, y, count = 20) {
        const colors = ['#FFD700', '#FF8800', '#FFFFFF', '#00FFAA'];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = randRange(1, 3);
            this.add(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                colors[i % colors.length],
                randRange(1.5, 3),
                randRange(400, 800),
                0.02,
                0.96,
                'square'
            ));
        }
    }

    emitDeliveryBurst(x, y, count = 30) {
        const colors = ['#00FFAA', '#44FF88', '#AAFFDD', '#FFFFFF'];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = randRange(1.5, 4);
            this.add(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                colors[i % colors.length],
                randRange(2, 4),
                randRange(500, 1000),
                0.01,
                0.95,
                'square'
            ));
        }
    }

    emitTossTrail(x, y, color) {
        this.add(new Particle(
            x + randRange(-2, 2),
            y + randRange(-2, 2),
            randRange(-0.3, 0.3),
            randRange(-0.5, 0),
            color,
            randRange(1, 2.5),
            randRange(200, 400),
            0,
            0.98,
            'square'
        ));
    }

    emitPowerupCollect(x, y, color, count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = randRange(2, 4);
            this.add(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                color,
                randRange(2, 4),
                randRange(400, 700),
                0,
                0.94,
                'square'
            ));
        }
    }

    emitStarBurst(x, y, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = randRange(0, Math.PI * 2);
            const speed = randRange(1, 3);
            this.add(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                '#FFD700',
                randRange(2, 4),
                randRange(500, 900),
                0.03,
                0.96,
                'square'
            ));
        }
    }

    emitAmbientDust(x, y, color, count = 2) {
        for (let i = 0; i < count; i++) {
            this.add(new Particle(
                x + randRange(-8, 8),
                y + randRange(-4, 4),
                randRange(-0.5, 0.5),
                randRange(-0.6, -0.15),
                color,
                randRange(1.5, 3),
                randRange(700, 1400),
                -0.003,
                0.99,
                'square'
            ));
        }
    }

    // Emit in ISO/world space — stays at world position as camera moves, trailing correctly
    emitAmbientTrail(isoX, isoY, color, count = 1) {
        for (let i = 0; i < count; i++) {
            this.worldParticles.push(new WorldParticle(
                isoX, isoY,
                randRange(-0.15, 0.15),
                randRange(-0.35, -0.08),
                color,
                randRange(0.4, 1.0),
                randRange(500, 950)
            ));
        }
    }

    // Must be called inside drawSceneWithCamera so each viewport uses its own cam
    drawWorldParticles(ctx, cam) {
        for (const p of this.worldParticles) p.draw(ctx, cam);
    }

    emitNodeShake(x, y, color, count = 4) {
        for (let i = 0; i < count; i++) {
            this.add(new Particle(
                x + randRange(-3, 3),
                y + randRange(-3, 3),
                randRange(-0.8, 0.8),
                randRange(-1.5, -0.3),
                color,
                randRange(1, 2),
                randRange(300, 500),
                0.08,
                0.97,
                'square'
            ));
        }
    }

    emitComboText(x, y, text, color = '#FFD700') {
        // Combo text is handled differently — just emit sparkles
        for (let i = 0; i < 8; i++) {
            this.add(new Particle(
                x + randRange(-10, 10),
                y + randRange(-5, 5),
                randRange(-1, 1),
                randRange(-2, -1),
                color,
                randRange(1.5, 3),
                randRange(400, 700),
                0.02,
                0.97,
                'square'
            ));
        }
    }

    emitWarningPulse(x, y) {
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            this.add(new Particle(
                x, y,
                Math.cos(angle) * 2,
                Math.sin(angle) * 1,
                '#FF3333',
                3,
                500,
                0,
                0.96,
                'square'
            ));
        }
    }

    emitVoidStars(viewX, viewY, viewW, viewH, count = 1) {
        for (let i = 0; i < count; i++) {
            this.add(new Particle(
                viewX + randRange(0, viewW),
                viewY + randRange(0, viewH),
                randRange(-0.05, 0.05),
                randRange(-0.05, 0.05),
                `hsl(${randRange(200, 280)}, 30%, ${randRange(20, 50)}%)`,
                randRange(0.5, 1.5),
                randRange(2000, 5000),
                0,
                1,
                'square'
            ));
        }
    }

    // Meteor explosion — hugely upscaled denial effect erupting from ground (World-space)
    emitMeteorExplosionWorld(isoX, isoY, count = 30) {
        // Massive expanding ring
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = randRange(4, 10);
            this.worldParticles.push(new WorldParticle(
                isoX, isoY,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed * 0.5,
                `hsl(${randRange(10, 40)}, 100%, ${randRange(50, 70)}%)`,
                randRange(4, 8),
                randRange(600, 1000)
            ));
        }
        // Debris shooting up
        for (let i = 0; i < 15; i++) {
            const angle = randRange(0, Math.PI * 2);
            const speed = randRange(3, 8);
            const p = new WorldParticle(
                isoX, isoY,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 5, // shoot upwards
                '#222222', // dark stones
                randRange(4, 12),
                randRange(800, 1500)
            );
            p.gravity = 0.15; // Requires modifying WorldParticle to support gravity
            this.worldParticles.push(p);
        }
    }

    // Trailing sparks from a falling meteor
    emitMeteorTrail(x, y) {
        if (Math.random() > 0.6) return; // 60% chance each call
        this.add(new Particle(
            x + randRange(-4, 4), y + randRange(-2, 2),
            randRange(-2, 2), randRange(-1, 3),
            `hsl(${randRange(10, 45)}, 100%, ${randRange(50, 80)}%)`,
            randRange(2, 4),
            randRange(200, 500),
            0.08,
            0.92,
            'square'
        ));
    }

    // World-space toss trail — uses worldParticles so it works in split screen
    emitTossTrailWorld(isoX, isoY, color, count = 1) {
        for (let i = 0; i < count; i++) {
            this.worldParticles.push(new WorldParticle(
                isoX + randRange(-0.1, 0.1),
                isoY + randRange(-0.1, 0.1),
                randRange(-0.08, 0.08),
                randRange(-0.15, 0),
                color,
                randRange(0.3, 0.7),
                randRange(200, 400)
            ));
        }
    }
}
