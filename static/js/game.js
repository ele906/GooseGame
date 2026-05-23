// Game constants - will be set after page loads
let CANVAS_WIDTH = 1000;
let CANVAS_HEIGHT = 600;
const FPS = 60;

// Function to get responsive canvas size
const getResponsiveCanvasSize = () => {
    const maxWidth = Math.min(window.innerWidth * 0.9, 1000);
    const maxHeight = Math.min(window.innerHeight * 0.65, 750);
    return { width: maxWidth, height: maxHeight };
};

// Monte Carlo simulation parameters
const SIMULATION_PARAMS = {
    // Survival probabilities with individual variation
    EGG_SURVIVAL_MEAN: 0.85,
    EGG_SURVIVAL_STDDEV: 0.10,      // Individual eggs vary ±10%
    
    GOSLING_SURVIVAL_MEAN: 0.70,
    GOSLING_SURVIVAL_STDDEV: 0.12,  // Individual goslings vary ±12%
    
    PREDATOR_CATCH_PROBABILITY: 0.02,
    
    // Breeding parameters with normal distribution
    BREEDING_SUCCESS_MEAN: 0.80,
    BREEDING_SUCCESS_STDDEV: 0.15,
    BREEDING_COOLDOWN: 300,
    
    // Clutch size (eggs per breeding) - normal distribution
    CLUTCH_SIZE_MEAN: 4,           // Average 4 eggs per clutch
    CLUTCH_SIZE_STDDEV: 1.5,       // Varies between 2-6 typically
    CLUTCH_SIZE_MIN: 1,
    CLUTCH_SIZE_MAX: 8,
    
    // Migration stochastic factors
    MIGRATION_ENERGY_LOSS: 0.1,
    MIGRATION_SUCCESS_RATE: 0.95,
    WEATHER_VARIANCE: 0.3,
    
    // Random events
    RANDOM_EVENT_CHANCE: 0.001,
    
    // Safe period before predators become active
    SAFE_PERIOD_SECONDS: 10,
    
    // Latitude/Longitude effects
    LATITUDE_MIN: -60,
    LATITUDE_MAX: 75,
    OPTIMAL_LATITUDE_MIN: 35,
    OPTIMAL_LATITUDE_MAX: 55,
    LATITUDE_SURVIVAL_PENALTY: 0.3,
    
    MIGRATION_DISTANCE: 150
};

let currentDifficulty = 'normal';

const DIFFICULTY_SETTINGS = {
    easy:   { startPredators: 0, catchProb: 0.01, spawnThreshold: 8,  spawnInterval: 2400 },
    normal: { startPredators: 2, catchProb: 0.02, spawnThreshold: 3,  spawnInterval: 1800 },
    hard:   { startPredators: 4, catchProb: 0.04, spawnThreshold: 2,  spawnInterval: 1200 }
};

function applyDifficulty(level) {
    currentDifficulty = level;
    SIMULATION_PARAMS.PREDATOR_CATCH_PROBABILITY = DIFFICULTY_SETTINGS[level].catchProb;
}

// Helper: Generate normally distributed random number (Box-Muller transform)
function randomNormal(mean, stddev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stddev + mean;
}

// Helper: Clamp value between min and max
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Climate zones based on latitude with varied survival rates
const CLIMATE_ZONES = {
    ARCTIC: { min: 60, max: 90, name: 'Arctic', color: '#a8d8ea', survivalMod: 0.6 },
    SUBARCTIC: { min: 50, max: 60, name: 'Subarctic', color: '#b8e6f0', survivalMod: 0.8 },
    TEMPERATE: { min: 30, max: 50, name: 'Temperate', color: '#98d8c8', survivalMod: 1.0 },
    SUBTROPICAL: { min: 15, max: 30, name: 'Subtropical', color: '#f6d186', survivalMod: 0.85 },
    TROPICAL: { min: -15, max: 15, name: 'Tropical', color: '#f7a072', survivalMod: 0.7 },
    SOUTHERN_TEMPERATE: { min: -50, max: -15, name: 'S. Temperate', color: '#98d8c8', survivalMod: 0.9 },
    ANTARCTIC: { min: -90, max: -50, name: 'Antarctic', color: '#d4e4f7', survivalMod: 0.5 }
};

function getClimateZone(latitude) {
    for (const zone of Object.values(CLIMATE_ZONES)) {
        if (latitude >= zone.min && latitude <= zone.max) {
            return zone;
        }
    }
    return CLIMATE_ZONES.TEMPERATE;
}

// Game states
const GooseState = {
    EGG: 'egg',
    GOSLING: 'gosling',
    ADULT: 'adult'
};

const PredatorType = {
    FOX: 'fox',
    EAGLE: 'eagle'
};

