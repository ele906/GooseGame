import { PredatorType, GooseState, SIMULATION_PARAMS, clamp } from './constants.js';

export class Predator {
    constructor(type, x, y) {
        this.type    = type;
        this.x       = x;
        this.y       = y;
        this.vx      = Math.random() * 5 - 2.5;
        this.vy      = Math.random() * 5 - 2.5;
        this.facingLeft = true;
        this.variant = Math.floor(Math.random() * 3);
        this.lifespan = 900 + Math.floor(Math.random() * 900); // 15–30 sec at 60fps
        this.leaving  = false;
        this.eatCooldown = 0; // frames remaining before can eat again
    }

    move(width, height, geese) {
        if (this.leaving) {
            // Flee toward nearest edge, ignoring boundary clamping
            const edges = [
                { dx: -1, dy:  0, dist: this.x },
                { dx:  1, dy:  0, dist: width - this.x },
                { dx:  0, dy: -1, dist: this.y },
                { dx:  0, dy:  1, dist: height - this.y },
            ];
            edges.sort((a, b) => a.dist - b.dist);
            this.vx = edges[0].dx * 3.5;
            this.vy = edges[0].dy * 3.5;
            this.x += this.vx;
            this.y += this.vy;
            if      (this.vx < -0.3) this.facingLeft = true;
            else if (this.vx >  0.3) this.facingLeft = false;
            return;
        }

        const nearestGoose = this.findNearestGoose(geese);
        if (nearestGoose) {
            const distance = this.distance(nearestGoose);
            if (distance < 150 && !nearestGoose.hiding) {
                const dx = nearestGoose.x - this.x;
                const dy = nearestGoose.y - this.y;
                this.vx += dx / 20;
                this.vy += dy / 20;
            }
        }

        const maxSpeed = 2.0;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        const margin = 50;
        if (this.x < margin || this.x > width  - margin) this.vx *= -1;
        if (this.y < margin || this.y > height - margin) this.vy *= -1;
        this.x = clamp(this.x, margin, width  - margin);
        this.y = clamp(this.y, margin, height - margin);

        if      (this.vx < -0.3) this.facingLeft = true;
        else if (this.vx >  0.3) this.facingLeft = false;
    }

    findNearestGoose(geese) {
        let nearest = null, minDist = Infinity;
        for (const goose of geese) {
            if (goose.state !== GooseState.EGG && !goose.hiding) {
                const dist = this.distance(goose);
                if (dist < minDist) { minDist = dist; nearest = goose; }
            }
        }
        return nearest;
    }

    distance(goose) {
        const dx = this.x - goose.x, dy = this.y - goose.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    canAttack(goose) {
        if (this.distance(goose) >= 30 || goose.hiding) return false;
        const catchChance = SIMULATION_PARAMS.PREDATOR_CATCH_PROBABILITY * (1 - goose.survivalChance);
        return Math.random() < catchChance;
    }

    draw(ctx, game) {
        const foxImgs   = [game?.images.fox,   game?.images.fox2,   game?.images.fox3];
        const eagleImgs = [game?.images.eagle,  game?.images.eagle2, game?.images.eagle3];
        const imgs = this.type === PredatorType.FOX ? foxImgs : eagleImgs;
        const img  = imgs[this.variant];
        const size = 75;

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            if (!this.facingLeft) ctx.scale(-1, 1);
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            ctx.restore();
        } else {
            ctx.fillStyle = this.type === PredatorType.FOX ? '#FF4500' : '#8B4513';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.type === PredatorType.FOX ? 25 : 22, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
