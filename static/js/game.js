import {
    CANVAS_WIDTH, CANVAS_HEIGHT,
    SIMULATION_PARAMS, DIFFICULTY_SETTINGS, currentDifficulty,
    GooseState, PredatorType,
    clamp, randomNormal,
} from './constants.js';
import { getClimateZone, getVegTypes } from './climate.js';
import { Goose }      from './Goose.js';
import { Predator }   from './Predator.js';
import { Pond, Bush } from './Terrain.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.width  = CANVAS_WIDTH;
        this.height = CANVAS_HEIGHT;
        canvas.width  = this.width;
        canvas.height = this.height;

        this.imagesLoaded = 0;
        const li = (src) => {
            const img = new Image();
            img.src = src;
            img.onload = () => this.imagesLoaded++;
            return img;
        };

        this.images = {
            layegg:     li('static/images/canadagoose_layegg.png'),
            gosling:    li('static/images/gosling.png'),
            adult:      li('static/images/canadagoose_adult.png'),
            adult2:     li('static/images/canadagoose_adult2.png'),
            migration:  li('static/images/canadagoose_migration.png'),
            migration2: li('static/images/canadagoose_migration2.png'),
            fox:        li('static/images/fox.png'),
            fox2:       li('static/images/fox2.png'),
            fox3:       li('static/images/fox3.png'),
            eagle:      li('static/images/eagle.png'),
            eagle2:     li('static/images/eagle2.png'),
            eagle3:     li('static/images/eagle3.png'),
            bush:       li('static/images/bush.png'),
            bush2:      li('static/images/bush2.png'),
            bush3:      li('static/images/bush3.png'),
            cactus:     li('static/images/cactus.png'),
            palm:       li('static/images/palm.png'),
            snow:       li('static/images/snow.png'),
            snow2:      li('static/images/snow2.png'),
            egg:        li('static/images/egg.png'),
        };

        this.geese     = [];
        this.predators = [];
        this.ponds     = [];
        this.bushes    = [];

        this.score          = 0;
        this.gameTime       = 0;
        this.gameOver       = false;
        this.paused         = false;
        this.manuallyPaused = false;
        this.startTime      = Date.now();

        this.safeMode = true;

        this.eventLog      = [];
        this.maxLogEntries = 5;

        const startLoc = this.randomStartLocation();
        this.latitude  = startLoc.lat;
        this.longitude = startLoc.lng;

        this.migrationActive           = false;
        this.migrationDirection        = null;
        this.migrationOverlayActive    = false;
        this.migrationOverlayDirection = null;
        this.breedingCooldown = 0;
        this.totalBorn = 0;
        this.totalDied = 0;
        this.hideDuration = 8000; // 8 seconds

        this.month = Math.floor(Math.random() * 12);
        this.week  = Math.floor(Math.random() * 4) + 1;

        this.weather          = 'sunny';
        this.weatherWeeksLeft = 3 + Math.floor(Math.random() * 4);

        this.stormShakeX    = 0;
        this.stormShakeY    = 0;
        this.lightningFlash  = 0;
        this.lightningX      = 0;
        this.lightningPoints = [];

        this.fastMigration   = false;
        this.weeksAtLocation    = 0;
        this.vegWarnThreshold = 10 + Math.floor(Math.random() * 7);

        const ls = (src) => { const a = new Audio(src); a.preload = 'auto'; return a; };
        this.sounds = {
            // honk:           ls('static/audio/honk.mp3'),
            happyhonk:      ls('static/audio/happyhonk.mp3'),
            migrationhonk:  ls('static/audio/migrationhonk.mp3'),
            migrationhonk2: ls('static/audio/migrationhonk2.mp3'),
            eagle:          ls('static/audio/eagle.mp3'),
            angryhonk1:     ls('static/audio/angryhonk1.mp3'),
            angryhonk2:     ls('static/audio/angryhonk2.mp3'),
            angryhonk3:     ls('static/audio/angryhonk3.mp3'),
            angryhonk4:     ls('static/audio/angryhonk4.mp3'),
            angryhonk5:     ls('static/audio/angryhonk5.mp3'),
            // ambient loops
            sunny:  ls('static/audio/sunny.mp3'),
            sunny2: ls('static/audio/sunny2.mp3'),
            rain:   ls('static/audio/rain.mp3'),
            wind:   ls('static/audio/wind.mp3'),
            storm:  ls('static/audio/storm.mp3'),
            storm2: ls('static/audio/storm2.mp3'),
            // bgm
            bgmEasy: ls('static/audio/bgm-easy.mp3'),
            bgmMed:  ls('static/audio/bgm-med.mp3'),
            bgmHard:   ls('static/audio/bgm-hard.mp3'),
            goodnews:  ls('static/audio/goodnews.mp3'),
            warning:   ls('static/audio/warning.mp3'),
            alert:     ls('static/audio/alert.mp3'),
        };
        this.ambientAudio   = null;
        this.bgmAudio       = null;
        this.ambientStarted = false;

        this.init();
        canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    playSound(name) {
        try {
            const s = this.sounds[name];
            if (!s) return;
            s.currentTime = 0;
            s.play().catch(() => {});
        } catch(e) {}
    }

    playNotification(src) {
        try {
            const a = new Audio(src);
            a.volume = 0.6;
            a.play().catch(() => {});
        } catch(e) {}
    }

    startAmbient(name) {
        if (this.ambientAudio) {
            this.ambientAudio.pause();
            this.ambientAudio.currentTime = 0;
        }
        const s = this.sounds[name];
        if (!s) { this.ambientAudio = null; return; }
        s.loop = true;
        s.volume = 0.35;
        s.currentTime = 0;
        s.play().catch(() => {});
        this.ambientAudio = s;
    }

    stopAmbient() {
        if (this.ambientAudio) {
            this.ambientAudio.pause();
            this.ambientAudio.currentTime = 0;
            this.ambientAudio = null;
        }
    }

    startAmbientForWeather() {
        if      (this.weather === 'sunny') this.startAmbient(Math.random() < 0.5 ? 'sunny' : 'sunny2');
        else if (this.weather === 'rain')  this.startAmbient('rain');
        else if (this.weather === 'storm') this.startAmbient(Math.random() < 0.5 ? 'storm' : 'storm2');
        else                               this.stopAmbient();
    }

    startBGM() {
        const map = { easy: 'bgmEasy', normal: 'bgmMed', hard: 'bgmHard' };
        const s = this.sounds[map[currentDifficulty] || 'bgmMed'];

        if (!s) {
            console.log('No BGM sound found for difficulty:', currentDifficulty);
            return;
        }

        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
        }

        s.loop = true;
        s.volume = 1.0;
        s.currentTime = 0;

        s.play()
            .then(() => console.log('BGM playing:', s.src))
            .catch(err => console.log('BGM failed:', err, s.src));

        this.bgmAudio = s;
    }

    stopBGM() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
            this.bgmAudio = null;
        }
    }

    honk() {
        if (this.paused) return;
        this.playSound(`angryhonk${1 + Math.floor(Math.random() * 5)}`);
        let scared = 0;
        this.predators.forEach(p => {
            if (!p.leaving && Math.random() < 0.55) { p.leaving = true; scared++; }
        });
        if (scared > 0) this.logEvent(`📢 HONK! Scared off ${scared} predator${scared > 1 ? 's' : ''}!`, 'positive');
        else            this.logEvent('📢 HONK! Predators unimpressed...', 'normal');
    }

    advanceWeek() {
        this.week++;
        if (this.week > 4) { this.week = 1; this.month = (this.month + 1) % 12; }
        this.geese.forEach(g => {
            if (g.weeksLeft > 0) g.weeksLeft--;
            if (g.state === GooseState.ADULT) g.ageWeeks++;
        });
        for (let i = this.geese.length - 1; i >= 0; i--) {
            const g = this.geese[i];

            if (g.state === GooseState.ADULT && g.ageWeeks > 260) {
                if (Math.random() < 0.08) {
                    this.geese.splice(i, 1);
                    this.totalDied++;
                    this.logEvent('🪶 An old goose passed away of old age.', 'warning');
                }
            }
        }

        this.weatherWeeksLeft--;
        if (this.weatherWeeksLeft <= 0) this.changeWeather();

        if (this.weather === 'storm') {
            this.geese.forEach(g => {
                const drain = g.hiding ? 3 : 15;
                g.energy = Math.max(5, g.energy - drain);
            });
            this.logEvent('⛈️ Storm saps the flock\'s health!', 'warning');
        } else if (this.weather === 'rain') {
            let goslingsExposed = false;
            this.geese.forEach(g => {
                if (g.state === GooseState.GOSLING) {
                    const drain = 1;
                    g.energy = Math.max(5, g.energy - drain);
                    if (!g.hiding) goslingsExposed = true;
                } else {
                    g.energy = Math.max(20, g.energy - 5);
                }
            });
            if (goslingsExposed) this.logEvent('🌧️ Goslings struggling in the rain! Hide them!', 'warning');
        }

        // Overpopulation — vegetation depletion
        const adultCount = this.geese.filter(g => g.state === GooseState.ADULT).length;
        if (adultCount >= 4) {
            this.weeksAtLocation++;

            const warningWeek = this.vegWarnThreshold + 4;
            const dangerWeek = warningWeek + 6;
            const damageWeek = dangerWeek + 4;

            if (this.weeksAtLocation === warningWeek) {
                this.logEvent('🌿 Vegetation getting sparse — you may want to migrate soon.', 'warning');
                } else if (this.weeksAtLocation === dangerWeek) {
                    this.logEvent('🌿 Habitat is getting worn down. Migration is recommended.', 'important');
                } else if (this.weeksAtLocation >= damageWeek) {
                    const drain = Math.min(8, 2 + Math.floor((this.weeksAtLocation - damageWeek) / 2));
                    this.geese.forEach(g => {
                        g.energy = Math.max(5, g.energy - drain);
                    });
                    this.logEvent(`🍂 Overgrazed habitat! −${drain} energy per goose.`, 'important');
                }
            } else {
                if (this.weeksAtLocation > 0) {
                    this.weeksAtLocation = Math.max(0, this.weeksAtLocation - 1);
                }
            }
        }

    changeWeather() {
    const r = Math.random();

    if (currentDifficulty === 'easy') {
        // Easy: mostly sunny, rare storms
        this.weather = r < 0.70 ? 'sunny' : r < 0.95 ? 'rain' : 'storm';
        } else if (currentDifficulty === 'normal') {
            // Normal: current-ish behavior, slightly gentler
            this.weather = r < 0.60 ? 'sunny' : r < 0.85 ? 'rain' : 'storm';
        } else {
            // Hard: storms are more common
            this.weather = r < 0.45 ? 'sunny' : r < 0.75 ? 'rain' : 'storm';
        }

        this.weatherWeeksLeft = 2 + Math.floor(Math.random() * 5);

        if (this.weather === 'storm' && currentDifficulty !== 'hard') {
            this.predators.forEach(p => { p.leaving = true; });
        }

        this.startAmbientForWeather();

        const icons = { sunny: '☀️', rain: '🌧️', storm: '⛈️' };
        const names = { sunny: 'Sunny', rain: 'Rain', storm: 'Storm!' };

        this.logEvent(`${icons[this.weather]} Weather changed: ${names[this.weather]}`,
            this.weather === 'storm' ? 'important' : 'normal');
    }

    drawLightning() {
        if (this.lightningPoints.length < 2) return;
        const alpha = this.lightningFlash / 15;
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 255, 180, ${alpha})`;
        this.ctx.lineWidth   = 2 + alpha * 3;
        this.ctx.shadowColor = 'rgba(255, 255, 80, 0.9)';
        this.ctx.shadowBlur  = 30;
        this.ctx.beginPath();
        this.ctx.moveTo(this.lightningPoints[0].x, this.lightningPoints[0].y);
        for (let i = 1; i < this.lightningPoints.length; i++) {
            this.ctx.lineTo(this.lightningPoints[i].x, this.lightningPoints[i].y);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    randomStartLocation() {
        const diff = currentDifficulty;
        const r = Math.random();
        let lat;

        const tempN  = () => 30 + Math.random() * 20;        // [30, 50]
        const tempS  = () => -(35 + Math.random() * 10);     // [-45, -35]
        const subtrN = () => 15 + Math.random() * 15;        // [15, 30]
        const subtrS = () => -(15 + Math.random() * 15);     // [-30, -15]
        const temperate   = () => Math.random() < 0.5 ? tempN()  : tempS();
        const subtropical = () => Math.random() < 0.5 ? subtrN() : subtrS();

        if (diff === 'easy') {
            lat = temperate();
        } else if (diff === 'normal') {
            if      (r < 0.60) lat = temperate();
            else if (r < 0.90) lat = subtropical();
            else               lat = 50 + Math.random() * 10; // subarctic
        } else {
            if      (r < 0.30) lat = temperate();
            else if (r < 0.50) lat = 50 + Math.random() * 10;         // subarctic
            else if (r < 0.70) lat = subtropical();
            else if (r < 0.90) lat = -15 + Math.random() * 30;       // tropical
            else               lat = 60 + Math.random() * 30;         // arctic
        }

        return {
            lat: parseFloat(lat.toFixed(1)),
            lng: parseFloat((-180 + Math.random() * 360).toFixed(1)),
        };
    }

    init() {
        const goose1 = new Goose(GooseState.ADULT, 0, 300, 200, 'male');
        const goose2 = new Goose(GooseState.ADULT, 0, 320, 200, 'female');
        goose1.game = this;
        goose2.game = this;
        this.geese.push(goose1, goose2);

        this.ponds.push(new Pond(400, 400, 120, 80));
        this.ponds.push(new Pond(800, 500, 100, 100));

        this.bushes.push(new Bush(200, 500));
        this.bushes.push(new Bush(600, 300));
        this.bushes.push(new Bush(900, 150));

        this.initialPredatorsSpawned = false;
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (const goose of this.geese) {
            const dx = x - goose.x, dy = y - goose.y;
            if (Math.sqrt(dx * dx + dy * dy) < 50) {
                if (goose.hatching) {
                    this.logEvent('🥚 Can\'t move — sitting on eggs!', 'warning');
                    break;
                }
                let nearestBush = null, minDist = Infinity;
                for (const bush of this.bushes) {
                    const dist = Math.sqrt((bush.x - goose.x) ** 2 + (bush.y - goose.y) ** 2);
                    if (dist < minDist) { minDist = dist; nearestBush = bush; }
                }
                if (nearestBush) {
                    goose.hiding = true;
                    goose.x = nearestBush.x;
                    goose.y = nearestBush.y;
                    const name = goose.state === GooseState.GOSLING ? 'gosling' : 'goose';
                    this.logEvent(`🌳 A ${name} is hiding!`, 'normal');
                    clearTimeout(goose.hideTimer);
                        goose.hideTimer = setTimeout(() => {
                            goose.hiding = false;
                        }, this.hideDuration);
                }
                break;
            }
        }
    }

    update() {
        if (this.gameOver || this.paused) return;

        this.gameTime++;

        if (this.safeMode && this.gameTime >= SIMULATION_PARAMS.SAFE_PERIOD_SECONDS * 60) {
            this.safeMode = false;
            if (!this.initialPredatorsSpawned) {
                this.initialPredatorsSpawned = true;
                const diff      = DIFFICULTY_SETTINGS[currentDifficulty];
                const types     = [PredatorType.FOX, PredatorType.EAGLE, PredatorType.FOX, PredatorType.EAGLE];
                const positions = [[100, 100], [900, 100], [500, 50], [200, 500]];
                for (let i = 0; i < diff.startPredators; i++) {
                    this.predators.push(new Predator(types[i], positions[i][0], positions[i][1]));
                }
            }
            this.logEvent('⚠️ Safe period over! Predators are now active!', 'warning');
        }

        if (this.breedingCooldown > 0) this.breedingCooldown--;

        if (this.gameTime % 120 === 0) this.advanceWeek();

        // Storm visual state (per frame)
        if (this.weather === 'storm') {
            this.stormShakeX = (Math.random() - 0.5) * 8;
            this.stormShakeY = (Math.random() - 0.5) * 4;
            if (Math.random() < 0.015) {
                this.lightningFlash  = 15;
                this.lightningX      = 80 + Math.random() * (this.width - 160);
                this.lightningPoints = [];
                let lx = this.lightningX;
                for (let ly = 0; ly < this.height * 0.65; ) {
                    this.lightningPoints.push({ x: clamp(lx, 20, this.width - 20), y: ly });
                    lx += (Math.random() - 0.5) * 60;
                    ly += 15 + Math.random() * 25;
                }
            }
            if (this.lightningFlash > 0) this.lightningFlash--;
        } else {
            this.stormShakeX = 0; this.stormShakeY = 0; this.lightningFlash = 0;
        }

        this.geese.forEach(g => g.move(this.width, this.height));
        this.predators.forEach(p => p.move(this.width, this.height, this.geese));

        // Age predators; remove ones that have fled off-screen
        for (let i = this.predators.length - 1; i >= 0; i--) {
            const p = this.predators[i];
            if (!p.leaving) { p.lifespan--; if (p.lifespan <= 0) p.leaving = true; }
            else if (p.x < -80 || p.x > this.width + 80 || p.y < -80 || p.y > this.height + 80) {
                this.predators.splice(i, 1);
            }
        }

        // Start ambient + BGM once the game is running
        // if (!this.ambientStarted) { this.ambientStarted = true; this.startAmbientForWeather(); this.startBGM(); }

        // Random ambient honks
        if (Math.random() < 0.0008) this.playSound('honk');
        if (Math.random() < 0.0004) this.playSound('happyhonk');

        if (!this.safeMode) {
            for (let i = this.geese.length - 1; i >= 0; i--) {
                const goose = this.geese[i];
                for (const predator of this.predators) {
                    if (predator.canAttack(goose) && goose.state !== GooseState.EGG) {
                        if (predator.type === PredatorType.EAGLE) this.playSound('eagle');
                        const name = goose.state === GooseState.GOSLING ? 'gosling' : 'goose';
                        this.logEvent(`🦊 A ${predator.type} ate a ${name}!`, 'important');
                        this.geese.splice(i, 1);
                        this.totalDied++;
                        break;
                    }
                }
            }
        }

        // Kill eggs whose mother died or stopped hatching
        let orphanCount = 0;
        for (let i = this.geese.length - 1; i >= 0; i--) {
            const g = this.geese[i];
            if (g.state === GooseState.EGG) {
                const motherAlive = g.parent && this.geese.includes(g.parent) && g.parent.hatching;
                if (!motherAlive) { this.geese.splice(i, 1); this.totalDied++; orphanCount++; }
            }
        }
        if (orphanCount > 0) this.logEvent(`🥚 ${orphanCount} egg${orphanCount > 1 ? 's' : ''} abandoned`, 'warning');

        // Release hatching mothers whose nest is empty
        this.geese.forEach(g => {
            if (g.hatching && !this.geese.some(e => e.state === GooseState.EGG && e.parent === g)) {
                g.hatching = false;
            }
        });

        const { spawnInterval, spawnThreshold } = DIFFICULTY_SETTINGS[currentDifficulty];
        if (this.gameTime % spawnInterval === 0 && !this.safeMode) {
            const gooseCount = this.geese.filter(g => g.state === GooseState.ADULT).length;
            const spawnChance = currentDifficulty === 'hard' ? 0.7 : gooseCount / 10;
            if (gooseCount > spawnThreshold && Math.random() < spawnChance) {
                const type = Math.random() < 0.5 ? PredatorType.FOX : PredatorType.EAGLE;
                const edge = Math.floor(Math.random() * 4);
                let x, y;
                if      (edge === 0) { x = Math.random() * this.width;  y = 0; }
                else if (edge === 1) { x = this.width;  y = Math.random() * this.height; }
                else if (edge === 2) { x = Math.random() * this.width;  y = this.height; }
                else                 { x = 0; y = Math.random() * this.height; }
                this.predators.push(new Predator(type, x, y));
                if (type === PredatorType.EAGLE) this.playSound('eagle');
                this.logEvent(`⚠️ New ${type} appeared! (${gooseCount} geese attracted predators)`, 'warning');
            }
        }

        // Hatching
        const stormMod  = this.weather === 'storm' ? 0.70 : 1.0;
        const eggsReady = this.geese.filter(g => g.state === GooseState.EGG && g.weeksLeft <= 0);
        let hatchedCount = 0, failedCount = 0;
        eggsReady.forEach(goose => {
            if (Math.random() < goose.survivalChance * stormMod) {
                goose.state = GooseState.GOSLING;
                goose.weeksToMature = Math.round(clamp(randomNormal(12, 1.5), 8, 16));
                goose.weeksLeft = goose.weeksToMature;
                hatchedCount++;
            } else {
                const idx = this.geese.indexOf(goose);
                if (idx > -1) { this.geese.splice(idx, 1); this.totalDied++; failedCount++; }
            }
        });
        if (hatchedCount > 0) this.logEvent(`🐣 ${hatchedCount} gosling${hatchedCount > 1 ? 's' : ''} hatched!`, 'positive');
        if (failedCount  > 0) this.logEvent(`💔 ${failedCount} egg${failedCount > 1 ? 's' : ''} failed to hatch`, 'warning');

        // Maturing goslings
        const goslingsReady = this.geese.filter(g => g.state === GooseState.GOSLING && g.weeksLeft <= 0);
        let maturedCount = 0, diedCount = 0;
        goslingsReady.forEach(goose => {
            if (Math.random() < goose.survivalChance * stormMod) {
                goose.state = GooseState.ADULT;
                goose.parent = null;
                this.score += 10;
                maturedCount++;
            } else {
                const idx = this.geese.indexOf(goose);
                if (idx > -1) { this.geese.splice(idx, 1); this.totalDied++; diedCount++; }
            }
        });
        if (maturedCount > 0) this.logEvent(`🦆 ${maturedCount} gosling${maturedCount > 1 ? 's' : ''} matured to adults!`, 'positive');
        if (diedCount    > 0) this.logEvent(`💀 ${diedCount} gosling${diedCount > 1 ? 's' : ''} didn't survive to adulthood`, 'warning');

        if (this.geese.length === 0) {
            this.gameOver = true;
            this.logEvent('☠️ Game Over! All geese have sadly passed away', 'important');
        }

        this.updateUI();
    }

    breed() {
        if (this.breedingCooldown > 0) {
            this.logEvent(`⏳ Hatching on cooldown — wait a bit longer`, 'warning');
            return;
        }

        const allMales   = this.geese.filter(g => g.state === GooseState.ADULT && g.gender === 'male');
        const allFemales = this.geese.filter(g => g.state === GooseState.ADULT && g.gender === 'female');
        const males   = allMales.filter(g => g.energy > 50);
        const females = allFemales.filter(g => g.energy > 50);

        if (allMales.length === 0 || allFemales.length === 0) {
            const missing = allMales.length === 0 ? 'goose' : 'gander';
            this.logEvent(`💔 Hatch failed — no adult ${missing} in the flock`, 'warning');
            return;
        }
        if (males.length === 0 || females.length === 0) {
            const who = males.length === 0 ? 'gander' : 'goose';
            this.logEvent(`💔 Hatch failed — ${who} too exhausted (energy < 50%)`, 'warning');
            return;
        }

        const breedingSuccess = clamp(
            randomNormal(SIMULATION_PARAMS.BREEDING_SUCCESS_MEAN, SIMULATION_PARAMS.BREEDING_SUCCESS_STDDEV),
            0.2, 1.0
        );
        if (Math.random() < breedingSuccess) {
            const mother = females[Math.floor(Math.random() * females.length)];
            const clutchSize = Math.round(clamp(
                randomNormal(SIMULATION_PARAMS.CLUTCH_SIZE_MEAN, SIMULATION_PARAMS.CLUTCH_SIZE_STDDEV),
                SIMULATION_PARAMS.CLUTCH_SIZE_MIN, SIMULATION_PARAMS.CLUTCH_SIZE_MAX
            ));
            for (let i = 0; i < clutchSize; i++) {
                const egg = new Goose(
                    GooseState.EGG, 0,
                    mother.x + (Math.random() * 30 - 15),
                    mother.y + (Math.random() * 30 - 15),
                    Math.random() < 0.5 ? 'male' : 'female',
                    mother
                );
                egg.game = this;
                this.geese.push(egg);
                this.totalBorn++;
            }
            this.logEvent(`💕 Hatching successful! ${clutchSize} egg${clutchSize > 1 ? 's' : ''} laid`, 'positive');
            mother.energy -= 15;
            mother.hatching = true;
        } else {
            this.logEvent(`💔 Hatch failed — bad luck this time`, 'warning');
        }
        this.breedingCooldown = SIMULATION_PARAMS.BREEDING_COOLDOWN;
    }

    forceMating() {
        if (this.paused) return;
        this.breedingCooldown = 0;
        this.breed();
    }

    logEvent(message, type = 'normal') {
        this.eventLog.push({ message, type, time: Date.now() });
        if (this.eventLog.length > this.maxLogEntries) this.eventLog.shift();
        this.updateEventLog();
        if (type === 'positive')       this.playNotification('static/audio/goodnews.mp3');
        else if (type === 'warning')   this.playNotification('static/audio/warning.mp3');
        else if (type === 'important') this.playNotification('static/audio/alert.mp3');
    }

    updateEventLog() {
        const logElement = document.getElementById('eventLog');
        if (!logElement || this.eventLog.length === 0) return;
        const event = this.eventLog[this.eventLog.length - 1];
        let className = 'event-message';
        if (event.type === 'important') className += ' important';
        if (event.type === 'positive')  className += ' positive';
        if (event.type === 'warning')   className += ' warning';
        logElement.innerHTML = `<div class="${className}">${event.message}</div>`;
    }

    triggerMigration(direction) {
        this.playSound(Math.random() < 0.5 ? 'migrationhonk' : 'migrationhonk2');
        this.migrationActive    = true;
        this.migrationDirection = direction;

        let newLat  = this.latitude;
        let newLong = this.longitude;
        const latDeg  = this.fastMigration ? SIMULATION_PARAMS.MIGRATION_DISTANCE_FAST   : SIMULATION_PARAMS.MIGRATION_DISTANCE_NORMAL;
        const longDeg = this.fastMigration ? SIMULATION_PARAMS.MIGRATION_LONG_FAST       : SIMULATION_PARAMS.MIGRATION_LONG_NORMAL;
        const latDrift  = (Math.random() - 0.5) * 3.0;
        const longDrift = (Math.random() - 0.5) * 3.0;

        switch (direction) {
            case 'north':
                newLat  = clamp(this.latitude + latDeg, SIMULATION_PARAMS.LATITUDE_MIN, SIMULATION_PARAMS.LATITUDE_MAX);
                newLong = this.longitude + longDrift;
                break;
            case 'south':
                newLat  = clamp(this.latitude - latDeg, SIMULATION_PARAMS.LATITUDE_MIN, SIMULATION_PARAMS.LATITUDE_MAX);
                newLong = this.longitude + longDrift;
                break;
            case 'east':
                newLong = this.longitude + longDeg;
                newLat  = clamp(this.latitude + latDrift * 0.5, SIMULATION_PARAMS.LATITUDE_MIN, SIMULATION_PARAMS.LATITUDE_MAX);
                break;
            case 'west':
                newLong = this.longitude - longDeg;
                newLat  = clamp(this.latitude + latDrift * 0.5, SIMULATION_PARAMS.LATITUDE_MIN, SIMULATION_PARAMS.LATITUDE_MAX);
                break;
        }
        if (newLong >  180) newLong -= 360;
        if (newLong < -180) newLong += 360;

        let targetX, targetY;
        switch (direction) {
            case 'north': targetX = this.width / 2;  targetY = 50;               break;
            case 'south': targetX = this.width / 2;  targetY = this.height - 50; break;
            case 'east':  targetX = this.width - 50; targetY = this.height / 2;  break;
            case 'west':  targetX = 50;              targetY = this.height / 2;  break;
        }

        // Energy cost of migration
        const migrants = this.geese.filter(g => g.state === GooseState.ADULT && !g.hatching);
        if (this.fastMigration) {
            migrants.forEach(g => { g.energy = Math.max(5, g.energy - 80); });
            this.logEvent('⚡ Sprint! Energy heavily depleted', 'warning');
        } else {
            migrants.forEach(g => { g.energy = Math.max(15, g.energy - 20); });
        }

        // Goslings and eggs can't migrate — they die
        const leftBehind = this.geese.filter(g => g.state === GooseState.GOSLING || g.state === GooseState.EGG);
        if (leftBehind.length > 0) {
            const gCnt = leftBehind.filter(g => g.state === GooseState.GOSLING).length;
            const eCnt = leftBehind.filter(g => g.state === GooseState.EGG).length;
            leftBehind.forEach(g => {
                const idx = this.geese.indexOf(g);
                if (idx > -1) { this.geese.splice(idx, 1); this.totalDied++; }
            });
            this.geese.forEach(g => { if (g.hatching) g.hatching = false; });
            const parts = [];
            if (gCnt > 0) parts.push(`${gCnt} gosling${gCnt > 1 ? 's' : ''}`);
            if (eCnt > 0) parts.push(`${eCnt} egg${eCnt > 1 ? 's' : ''}`);
            this.logEvent(`💔 ${parts.join(' and ')} couldn't migrate and perished`, 'important');
        }

        this.geese.forEach(goose => {
            if (goose.state === GooseState.ADULT && !goose.hatching) {
                goose.migrating = true;
                goose.migrationTarget = { x: targetX, y: targetY };
            }
        });

        this.migrationOverlayActive    = true;
        this.migrationOverlayDirection = direction;
        this.paused = true;

        setTimeout(() => {
            this.migrationOverlayActive = false;
            this.migrationActive        = false;
            this.paused = false;
            this.latitude               = parseFloat(newLat.toFixed(1));
            this.longitude              = parseFloat(newLong.toFixed(1));
            this.weeksAtLocation        = 0;
            this.vegWarnThreshold       = 4 + Math.floor(Math.random() * 5);
            this.geese.forEach(g => { g.survivalChance = g.calculateSurvivalChance(); });
            this.regenerateTerrain();
            this.advanceWeek();
            this.logEvent(`🗺️ Migrated ${direction}! New terrain discovered.`, 'positive');
            this.updateUI();
        }, 2000);
    }

    regenerateTerrain() {
        this.ponds  = [];
        this.bushes = [];

        const vegTypes = getVegTypes(Math.abs(this.latitude));

        const numPonds = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numPonds; i++) {
            this.ponds.push(new Pond(
                100 + Math.random() * (this.width  - 300),
                100 + Math.random() * (this.height - 200),
                80  + Math.random() * 100,
                60  + Math.random() * 80
            ));
        }

        const vegRadii = { bush: 65, bush2: 65, bush3: 65, cactus: 55, palm: 70, snow: 85, snow2: 85 };
        const numVeg = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numVeg; i++) {
            const type   = vegTypes[Math.floor(Math.random() * vegTypes.length)];
            const radius = vegRadii[type] || 50;
            this.bushes.push(new Bush(
                50 + Math.random() * (this.width  - 100),
                50 + Math.random() * (this.height - 100),
                radius, type
            ));
        }
    }

    hideAllGeese() {
        if (this.paused) return;
        let hiddenCount = 0;
        this.geese.forEach(goose => {
            if (goose.state === GooseState.EGG) return;
            if (goose.hatching) return; // can't leave the nest
            let nearestBush = null, minDist = Infinity;
            for (const bush of this.bushes) {
                const dist = Math.sqrt((bush.x - goose.x) ** 2 + (bush.y - goose.y) ** 2);
                if (dist < minDist) { minDist = dist; nearestBush = bush; }
            }
            if (nearestBush) {
                goose.hiding = true;
                goose.x = nearestBush.x;
                goose.y = nearestBush.y;
                hiddenCount++;
                clearTimeout(goose.hideTimer);
                goose.hideTimer = setTimeout(() => {
                    goose.hiding = false;
                }, this.hideDuration);
            }
        });
        if (hiddenCount > 0) {
            this.logEvent(`🌳 ${hiddenCount} ${hiddenCount > 1 ? 'geese' : 'goose'} hiding in bushes!`, 'normal');
        }
    }

    addPredator() {
        const type = Math.random() < 0.5 ? PredatorType.FOX : PredatorType.EAGLE;
        this.predators.push(new Predator(type, Math.random() * this.width, Math.random() * this.height));
    }

    draw() {
        this.ctx.clearRect(-20, -20, this.width + 40, this.height + 40);

        // World drawn with storm shake applied
        this.ctx.save();
        this.ctx.translate(this.stormShakeX, this.stormShakeY);

        this.ponds.forEach(p => p.draw(this.ctx));
        this.bushes.forEach(b => b.draw(this.ctx, this));
        this.geese.forEach(g => g.draw(this.ctx, this));
        this.predators.forEach(p => p.draw(this.ctx, this));

        // Weather overlays (inside shake so they shake too)
        if (!this.migrationOverlayActive && !this.manuallyPaused && !this.gameOver) {
            if (this.weather === 'storm') {
                this.ctx.fillStyle = 'rgba(10, 15, 45, 0.42)';
                this.ctx.fillRect(-20, -20, this.width + 40, this.height + 40);
                if (this.lightningFlash > 0) this.drawLightning();
            } else if (this.weather === 'rain') {
                this.ctx.fillStyle = 'rgba(40, 70, 120, 0.18)';
                this.ctx.fillRect(0, 0, this.width, this.height);
            }
        }

        this.ctx.restore();

        // Migration overlay (2-second screen between terrain changes)
        if (this.migrationOverlayActive) {
            const adultCount = this.geese.filter(g => g.state === GooseState.ADULT).length;
            const migImg = adultCount >= 2 ? this.images.migration2 : this.images.migration;

            this.ctx.fillStyle = 'rgba(100, 180, 230, 0.88)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            if (migImg && migImg.complete && migImg.naturalWidth > 0) {
                const imgW = Math.min(420, this.width * 0.5);
                const imgH = imgW * 0.65;
                this.ctx.save();
                this.ctx.translate(this.width / 2, this.height / 2 - 20);
                if (this.migrationOverlayDirection === 'east') this.ctx.scale(-1, 1);
                this.ctx.drawImage(migImg, -imgW / 2, -imgH / 2, imgW, imgH);
                this.ctx.restore();
            }

            const arrows = { north: '⬆️', south: '⬇️', east: '➡️', west: '⬅️' };
            this.ctx.fillStyle = '#0a1628';
            this.ctx.font      = `bold ${Math.max(20, Math.floor(this.width / 28))}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                `Migrating ${this.migrationOverlayDirection}! ${arrows[this.migrationOverlayDirection]}`,
                this.width / 2, this.height - 50
            );
        }

        if (this.gameOver) {
            const survivedWeeks = Math.floor(this.gameTime / 120);

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';

            this.ctx.font = 'bold 60px Arial';
            this.ctx.fillText('Game Over!', this.width / 2, this.height / 2 - 40);

            this.ctx.font = 'bold 30px Arial';
            this.ctx.fillText(
                `Congrats, you survived ${survivedWeeks} week${survivedWeeks === 1 ? '' : 's'}!`,
                this.width / 2,
                this.height / 2 + 15
            );
        }

        if (this.manuallyPaused && !this.migrationOverlayActive && !this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font      = `bold ${Math.max(48, Math.floor(this.width / 14))}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('⏸ PAUSED', this.width / 2, this.height / 2);
        }
    }

    updateUI() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const scoreEl = document.getElementById('score'); if (scoreEl) scoreEl.textContent = `Score: ${this.score}`;
        const countEl = document.getElementById('geese-count'); if (countEl) countEl.textContent = `Geese: ${this.geese.length}`;
        const timeEl  = document.getElementById('time'); if (timeEl) timeEl.textContent = `Time: ${elapsed}s`;

        const latDir  = this.latitude  >= 0 ? 'N' : 'S';
        const longDir = this.longitude >= 0 ? 'E' : 'W';
        document.getElementById('locationDisplay').textContent =
            `${Math.abs(this.latitude).toFixed(1)}°${latDir}, ${Math.abs(this.longitude).toFixed(1)}°${longDir}`;

        const climate = getClimateZone(this.latitude);
        const climateDisplay = document.getElementById('climateZone');
        climateDisplay.textContent      = climate.name;
        climateDisplay.style.color      = climate.color;
        climateDisplay.style.fontWeight = 'bold';

        // Weather
        const weatherEl = document.getElementById('weatherDisplay');
        if (weatherEl) {
            const wIcons = { sunny: '☀️ Sunny', rain: '🌧️ Rain', storm: '⛈️ Storm' };
            const wColors = { sunny: '#f6d855', rain: '#7babc7', storm: '#ee0979' };
            weatherEl.textContent = wIcons[this.weather] || '☀️ Sunny';
            weatherEl.style.color = wColors[this.weather] || '';
            weatherEl.style.fontWeight = this.weather === 'storm' ? 'bold' : 'normal';
        }

        // Date
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const dateEl = document.getElementById('dateDisplay');
        if (dateEl) dateEl.innerHTML = `<strong>${MONTHS[this.month]} Week ${this.week}</strong>`;

        // Avg Health (energy)
        const adults   = this.geese.filter(g => g.state === GooseState.ADULT);
        const avgEnergy = adults.length > 0
            ? Math.round(adults.reduce((sum, g) => sum + g.energy, 0) / adults.length)
            : 100;
        const healthEl = document.getElementById('avgHealth');
        if (healthEl) {
            healthEl.textContent = `${avgEnergy}%`;
            healthEl.style.color = avgEnergy > 70 ? '#38ef7d' : avgEnergy > 40 ? '#ff9800' : '#ee0979';
        }

        // Population breakdown
        const numAdults   = this.geese.filter(g => g.state === GooseState.ADULT).length;
        const numGoslings = this.geese.filter(g => g.state === GooseState.GOSLING).length;
        const numEggs     = this.geese.filter(g => g.state === GooseState.EGG).length;
        const popEl = document.getElementById('populationBreakdown');
        if (popEl) popEl.textContent = `${numAdults}🪿 ${numGoslings}🐥 ${numEggs}🥚`;
    }

    reset() {
        this.geese     = [];
        this.predators = [];
        this.ponds     = [];
        this.bushes    = [];
        this.score     = 0;
        this.gameTime  = 0;
        this.gameOver       = false;
        this.manuallyPaused = false;
        this.startTime      = Date.now();
        const resetLoc = this.randomStartLocation();
        this.latitude  = resetLoc.lat;
        this.longitude = resetLoc.lng;
        this.migrationActive           = false;
        this.migrationDirection        = null;
        this.migrationOverlayActive    = false;
        this.migrationOverlayDirection = null;
        this.breedingCooldown = 0;
        this.totalBorn = 2;
        this.totalDied = 0;
        this.safeMode = true;
        this.month = Math.floor(Math.random() * 12);
        this.week  = Math.floor(Math.random() * 4) + 1;
        this.weather          = 'sunny';
        this.weatherWeeksLeft = 3 + Math.floor(Math.random() * 4);
        this.stormShakeX = 0; this.stormShakeY = 0;
        this.lightningFlash = 0; this.lightningPoints = [];
        this.fastMigration    = false;
        this.weeksAtLocation  = 0;
        this.vegWarnThreshold = 4 + Math.floor(Math.random() * 5);
        this.stopAmbient();
        this.stopBGM();
        this.ambientStarted = false;
        this.eventLog = [];
        this.logEvent('🎮 Game started! Safe period: 10 seconds', 'positive');
        this.init();
        this.updateUI();
    }

    togglePause() {
        this.paused         = !this.paused;
        this.manuallyPaused = this.paused;
        if (this.paused) {
            if (this.ambientAudio) this.ambientAudio.pause();
            if (this.bgmAudio)     this.bgmAudio.pause();
        } else {
            if (this.ambientAudio) this.ambientAudio.play().catch(() => {});
            if (this.bgmAudio)     this.bgmAudio.play().catch(() => {});
        }
        return this.paused;
    }
}