// Goose class
class Goose {
    constructor(state, weeksLeft, x, y, gender = 'female', parent = null) {
        this.state = state;
        
        // Individual variation in development time using normal distribution
        if (state === GooseState.EGG) {
            // Egg incubation time: mean 3 weeks, stddev 0.5 weeks (2-4 weeks typically)
            this.weeksToHatch = Math.round(clamp(
                randomNormal(3, 0.5),
                1.5, 5
            ));
            this.weeksLeft = this.weeksToHatch;
        } else if (state === GooseState.GOSLING) {
            // Gosling growth time: mean 8 weeks, stddev 1.5 weeks (5-11 weeks typically)
            this.weeksToMature = Math.round(clamp(
                randomNormal(8, 1.5),
                4, 12
            ));
            this.weeksLeft = this.weeksToMature;
        } else {
            this.weeksLeft = weeksLeft;
        }
        
        this.x = x;
        this.y = y;
        this.gender = gender;
        this.parent = parent;
        this.vx = Math.random() * 1.2 - 0.6;  // Slower movement
        this.vy = Math.random() * 1.2 - 0.6;  // Slower movement
        this.facingLeft = false;
        this.health = 100;
        this.ageWeeks = state === GooseState.ADULT ? 0 : -this.weeksLeft;
        this.hiding = false;
        this.hidingEndTime = 0;
        
        // Migration and stochastic properties
        this.energy = 100;
        this.migrating = false;
        this.migrationTarget = null;
        
        // Individual genetic variation using normal distribution
        if (state === GooseState.EGG) {
            this.baseEggSurvival = clamp(
                randomNormal(SIMULATION_PARAMS.EGG_SURVIVAL_MEAN, SIMULATION_PARAMS.EGG_SURVIVAL_STDDEV),
                0.3, 1.0
            );
        } else {
            this.baseEggSurvival = 1.0; // Already hatched
        }
        
        this.baseGoslingSurvival = clamp(
            randomNormal(SIMULATION_PARAMS.GOSLING_SURVIVAL_MEAN, SIMULATION_PARAMS.GOSLING_SURVIVAL_STDDEV),
            0.3, 1.0
        );
        
        this.survivalChance = this.calculateSurvivalChance();
    }

    calculateSurvivalChance() {
        // Monte Carlo: Calculate survival probability based on multiple factors
        let chance = 1.0;
        
        if (this.state === GooseState.EGG) {
            chance *= this.baseEggSurvival; // Individual genetic variation
        } else if (this.state === GooseState.GOSLING) {
            chance *= this.baseGoslingSurvival; // Individual genetic variation
        }
        
        // Energy affects survival
        chance *= (this.energy / 100);
        
        // Latitude affects survival (if game reference exists)
        if (this.game) {
            const climate = getClimateZone(this.game.latitude);
            chance *= climate.survivalMod;
        }
        
        // Random environmental variance (smaller now since we have genetic variation)
        chance *= (0.95 + Math.random() * 0.10);
        
        return Math.min(1.0, Math.max(0, chance));
    }

    move(width, height) {
        if (this.state === GooseState.EGG) return;

        // Migration behavior (stochastic movement towards target)
        if (this.migrating && this.migrationTarget) {
            const dx = this.migrationTarget.x - this.x;
            const dy = this.migrationTarget.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 50) {
                // Move towards target with random variance (Monte Carlo)
                const weatherFactor = 1.0 + (Math.random() - 0.5) * SIMULATION_PARAMS.WEATHER_VARIANCE;
                this.vx = (dx / distance * 3 + Math.random() * 2 - 1) * weatherFactor;
                this.vy = (dy / distance * 3 + Math.random() * 2 - 1) * weatherFactor;
                
                // Lose energy during migration
                this.energy -= SIMULATION_PARAMS.MIGRATION_ENERGY_LOSS;
                
                // Stochastic migration failure
                if (this.energy <= 0 || Math.random() > SIMULATION_PARAMS.MIGRATION_SUCCESS_RATE) {
                    this.migrating = false;
                    this.energy = Math.max(10, this.energy);
                }
            } else {
                this.migrating = false;
                this.energy = Math.min(100, this.energy + 20); // Reached destination
            }
        }
        // Goslings follow parent
        else if (this.state === GooseState.GOSLING && this.parent) {
            const dx = this.parent.x - this.x;
            const dy = this.parent.y - this.y;
            const factor = 15;
            this.vx = dx / factor + Math.random() * 0.4 - 0.2;
            this.vy = dy / factor + Math.random() * 0.4 - 0.2;
        } else {
            // Random wandering with stochastic variation
            if (Math.random() < 0.05) {
                this.vx += Math.random() - 0.5;
                this.vy += Math.random() - 0.5;
            }
            
            // Slowly regain energy when not migrating
            if (this.energy < 100) {
                this.energy += 0.05;
            }
        }

        // Limit speed (slowed down for better visibility)
        const maxSpeed = this.state === GooseState.GOSLING ? 0.4 : 0.9;  // Goslings much slower
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges (with margin to keep geese more visible)
        const margin = 50;
        if (this.x < margin || this.x > width - margin) this.vx *= -1;
        if (this.y < margin || this.y > height - margin) this.vy *= -1;

        // Keep in bounds with margin
        this.x = Math.max(margin, Math.min(width - margin, this.x));
        this.y = Math.max(margin, Math.min(height - margin, this.y));

