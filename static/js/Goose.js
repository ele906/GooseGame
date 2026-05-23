import { GooseState, SIMULATION_PARAMS, clamp, randomNormal } from './constants.js';
import { getClimateZone } from './climate.js';

export class Goose {
    constructor(state, weeksLeft, x, y, gender = 'female', parent = null) {
        this.state  = state;
        this.x      = x;
        this.y      = y;
        this.gender = gender;
        this.parent = parent;

        if (state === GooseState.EGG) {
            this.weeksToHatch  = Math.round(clamp(randomNormal(4, 0.5), 2, 6));
            this.weeksLeft     = this.weeksToHatch;
        } else if (state === GooseState.GOSLING) {
            this.weeksToMature = Math.round(clamp(randomNormal(12, 1.5), 8, 16));
            this.weeksLeft     = this.weeksToMature;
        } else {
            this.weeksLeft = weeksLeft;
        }

        this.vx          = Math.random() * 1.2 - 0.6;
        this.vy          = Math.random() * 1.2 - 0.6;
        // Images face LEFT by default. facingLeft=true → no flip. facingLeft=false → flip.
        this.facingLeft  = true;
        this.health      = 100;
        this.ageWeeks    = state === GooseState.ADULT ? 0 : -this.weeksLeft;
        this.hiding      = false;
        this.hidingEndTime = 0;
        this.energy      = 100;
        this.migrating   = false;
        this.migrationTarget = null;

        // Random visual variant for adults (0 = canadagoose_adult, 1 = canadagoose_adult2)
        this.adultVariant = Math.floor(Math.random() * 2);
        this.hatching = false; // true when sitting on a nest of eggs

        this.baseEggSurvival = state === GooseState.EGG
            ? clamp(randomNormal(SIMULATION_PARAMS.EGG_SURVIVAL_MEAN, SIMULATION_PARAMS.EGG_SURVIVAL_STDDEV), 0.3, 1.0)
            : 1.0;

        this.baseGoslingSurvival = clamp(
            randomNormal(SIMULATION_PARAMS.GOSLING_SURVIVAL_MEAN, SIMULATION_PARAMS.GOSLING_SURVIVAL_STDDEV),
            0.3, 1.0
        );

        this.survivalChance = this.calculateSurvivalChance();
    }

    calculateSurvivalChance() {
        let chance = 1.0;
        if (this.state === GooseState.EGG)    chance *= this.baseEggSurvival;
        if (this.state === GooseState.GOSLING) chance *= this.baseGoslingSurvival;
        chance *= (this.energy / 100);
        if (this.game) chance *= getClimateZone(this.game.latitude).survivalMod;
        chance *= (0.95 + Math.random() * 0.10);
        return clamp(chance, 0, 1.0);
    }

    move(width, height) {
        if (this.state === GooseState.EGG) return;
        if (this.hatching) return; // mother stays on nest

        if (this.migrating && this.migrationTarget) {
            const dx = this.migrationTarget.x - this.x;
            const dy = this.migrationTarget.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 50) {
                const wf = 1.0 + (Math.random() - 0.5) * SIMULATION_PARAMS.WEATHER_VARIANCE;
                this.vx = (dx / distance * 3 + Math.random() * 2 - 1) * wf;
                this.vy = (dy / distance * 3 + Math.random() * 2 - 1) * wf;
                this.energy -= SIMULATION_PARAMS.MIGRATION_ENERGY_LOSS;
                if (this.energy <= 0 || Math.random() > SIMULATION_PARAMS.MIGRATION_SUCCESS_RATE) {
                    this.migrating = false;
                    this.energy = Math.max(10, this.energy);
                }
            } else {
                this.migrating = false;
                this.energy = Math.min(100, this.energy + 20);
            }
        } else if (this.state === GooseState.GOSLING && this.parent) {
            const dx = this.parent.x - this.x;
            const dy = this.parent.y - this.y;
            this.vx = dx / 15 + Math.random() * 0.4 - 0.2;
            this.vy = dy / 15 + Math.random() * 0.4 - 0.2;
        } else {
            if (Math.random() < 0.05) {
                this.vx += Math.random() - 0.5;
                this.vy += Math.random() - 0.5;
            }
            if (this.energy < 100) this.energy += 0.05;
        }

        const maxSpeed = this.state === GooseState.GOSLING ? 0.4 : 0.9;
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

        if (Math.random() < 0.01) this.survivalChance = this.calculateSurvivalChance();
    }

    draw(ctx, game) {
        if (this.hiding) ctx.globalAlpha = 0.3;

        if (this.state === GooseState.EGG) {
            // Draw as a plain egg (small)
            const img = game?.images.egg;
            if (img && img.complete && img.naturalWidth > 0) {
                const w = 18;
                const h = (img.naturalHeight / img.naturalWidth) * w;
                ctx.save();
                ctx.drawImage(img, this.x - w / 2, this.y - h / 2, w, h);
                ctx.restore();
            } else {
                ctx.save();
                ctx.fillStyle = '#f5f5dc';
                ctx.beginPath();
                ctx.ellipse(this.x, this.y, 10, 14, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#d3d3d3';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }

        } else if (this.state === GooseState.GOSLING) {
            const img = game?.images.gosling;
            if (img && img.complete && img.naturalWidth > 0) {
                const size = 40;
                ctx.save();
                ctx.translate(this.x, this.y);
                if (!this.facingLeft) ctx.scale(-1, 1);
                ctx.drawImage(img, -size / 2, -size / 2, size, size);
                ctx.restore();
            } else {
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
                ctx.fill();
            }

        } else {
            // Hatching mother uses layegg image (sitting on nest, no flip)
            const img = this.hatching
                ? game?.images.layegg
                : (this.adultVariant === 0 ? game?.images.adult : game?.images.adult2);
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.save();
                if (this.hatching) {
                    const w = 100;
                    const h = (img.naturalHeight / img.naturalWidth) * w;
                    ctx.drawImage(img, this.x - w / 2, this.y - h / 2, w, h);
                } else {
                    const size = 90;
                    ctx.translate(this.x, this.y);
                    if (!this.facingLeft) ctx.scale(-1, 1);
                    ctx.drawImage(img, -size / 2, -size / 2, size, size);
                }
                ctx.restore();
            } else {
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1.0;
    }
}
