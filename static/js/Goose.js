import { GooseState, SIMULATION_PARAMS, clamp, randomNormal, currentDifficulty } from './constants.js';
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

        this.vx          = Math.random() * 0.2 - 0.1;
        this.vy          = Math.random() * 0.2 - 0.1;
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
        this.hatching = false;
        this.breedingCooldown = 0;

        // Personal scatter offset so goslings don't all stack on the parent
        this.flockOffsetX = (Math.random() - 0.5) * 80;
        this.flockOffsetY = (Math.random() - 0.5) * 80;

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

    move(width, height, flock = []) {
        if (this.state === GooseState.EGG) return;
        if (this.hiding)  return; // frozen while hiding in bush
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
        } else if (this.state === GooseState.GOSLING) {
            // Find closest adult (fall back to parent if none)
            const adults = flock.filter(g => g.state === GooseState.ADULT);
            let closestAdult = this.parent;
            let minDist = Infinity;
            for (const a of adults) {
                const d = Math.sqrt((a.x - this.x) ** 2 + (a.y - this.y) ** 2);
                if (d < minDist) { minDist = d; closestAdult = a; }
            }
            if (!closestAdult) { this._gslingDist = 0; }
            else {
                const targetX = closestAdult.x + this.flockOffsetX;
                const targetY = closestAdult.y + this.flockOffsetY;
                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const distToTarget = Math.sqrt(dx * dx + dy * dy);
                this._gslingDist = distToTarget;
                // Far away → fast focused chase; close → lazy drift
                const divisor = distToTarget > 80 ? 7 : distToTarget > 40 ? 14 : 28;
                const jitter  = distToTarget > 80 ? 0.15 : 0.4;
                this.vx = dx / divisor + Math.random() * jitter * 2 - jitter;
                this.vy = dy / divisor + Math.random() * jitter * 2 - jitter;
            }
        } else {
            if (Math.random() < 0.08) {
                this.vx += Math.random() * 0.22 - 0.11;
                this.vy += Math.random() * 0.22 - 0.11;
            }

            // Separation — push away from nearby geese
            for (const other of flock) {
                if (other === this || other.state === GooseState.EGG) continue;
                const dx = this.x - other.x;
                const dy = this.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 40 && dist > 0) {
                    const force = (40 - dist) / 40 * 0.12;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                }
            }

            this.vx *= 0.997;
            this.vy *= 0.997;
            const baseRegen  = currentDifficulty === 'hard' ? 0.03 : currentDifficulty === 'normal' ? 0.07 : 0.1;
            const moveSpd    = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const exerciseBonus = moveSpd > 0.1 ? moveSpd * 0.1 : 0; // up to ~+50% regen at full speed
            const regenRate  = baseRegen + exerciseBonus;
            if (this.energy < 100) this.energy = Math.min(100, this.energy + regenRate);
        }

        const maxSpeed = this.state === GooseState.GOSLING
            ? (this._gslingDist > 80 ? 0.6 : this._gslingDist > 40 ? 0.42 : 0.25)
            : 0.4;
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