        // Update facing (with threshold to prevent jittering)
        if (this.vx < -0.3) this.facingLeft = true;
        else if (this.vx > 0.3) this.facingLeft = false;
        
        // Update survival chance periodically
        if (Math.random() < 0.01) {
            this.survivalChance = this.calculateSurvivalChance();
        }
    }

    draw(ctx, game) {
        if (this.hiding) {
            ctx.globalAlpha = 0.3;
        }

        if (this.state === GooseState.EGG) {
            // Draw egg with actual image (smaller, perfect ratio)
            if (game && game.images.egg.complete) {
                const width = 20;  // Smaller width
                const height = 28; // Smaller height (same ratio)
                ctx.save();
                ctx.drawImage(game.images.egg, this.x - width/2, this.y - height/2, width, height);
                ctx.restore();
            } else {
                // Fallback if image not loaded - draw simple egg
                ctx.save();
                ctx.fillStyle = '#f5f5dc'; // Cream color
                ctx.beginPath();
                ctx.ellipse(this.x, this.y, 10, 14, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#d3d3d3';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        } else if (this.state === GooseState.GOSLING) {
            // Draw gosling with actual image (smaller)
            if (game && game.images.gosling.complete) {
                const size = 50; // Smaller gosling
                ctx.save();
                if (this.facingLeft) {
                    ctx.scale(-1, 1);
                    ctx.drawImage(game.images.gosling, -this.x - size/2, this.y - size/2, size, size);
                } else {
                    ctx.drawImage(game.images.gosling, this.x - size/2, this.y - size/2, size, size);
                }
                ctx.restore();
            } else {
                // Fallback if image not loaded
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Draw adult goose with actual image (1.2x bigger)
            if (game && game.images.adult.complete) {
                const size = 120; // 1.2x bigger
                ctx.save();
                if (this.facingLeft) {
                    ctx.scale(-1, 1);
                    ctx.drawImage(game.images.adult, -this.x - size/2, this.y - size/2, size, size);
                } else {
                    ctx.drawImage(game.images.adult, this.x - size/2, this.y - size/2, size, size);
                }
                ctx.restore();
            } else {
                // Fallback if image not loaded
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1.0;
    }
}

// Predator class
class Predator {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.vx = Math.random() * 5 - 2.5;
        this.vy = Math.random() * 5 - 2.5;
    }

    move(width, height, geese) {
        // Hunt nearest goose
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

        // Limit speed (slowed down)
        const maxSpeed = 2.0;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges (with margin)
        const margin = 50;
        if (this.x < margin || this.x > width - margin) this.vx *= -1;
        if (this.y < margin || this.y > height - margin) this.vy *= -1;

        this.x = Math.max(margin, Math.min(width - margin, this.x));
        this.y = Math.max(margin, Math.min(height - margin, this.y));
    }

    findNearestGoose(geese) {
        let nearest = null;
        let minDist = Infinity;
        for (const goose of geese) {
            if (goose.state !== GooseState.EGG && !goose.hiding) {
                const dist = this.distance(goose);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = goose;
                }
            }
        }
        return nearest;
    }

    distance(goose) {
        const dx = this.x - goose.x;
        const dy = this.y - goose.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    canAttack(goose) {
        const inRange = this.distance(goose) < 30 && !goose.hiding;
        if (!inRange) return false;
        
        // Monte Carlo: Stochastic catch probability
        // Not every contact results in a catch
        const catchChance = SIMULATION_PARAMS.PREDATOR_CATCH_PROBABILITY * (1 - goose.survivalChance);
        return Math.random() < catchChance;
    }

    draw(ctx, game) {
        if (this.type === PredatorType.FOX) {
            // Draw fox with actual image (smaller)
            if (game && game.images.fox.complete) {
                const size = 50; // Smaller fox
                ctx.drawImage(game.images.fox, this.x - size/2, this.y - size/2, size, size);
            } else {
                // Fallback
                ctx.fillStyle = '#FF4500';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 25, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Draw eagle with actual image (smaller)
            if (game && game.images.eagle.complete) {
                const size = 55; // Smaller eagle
                ctx.drawImage(game.images.eagle, this.x - size/2, this.y - size/2, size, size);
            } else {
                // Fallback
                ctx.fillStyle = '#8B4513';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// Pond class
class Pond {
    constructor(x, y, rx, ry) {
        this.x = x;
        this.y = y;
        this.rx = rx;
        this.ry = ry;
    }

    draw(ctx) {
        ctx.fillStyle = '#4682B4';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.rx, this.ry, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Bush class
class Bush {
    constructor(x, y, radius = 40) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    contains(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    draw(ctx, game) {
        if (game && game.images.bush.complete) {
            // Draw bush with actual image
            const size = this.radius * 2;
            ctx.drawImage(game.images.bush, this.x - this.radius, this.y - this.radius, size, size);
        } else {
            // Fallback
            ctx.fillStyle = '#228B22';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            // Add some texture
            ctx.fillStyle = '#32CD32';
            ctx.beginPath();
            ctx.arc(this.x - 10, this.y - 10, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + 10, this.y - 5, 12, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Game class
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = CANVAS_WIDTH;
        this.height = CANVAS_HEIGHT;
        
        canvas.width = this.width;
        canvas.height = this.height;
        
        // Load images
        this.images = {
            egg: new Image(),
            gosling: new Image(),
            adult: new Image(),
            fox: new Image(),
            eagle: new Image(),
            bush: new Image()
        };
        
        this.images.egg.src = 'static/images/egg.png';
        this.images.gosling.src = 'static/images/gosling.png';
        this.images.adult.src = 'static/images/goose_adult.jpg';
        this.images.fox.src = 'static/images/fox.png';
        this.images.eagle.src = 'static/images/eagle.png';
        this.images.bush.src = 'static/images/bush.png';
        this.imagesLoaded = 0;
        
        // Wait for images to load
        this.images.egg.onload = () => {
            this.imagesLoaded++;
        };
        this.images.gosling.onload = () => {
            this.imagesLoaded++;
        };
        this.images.adult.onload = () => {
            this.imagesLoaded++;
        };
        this.images.fox.onload = () => {
            this.imagesLoaded++;
        };
        this.images.eagle.onload = () => {
            this.imagesLoaded++;
        };
        this.images.bush.onload = () => {
            this.imagesLoaded++;
        };
        
        this.geese = [];
        this.predators = [];
        this.ponds = [];
        this.bushes = [];
        
        this.score = 0;
        this.gameTime = 0;
        this.gameOver = false;
        this.paused = false;
        this.startTime = Date.now();
        
        // Safe period before predators attack
        this.safeMode = true;
        this.safeModeEndTime = Date.now() + (SIMULATION_PARAMS.SAFE_PERIOD_SECONDS * 1000);
        
        // Event log
        this.eventLog = [];
        this.maxLogEntries = 5;
        
        // Geographic location
        this.latitude = 15;  // Start at 15°N (temperate zone)
        this.longitude = -75; // Start at 75°W (roughly eastern North America)
        
        // Migration and breeding tracking
        this.migrationActive = false;
        this.migrationDirection = null;
        this.breedingCooldown = 0;
        this.totalBorn = 0;
        this.totalDied = 0;
        
        this.init();
        
        // Mouse click handler
        canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    init() {
        // Add starting geese
        const goose1 = new Goose(GooseState.ADULT, 0, 300, 200, 'male');
        const goose2 = new Goose(GooseState.ADULT, 0, 320, 200, 'female');
        goose1.game = this;
        goose2.game = this;
        this.geese.push(goose1);
        this.geese.push(goose2);

        // Add ponds
        this.ponds.push(new Pond(400, 400, 120, 80));
        this.ponds.push(new Pond(800, 500, 100, 100));

        // Add bushes
        this.bushes.push(new Bush(200, 500));
        this.bushes.push(new Bush(600, 300));
        this.bushes.push(new Bush(900, 150));

        // Add predators based on difficulty
        const diff = DIFFICULTY_SETTINGS[currentDifficulty];
        const predTypes = [PredatorType.FOX, PredatorType.EAGLE, PredatorType.FOX, PredatorType.EAGLE];
        const predPositions = [[100, 100], [900, 100], [500, 50], [200, 500]];
        for (let i = 0; i < diff.startPredators; i++) {
            this.predators.push(new Predator(predTypes[i], predPositions[i][0], predPositions[i][1]));
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicked on a goose
        for (const goose of this.geese) {
            const dx = x - goose.x;
            const dy = y - goose.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) {
                // Find nearest bush
                let nearestBush = null;
                let minDist = Infinity;
                for (const bush of this.bushes) {
                    const dist = Math.sqrt(
                        (bush.x - goose.x) ** 2 + (bush.y - goose.y) ** 2
                    );
                    if (dist < minDist) {
                        minDist = dist;
                        nearestBush = bush;
                    }
                }
                
                if (nearestBush) {
                    goose.hiding = true;
                    goose.x = nearestBush.x;
                    goose.y = nearestBush.y;
                    const gooseName = goose.state === GooseState.GOSLING ? 'gosling' : 'goose';
                    this.logEvent(`🌳 A ${gooseName} is hiding!`, 'normal');
                    setTimeout(() => {
                        goose.hiding = false;
                    }, 3000);
                }
                break;
            }
        }
    }

    update() {
        if (this.gameOver || this.paused) return;

        this.gameTime++;
        
        // Check if safe mode should end
        if (this.safeMode && Date.now() >= this.safeModeEndTime) {
            this.safeMode = false;
            this.logEvent('⚠️ Safe period over! Predators are now active!', 'warning');
        }
        
        // Decrease breeding cooldown
        if (this.breedingCooldown > 0) {
            this.breedingCooldown--;
        }

        // Update geese (age faster - 1 week every 2 seconds instead of 8 seconds)
        if (this.gameTime % 120 === 0) { // Every 2 seconds at 60 FPS
            this.geese.forEach(goose => {
                if (goose.weeksLeft > 0) goose.weeksLeft--;
            });
        }
        
        this.geese.forEach(goose => {
            goose.move(this.width, this.height);
        });

        // Update predators
        this.predators.forEach(predator => {
            predator.move(this.width, this.height, this.geese);
        });

        // Check attacks (only if NOT in safe mode!)
        if (!this.safeMode) {
            for (let i = this.geese.length - 1; i >= 0; i--) {
                const goose = this.geese[i];
                for (const predator of this.predators) {
                    if (predator.canAttack(goose) && goose.state !== GooseState.EGG) {
                        const gooseName = goose.state === GooseState.GOSLING ? 'gosling' : 'goose';
                        this.logEvent(`🦊 A ${predator.type} ate a ${gooseName}!`, 'important');
                        this.geese.splice(i, 1);
                        this.totalDied++;
                        break;
                    }
                }
            }
        }
        
        // Monte Carlo: Random events (storms, etc.)
        if (Math.random() < SIMULATION_PARAMS.RANDOM_EVENT_CHANCE) {
            this.geese.forEach(g => g.energy = Math.max(10, g.energy - 30));
            this.logEvent('⛈️ Storm! All geese lost energy', 'warning');
        }

        // Breeding (with cooldown)
        if (this.gameTime % 500 === 0) {
            this.breed();
        }
        
        // Dynamic predator spawning - more geese = more predators!
        const spawnInterval = DIFFICULTY_SETTINGS[currentDifficulty].spawnInterval;
        const spawnThreshold = DIFFICULTY_SETTINGS[currentDifficulty].spawnThreshold;
        if (this.gameTime % spawnInterval === 0 && !this.safeMode) {
            const gooseCount = this.geese.filter(g => g.state === GooseState.ADULT).length;

            // Spawn predator if population is high enough
            if (gooseCount > spawnThreshold) {
                const shouldSpawn = Math.random() < (gooseCount / 10); // 10% per adult over threshold
                
                if (shouldSpawn) {
                    const type = Math.random() < 0.5 ? PredatorType.FOX : PredatorType.EAGLE;
                    const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
                    let x, y;
                    
                    switch(edge) {
                        case 0: x = Math.random() * this.width; y = 0; break;
                        case 1: x = this.width; y = Math.random() * this.height; break;
                        case 2: x = Math.random() * this.width; y = this.height; break;
                        case 3: x = 0; y = Math.random() * this.height; break;
                    }
                    
                    this.predators.push(new Predator(type, x, y));
                    this.logEvent(`⚠️ New ${type} appeared! (${gooseCount} geese attracted predators)`, 'warning');
                }
            }
        }

        // Hatching eggs (with stochastic survival and logging)
        const eggsToProcess = this.geese.filter(g => g.state === GooseState.EGG && g.weeksLeft <= 0);
        let hatchedCount = 0;
        let failedCount = 0;
        
        eggsToProcess.forEach(goose => {
            if (Math.random() < goose.survivalChance) {
                goose.state = GooseState.GOSLING;
                goose.weeksLeft = 0; // Will be set by transition
                // Set individual growth time
                goose.weeksToMature = Math.round(clamp(
                    randomNormal(8, 1.5),
                    4, 12
                ));
                goose.weeksLeft = goose.weeksToMature;
                hatchedCount++;
            } else {
                const index = this.geese.indexOf(goose);
                if (index > -1) {
                    this.geese.splice(index, 1);
                    this.totalDied++;
                    failedCount++;
                }
            }
        });
        
        if (hatchedCount > 0) {
            this.logEvent(`🐣 ${hatchedCount} gosling${hatchedCount > 1 ? 's' : ''} hatched!`, 'positive');
        }
        if (failedCount > 0) {
            this.logEvent(`💔 ${failedCount} egg${failedCount > 1 ? 's' : ''} failed to hatch`, 'warning');
        }

        // Maturing goslings (with stochastic survival and logging)
        const goslingsToProcess = this.geese.filter(g => g.state === GooseState.GOSLING && g.weeksLeft <= 0);
        let maturedCount = 0;
        let diedCount = 0;
        
        goslingsToProcess.forEach(goose => {
            if (Math.random() < goose.survivalChance) {
                goose.state = GooseState.ADULT;
                goose.parent = null;
                this.score += 10;
                maturedCount++;
            } else {
                const index = this.geese.indexOf(goose);
                if (index > -1) {
                    this.geese.splice(index, 1);
                    this.totalDied++;
                    diedCount++;
                }
            }
        });
        
        if (maturedCount > 0) {
            this.logEvent(`🦆 ${maturedCount} gosling${maturedCount > 1 ? 's' : ''} matured to adults!`, 'positive');
        }
        if (diedCount > 0) {
            this.logEvent(`💀 ${diedCount} gosling${diedCount > 1 ? 's' : ''} didn't survive to adulthood`, 'warning');
        }

        // Check game over
        if (this.geese.length === 0) {
            this.gameOver = true;
            this.logEvent('☠️ Game Over! All geese are gone', 'important');
        }

        this.updateUI();
    }

    breed() {
        if (this.breedingCooldown > 0) return;
        
        const males = this.geese.filter(g => g.state === GooseState.ADULT && g.gender === 'male' && g.energy > 50);
        const females = this.geese.filter(g => g.state === GooseState.ADULT && g.gender === 'female' && g.energy > 50);

        if (males.length > 0 && females.length > 0) {
            // Individual breeding success using normal distribution
            const breedingSuccess = clamp(
                randomNormal(SIMULATION_PARAMS.BREEDING_SUCCESS_MEAN, SIMULATION_PARAMS.BREEDING_SUCCESS_STDDEV),
                0.2, 1.0
            );
            
            if (Math.random() < breedingSuccess) {
                const mother = females[Math.floor(Math.random() * females.length)];
                
                // Clutch size using normal distribution (realistic!)
                const clutchSize = Math.round(clamp(
                    randomNormal(SIMULATION_PARAMS.CLUTCH_SIZE_MEAN, SIMULATION_PARAMS.CLUTCH_SIZE_STDDEV),
                    SIMULATION_PARAMS.CLUTCH_SIZE_MIN,
                    SIMULATION_PARAMS.CLUTCH_SIZE_MAX
                ));
                
                // Lay multiple eggs
                for (let i = 0; i < clutchSize; i++) {
                    const egg = new Goose(
                        GooseState.EGG,
                        0, // weeksLeft will be set by constructor based on normal dist
                        mother.x + (Math.random() * 120 - 60),
                        mother.y + (Math.random() * 120 - 60),
                        Math.random() < 0.5 ? 'male' : 'female',
                        mother
                    );
                    egg.game = this;
                    this.geese.push(egg);
                    this.totalBorn++;
                }
                
                // Log event
                this.logEvent(`💕 Breeding successful! ${clutchSize} egg${clutchSize > 1 ? 's' : ''} laid`, 'positive');
                
                // Breeding costs energy
                mother.energy -= 15;
            } else {
                this.logEvent(`💔 Breeding attempt failed`, 'warning');
            }
            
            this.breedingCooldown = SIMULATION_PARAMS.BREEDING_COOLDOWN;
        }
    }
    
    forceMating() {
        // Button action: Force immediate breeding attempt
        this.breedingCooldown = 0;
        this.breed();
    }
    
    logEvent(message, type = 'normal') {
        // Add event to log
        this.eventLog.push({ message, type, time: Date.now() });
        
        // Keep only last N entries
        if (this.eventLog.length > this.maxLogEntries) {
            this.eventLog.shift();
        }
        
        // Update display
        this.updateEventLog();
    }
    
    updateEventLog() {
        const logElement = document.getElementById('eventLog');
        if (!logElement) return;
        
        // Only show the MOST RECENT message
        if (this.eventLog.length === 0) return;
        
        const event = this.eventLog[this.eventLog.length - 1]; // Get last message
        let className = 'event-message';
        if (event.type === 'important') className += ' important';
        if (event.type === 'positive') className += ' positive';
        if (event.type === 'warning') className += ' warning';
        
        logElement.innerHTML = `<div class="${className}">${event.message}</div>`;
    }
    
    triggerMigration(direction) {
        // Button action: Start migration in specified direction
        this.migrationActive = true;
        this.migrationDirection = direction;
        
        // Calculate new latitude/longitude based on direction
        let newLat = this.latitude;
        let newLong = this.longitude;
        
        const latChange = SIMULATION_PARAMS.MIGRATION_DISTANCE / 111; // 1 degree lat ≈ 111 km
        const longChange = SIMULATION_PARAMS.MIGRATION_DISTANCE / (111 * Math.cos(this.latitude * Math.PI / 180));
        
        switch(direction) {
            case 'north':
                newLat = Math.min(SIMULATION_PARAMS.LATITUDE_MAX, this.latitude + latChange);
                break;
            case 'south':
                newLat = Math.max(SIMULATION_PARAMS.LATITUDE_MIN, this.latitude - latChange);
                break;
            case 'east':
                newLong = this.longitude + longChange;
                if (newLong > 180) newLong -= 360;
                break;
            case 'west':
                newLong = this.longitude - longChange;
                if (newLong < -180) newLong += 360;
                break;
        }
        
        // Calculate target position on canvas (for visual migration)
        let targetX, targetY;
        switch(direction) {
            case 'north':
                targetX = this.width / 2;
                targetY = 50;
                break;
            case 'south':
                targetX = this.width / 2;
                targetY = this.height - 50;
                break;
            case 'east':
                targetX = this.width - 50;
                targetY = this.height / 2;
                break;
            case 'west':
                targetX = 50;
                targetY = this.height / 2;
                break;
        }
        
        const target = { x: targetX, y: targetY };
        
        // Set migration for all adult geese
        this.geese.forEach(goose => {
            if (goose.state === GooseState.ADULT) {
                goose.migrating = true;
                goose.migrationTarget = target;
            }
        });
        
        // After migration completes, update location
        setTimeout(() => {
            this.migrationActive = false;
            this.latitude = newLat;
            this.longitude = newLong;
            
            // Recalculate survival chances for all geese based on new latitude
            this.geese.forEach(goose => {
                goose.survivalChance = goose.calculateSurvivalChance();
            });
            
            // Regenerate terrain (new location = new environment!)
            this.regenerateTerrain();
            
            this.logEvent(`🗺️ Migrated ${direction}! New terrain discovered.`, 'positive');
            this.updateUI();
        }, 5000);
    }
    
    regenerateTerrain() {
        // Clear old terrain
        this.ponds = [];
        this.bushes = [];
        
        // Generate new random ponds (3-5 ponds)
        const numPonds = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numPonds; i++) {
            const x = 100 + Math.random() * (this.width - 300);
            const y = 100 + Math.random() * (this.height - 200);
            const w = 80 + Math.random() * 100;  // 80-180 width
            const h = 60 + Math.random() * 80;   // 60-140 height
            this.ponds.push(new Pond(x, y, w, h));
        }
        
        // Generate new random bushes (4-7 bushes)
        const numBushes = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numBushes; i++) {
            const x = 50 + Math.random() * (this.width - 100);
            const y = 50 + Math.random() * (this.height - 100);
            this.bushes.push(new Bush(x, y));
        }
    }
    
    hideAllGeese() {
        // Button action: Make all geese hide in nearest bushes
        let hiddenCount = 0;
        this.geese.forEach(goose => {
            if (goose.state !== GooseState.EGG) {
                let nearestBush = null;
                let minDist = Infinity;
                for (const bush of this.bushes) {
                    const dist = Math.sqrt(
                        (bush.x - goose.x) ** 2 + (bush.y - goose.y) ** 2
                    );
                    if (dist < minDist) {
                        minDist = dist;
                        nearestBush = bush;
                    }
                }
                
                if (nearestBush) {
                    goose.hiding = true;
                    goose.x = nearestBush.x;
                    goose.y = nearestBush.y;
                    hiddenCount++;
                    setTimeout(() => {
                        goose.hiding = false;
                    }, 3000);
                }
            }
        });
        
        if (hiddenCount > 0) {
            this.logEvent(`🌳 ${hiddenCount} goose${hiddenCount > 1 ? 's' : ''} hiding in bushes!`, 'normal');
        }
    }
    
    addPredator() {
        // Button action: Add a random predator
        const type = Math.random() < 0.5 ? PredatorType.FOX : PredatorType.EAGLE;
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        this.predators.push(new Predator(type, x, y));
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw ponds
        this.ponds.forEach(pond => pond.draw(this.ctx));

        // Draw bushes
        this.bushes.forEach(bush => bush.draw(this.ctx, this));

        // Draw geese
        this.geese.forEach(goose => goose.draw(this.ctx, this));

        // Draw predators
        this.predators.forEach(predator => predator.draw(this.ctx, this));

        // Draw game over
        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 60px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Game Over!', this.width / 2, this.height / 2);
            this.ctx.font = 'bold 30px Arial';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 50);
        }
    }

    updateUI() {
        document.getElementById('score').textContent = `Score: ${this.score}`;
        document.getElementById('geese-count').textContent = `Geese: ${this.geese.length}`;
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        document.getElementById('time').textContent = `Time: ${elapsed}s`;
        
        // Update location display
        const latDir = this.latitude >= 0 ? 'N' : 'S';
        const longDir = this.longitude >= 0 ? 'E' : 'W';
        document.getElementById('locationDisplay').textContent = 
            `${Math.abs(this.latitude).toFixed(1)}°${latDir}, ${Math.abs(this.longitude).toFixed(1)}°${longDir}`;
        
        // Update climate zone
        const climate = getClimateZone(this.latitude);
        const climateDisplay = document.getElementById('climateZone');
        climateDisplay.textContent = climate.name;
        climateDisplay.style.color = climate.color;
        climateDisplay.style.fontWeight = 'bold';
        
        const breedingCooldown = document.getElementById('breedingCooldown');
        if (this.breedingCooldown > 0) {
            breedingCooldown.textContent = `${Math.ceil(this.breedingCooldown / 60)}s`;
            breedingCooldown.style.color = '#ee0979';
        } else {
            breedingCooldown.textContent = 'Ready';
            breedingCooldown.style.color = '#38ef7d';
        }
        
        const survivalRate = document.getElementById('survivalRate');
        if (this.totalBorn > 0) {
            const rate = ((this.totalBorn - this.totalDied) / this.totalBorn * 100).toFixed(1);
            survivalRate.textContent = `${rate}%`;
            survivalRate.style.color = rate > 70 ? '#38ef7d' : rate > 40 ? '#ff9800' : '#ee0979';
        } else {
            survivalRate.textContent = '100%';
            survivalRate.style.color = '#38ef7d';
        }
    }

    reset() {
        this.geese = [];
        this.predators = [];
        this.ponds = [];
        this.bushes = [];
        this.score = 0;
        this.gameTime = 0;
        this.gameOver = false;
        this.paused = false;
        this.startTime = Date.now();
        this.latitude = 45;
        this.longitude = -75;
        this.migrationActive = false;
        this.migrationDirection = null;
        this.breedingCooldown = 0;
        this.totalBorn = 2; // Starting geese
        this.totalDied = 0;
        
        // Reset safe mode
        this.safeMode = true;
        this.safeModeEndTime = Date.now() + (SIMULATION_PARAMS.SAFE_PERIOD_SECONDS * 1000);
        
        // Clear event log
        this.eventLog = [];
        this.logEvent('🎮 Game started! Safe period: 10 seconds', 'positive');
        
        this.init();
        this.updateUI();
    }

    togglePause() {
        this.paused = !this.paused;
        return this.paused;
    }
}

// Initialize game when page loads
let game;

window.addEventListener('load', () => {
    // Set responsive canvas size
    const size = getResponsiveCanvasSize();
    CANVAS_WIDTH = size.width;
    CANVAS_HEIGHT = size.height;
    
    const canvas = document.getElementById('gameCanvas');
    game = new Game(canvas);
    window.game = game;

    // Game loop
    function gameLoop() {
        game.update();
        game.draw();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();

    // Button handlers
    document.getElementById('resetBtn').addEventListener('click', () => {
        game.reset();
    });

    document.getElementById('pauseBtn').addEventListener('click', () => {
        const paused = game.togglePause();
        document.getElementById('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
    });
    
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        const container = document.querySelector('.container');
        const btn = document.getElementById('fullscreenBtn');
        
        if (!document.fullscreenElement) {
            // Enter fullscreen
            container.classList.add('fullscreen');
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
            btn.textContent = '⛶ Exit Fullscreen';
        } else {
            // Exit fullscreen
            container.classList.remove('fullscreen');
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            btn.textContent = '⛶ Fullscreen';
        }
    });
    
    // Update button text when fullscreen changes via ESC key
    document.addEventListener('fullscreenchange', () => {
        const container = document.querySelector('.container');
        const btn = document.getElementById('fullscreenBtn');
        if (!document.fullscreenElement) {
            container.classList.remove('fullscreen');
            btn.textContent = '⛶ Fullscreen';
        }
    });
    
    document.getElementById('mateBtn').addEventListener('click', () => {
        game.forceMating();
    });
    
    // Directional migration buttons
    const directionButtons = ['migrateNorth', 'migrateSouth', 'migrateEast', 'migrateWest'];
    directionButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        btn.addEventListener('click', () => {
            const direction = btn.dataset.direction;
            game.triggerMigration(direction);
            
            // Visual feedback: highlight active button
            directionButtons.forEach(id => {
                document.getElementById(id).classList.remove('active');
            });
            btn.classList.add('active');
            
            // Remove highlight after migration
            setTimeout(() => {
                btn.classList.remove('active');
            }, 5000);
        });
    });
    
    document.getElementById('hideAllBtn').addEventListener('click', () => {
        game.hideAllGeese();
    });
    
    // Difficulty toggle buttons
    ['diffEasy', 'diffNormal', 'diffHard'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            const level = document.getElementById(id).dataset.diff;
            applyDifficulty(level);
            // Update active state
            ['diffEasy', 'diffNormal', 'diffHard'].forEach(bid => {
                document.getElementById(bid).classList.remove('btn-diff-active');
            });
            document.getElementById(id).classList.add('btn-diff-active');
            // Reset game with new difficulty
            game.reset();
        });
    });
    
    // Arrow key controls - move all geese (except eggs!)
    window.addEventListener('keydown', (e) => {
        const moveSpeed = 15; // Pixels to move geese
        
        switch(e.key) {
            case 'ArrowUp':
                game.geese.forEach(goose => {
                    if (goose.state !== GooseState.EGG) { // Eggs don't move
                        goose.y -= moveSpeed;
                        goose.y = Math.max(50, goose.y); // Keep in bounds
                    }
                });
                e.preventDefault(); // Prevent page scrolling
                break;
            case 'ArrowDown':
                game.geese.forEach(goose => {
                    if (goose.state !== GooseState.EGG) { // Eggs don't move
                        goose.y += moveSpeed;
                        goose.y = Math.min(game.height - 50, goose.y); // Keep in bounds
                    }
                });
                e.preventDefault();
                break;
            case 'ArrowLeft':
                game.geese.forEach(goose => {
                    if (goose.state !== GooseState.EGG) { // Eggs don't move
                        goose.x -= moveSpeed;
                        goose.x = Math.max(50, goose.x); // Keep in bounds
                    }
                });
                e.preventDefault();
                break;
            case 'ArrowRight':
                game.geese.forEach(goose => {
                    if (goose.state !== GooseState.EGG) { // Eggs don't move
                        goose.x += moveSpeed;
                        goose.x = Math.min(game.width - 50, goose.x); // Keep in bounds
                    }
                });
                e.preventDefault();
                break;
        }
    });
});