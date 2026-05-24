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

        this.fastMigration      = false;
        this.weeksAtLocation    = 0;
        this.vegWarnThreshold   = 10 + Math.floor(Math.random() * 7);
        this.loneGooseCooldown  = 100 + Math.floor(Math.random() * 51);

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
            bgmEasy:  ls('static/audio/bgm-easy.mp3'),
            bgmMed:   ls('static/audio/bgm-med.mp3'),
            bgmHard:  ls('static/audio/bgm-hard.mp3'),
            bgmEasy2: ls('static/audio/bgm-easy2.mp3'),
            bgmMed2:  ls('static/audio/bgm-med2.mp3'),
            bgmHard2: ls('static/audio/bgm-hard2.mp3'),
            goodnews:  ls('static/audio/goodnews.mp3'),
            warning:   ls('static/audio/warning.mp3'),
            alert:     ls('static/audio/alert.mp3'),
            fun:       ls('static/audio/fun.mp3'),
            fox:       ls('static/audio/fox.mp3'),
        };

        // Lower SFX so BGM stays audible
        ['happyhonk','migrationhonk','migrationhonk2',
         'angryhonk1','angryhonk2','angryhonk3','angryhonk4','angryhonk5',
         'eagle','fox'].forEach(k => { if (this.sounds[k]) this.sounds[k].volume = 0.35; });

        this.ambientAudio   = null;
        this.bgmAudio       = null;
        this.ambientStarted = false;
        this.bgmVariant     = null;
        this.lastNotifTime  = {};

        this.init();
        canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    playSound(name, startTime = 0) {
        try {
            const s = this.sounds[name];
            if (!s) return;
            s.currentTime = startTime;
            s.play().catch(() => {});
        } catch(e) {}
    }

    playNotification(src) {
        const now = Date.now();
        if (this.lastNotifTime[src] && now - this.lastNotifTime[src] < 3000) return;
        this.lastNotifTime[src] = now;
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
        else if (this.weather === 'wind')  this.startAmbient('wind');
        else if (this.weather === 'storm') this.startAmbient(Math.random() < 0.5 ? 'storm' : 'storm2');
        else                               this.stopAmbient();
    }

    startBGM() {
        if (this.bgmVariant === null) this.bgmVariant = Math.random() < 0.5 ? '' : '2';
        const map = { easy: `bgmEasy${this.bgmVariant}`, normal: `bgmMed${this.bgmVariant}`, hard: `bgmHard${this.bgmVariant}` };
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
        const adultCount = this.geese.filter(g => g.state === GooseState.ADULT).length;
        // 1 adult: ~20%, scales up to ~85% at 10+ adults
        const scarePct = clamp(0.20 + (adultCount - 1) * 0.07, 0.20, 0.85);
        let scared = 0;
        this.predators.forEach(p => {
            if (!p.leaving && Math.random() < scarePct) { p.leaving = true; scared++; }
        });
        if (scared > 0) {
            const hidingAdults = this.geese.filter(g => g.state === GooseState.ADULT && g.hiding);
            const exposedAdults = this.geese.filter(g => g.state === GooseState.ADULT && !g.hiding);
            const fromBush = hidingAdults.length > 0 && exposedAdults.length === 0;

            if (fromBush) {
                const bushMsgs = [
                    `🌳 HONK from the shadows! ${scared} predator${scared > 1 ? 's' : ''} fled — mystery is power.`,
                    `🌳 Spooked ${scared} predator${scared > 1 ? 's' : ''} from the bushes — they never saw it coming!`,
                    `🌳 A disembodied HONK echoed through the bushes. ${scared} predator${scared > 1 ? 's' : ''} noped out.`,
                ];
                this.logEvent(bushMsgs[Math.floor(Math.random() * bushMsgs.length)], 'positive');
            } else {
                const boldMsgs = [
                    `📢 FEARLESS HONK! Scared off ${scared} predator${scared > 1 ? 's' : ''}! This is YOUR land!`,
                    `📢 TERRITORIAL HONK! ${scared} predator${scared > 1 ? 's' : ''} fled before your fury!`,
                    `📢 HONK HONK HONK! ${scared} predator${scared > 1 ? 's' : ''} scattered — nobody messes with this flock!`,
                    `📢 DOMINANT HONK! You stood your ground and sent ${scared} predator${scared > 1 ? 's' : ''} running!`,
                ];
                this.logEvent(boldMsgs[Math.floor(Math.random() * boldMsgs.length)], 'positive');
                // Confidence boost — geese feel pumped after defending their territory
                exposedAdults.forEach(g => { g.energy = Math.min(100, g.energy + 5); });
            }
        } else {
            const missedMsgs = [
                '📢 You honked into the void. Silence.',
                '📢 HONK! ...no response. They don\'t care.',
                '📢 A brave honk. The predators were unmoved.',
                '📢 HONK! Crickets.',
            ];
            this.logEvent(missedMsgs[Math.floor(Math.random() * missedMsgs.length)], 'normal');
        }
    }

    advanceWeek() {
        this.week++;
        if (this.week > 4) { this.week = 1; this.month = (this.month + 1) % 12; }
        if (Math.random() < 0.04) this.showFunFact('general');
        if (this.breedingCooldown > 0) this.breedingCooldown--;
        this.geese.forEach(g => {
            if (g.weeksLeft > 0) g.weeksLeft--;
            if (g.state === GooseState.ADULT) {
                g.ageWeeks++;
                if (g.breedingCooldown > 0) g.breedingCooldown--;
            }
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
        } else if (this.weather === 'wind') {
            const exposedGoslings = this.geese.filter(g => g.state === GooseState.GOSLING && !g.hiding);
            exposedGoslings.forEach(g => { g.energy = Math.max(5, g.energy - 10); });
            if (exposedGoslings.length > 0) this.logEvent('💨 Strong winds are battering the goslings! Hide them!', 'warning');
        }

        // Overpopulation — vegetation depletion (scales with flock size)
        const adultCount = this.geese.filter(g => g.state === GooseState.ADULT).length;
        const effectiveThreshold = Math.max(4, this.vegWarnThreshold - Math.floor(adultCount / 5));
        if (adultCount >= 4) {
            this.weeksAtLocation++;

            const warningWeek = effectiveThreshold + 4;
            const dangerWeek  = warningWeek + 6;
            const damageWeek  = dangerWeek + 4;

            if (this.weeksAtLocation === warningWeek) {
                this.logEvent('🌿 Vegetation getting sparse — you may want to migrate soon.', 'warning');
            } else if (this.weeksAtLocation === dangerWeek) {
                this.logEvent('🌿 Habitat is getting worn down. Migration is recommended.', 'important');
            } else if (this.weeksAtLocation >= damageWeek) {
                const drain = Math.min(8, 2 + Math.floor((this.weeksAtLocation - damageWeek) / 2));
                this.geese.forEach(g => { g.energy = Math.max(5, g.energy - drain); });
                this.logEvent(`🍂 Overgrazed habitat! −${drain} health per goose.`, 'important');
            }
        } else {
            if (this.weeksAtLocation > 0) this.weeksAtLocation = Math.max(0, this.weeksAtLocation - 1);
        }

        // Overcrowding pressure — large flocks burn through habitat fast (grace period: 4 weeks)
        const overcrowdLimit = 12;
        if (adultCount > overcrowdLimit && this.weeksAtLocation >= 4) {
            const excess = adultCount - overcrowdLimit;
            const crowdDrain = Math.min(6, Math.floor(excess * 0.6));
            this.geese.forEach(g => {
                if (g.state === GooseState.ADULT) g.energy = Math.max(5, g.energy - crowdDrain);
            });
            if (adultCount > overcrowdLimit + 3) {
                this.logEvent(`🪶 Flock too large for this habitat! Migrate now or geese will suffer.`, 'important');
            } else {
                this.logEvent(`🌿 Habitat strained by large flock — consider migrating.`, 'warning');
            }
        }

        // Lone goose event
        if (this.loneGooseCooldown > 0) {
            this.loneGooseCooldown--;
        } else {
            this.spawnLoneGoose();
            this.loneGooseCooldown = 25 + Math.floor(Math.random() * 23);
        }

        // Pandemic — large flocks risk disease spreading
        if (adultCount > 15 && Math.random() < 0.03) {
            const casualties = 1 + Math.floor(Math.random() * 3);
            const adults = this.geese.filter(g => g.state === GooseState.ADULT);
            for (let i = 0; i < Math.min(casualties, adults.length); i++) {
                const idx = this.geese.indexOf(adults[i]);
                if (idx > -1) { this.geese.splice(idx, 1); this.totalDied++; }
            }
            this.logEvent(`🦠 Disease swept through the flock! ${casualties} goose${casualties > 1 ? 'e' : ''}s lost.`, 'important');
        }

        // Hooman kidnapping — large visible flocks attract unwanted attention
        if (adultCount > 10 && Math.random() < 0.02) {
            const adults = this.geese.filter(g => g.state === GooseState.ADULT && !g.hiding);
            if (adults.length > 0) {
                const victim = adults[Math.floor(Math.random() * adults.length)];
                this.geese.splice(this.geese.indexOf(victim), 1);
                this.totalDied++;
                this.logEvent('😱 A hooman kidnapped one of your geese! HONK!', 'important');
            }
        }
    }

    changeWeather() {
    const r = Math.random();

    if (currentDifficulty === 'easy') {
        this.weather = r < 0.65 ? 'sunny' : r < 0.82 ? 'rain' : r < 0.95 ? 'wind' : 'storm';
        } else if (currentDifficulty === 'normal') {
            this.weather = r < 0.52 ? 'sunny' : r < 0.72 ? 'rain' : r < 0.90 ? 'wind' : 'storm';
        } else {
            this.weather = r < 0.38 ? 'sunny' : r < 0.58 ? 'rain' : r < 0.80 ? 'wind' : 'storm';
        }

        this.weatherWeeksLeft = 2 + Math.floor(Math.random() * 5);

        if ((this.weather === 'storm' || this.weather === 'wind') && currentDifficulty !== 'hard') {
            this.predators.forEach(p => { p.leaving = true; });
        }

        this.startAmbientForWeather();

        const icons = { sunny: '☀️', rain: '🌧️', wind: '💨', storm: '⛈️' };
        const names = { sunny: 'Sunny', rain: 'Rain', wind: 'Windy', storm: 'Storm!' };

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
        this.bushes.push(new Bush(150, 180));
        this.bushes.push(new Bush(750, 420));
        this.bushes.push(new Bush(450, 80));

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
                    if (this.weather === 'sunny') {
                        goose.energy = Math.max(5, goose.energy - 3);
                        this.logEvent(`☀️ Hiding on a sunny day — ${name} needs exercise! (-3 health)`, 'warning');
                    }
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

        // Guide lone geese toward their target, re-asserting migrating each frame to prevent dropout
        for (const g of this.geese) {
            if (!g.loneGoose) continue;
            const dx = g.loneGooseTarget.x - g.x;
            const dy = g.loneGooseTarget.y - g.y;
            if (Math.sqrt(dx * dx + dy * dy) <= 80) {
                g.loneGoose = false;
                g.migrating = false;
                this.logEvent('🪿 The lone goose has joined your flock! Honk!', 'positive');
            } else {
                g.migrating = true;
                g.migrationTarget = g.loneGooseTarget;
            }
        }

        this.geese.forEach(g => g.move(this.width, this.height, this.geese));
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
            const EAT_COOLDOWN_FRAMES = 20 * 60; // 20 seconds
            for (const predator of this.predators) {
                if (predator.eatCooldown > 0) { predator.eatCooldown--; continue; }

                const catchProb = SIMULATION_PARAMS.PREDATOR_CATCH_PROBABILITY;
                const inRange = (g) => predator.distance(g) < 30;

                // Priority 1: eat 1 adult
                const adults = this.geese.filter(g => g.state === GooseState.ADULT && !g.hiding && inRange(g));
                if (adults.length > 0) {
                    const target = adults[0];
                    if (Math.random() < catchProb * (1 - target.survivalChance)) {
                        if (predator.type === PredatorType.EAGLE) this.playSound('eagle');
                        else if (predator.type === PredatorType.FOX) this.playSound('fox', 2);
                        this.logEvent(`🦊 A ${predator.type} caught a goose!`, 'important');
                        this.geese.splice(this.geese.indexOf(target), 1);
                        this.totalDied++;
                        predator.eatCooldown = EAT_COOLDOWN_FRAMES;
                        continue;
                    }
                }

                // Priority 2: eat up to 2 goslings
                const goslings = this.geese.filter(g => g.state === GooseState.GOSLING && !g.hiding && inRange(g));
                if (goslings.length > 0) {
                    let ate = 0;
                    for (const g of goslings) {
                        if (ate >= 2) break;
                        if (Math.random() < catchProb * (1 - g.survivalChance)) {
                            this.geese.splice(this.geese.indexOf(g), 1);
                            this.totalDied++;
                            ate++;
                        }
                    }
                    if (ate > 0) {
                        if (predator.type === PredatorType.EAGLE) this.playSound('eagle');
                        else if (predator.type === PredatorType.FOX) this.playSound('fox', 2);
                        this.logEvent(`🦊 A ${predator.type} ate ${ate} gosling${ate > 1 ? 's' : ''}!`, 'important');
                        predator.eatCooldown = EAT_COOLDOWN_FRAMES;
                        continue;
                    }
                }

                // Priority 3: destroy ALL eggs in range
                const eggs = this.geese.filter(g => g.state === GooseState.EGG && inRange(g));
                if (eggs.length > 0 && Math.random() < catchProb * 3) {
                    for (const g of eggs) {
                        this.geese.splice(this.geese.indexOf(g), 1);
                        this.totalDied++;
                    }
                    this.logEvent(`🦊 A ${predator.type} destroyed ${eggs.length} egg${eggs.length > 1 ? 's' : ''}!`, 'important');
                    predator.eatCooldown = EAT_COOLDOWN_FRAMES;
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
            const adultCount = this.geese.filter(g => g.state === GooseState.ADULT).length;
            const totalCount = this.geese.length;
            const spawnChance = currentDifficulty === 'hard' ? 0.7 : Math.min(1, totalCount / 8);
            const maxSpawns = totalCount >= 12 ? 2 : 1;
            if (adultCount > spawnThreshold) {
                for (let s = 0; s < maxSpawns; s++) {
                    if (Math.random() < spawnChance) {
                        const type = Math.random() < 0.5 ? PredatorType.FOX : PredatorType.EAGLE;
                        const edge = Math.floor(Math.random() * 4);
                        let x, y;
                        if      (edge === 0) { x = Math.random() * this.width;  y = 0; }
                        else if (edge === 1) { x = this.width;  y = Math.random() * this.height; }
                        else if (edge === 2) { x = Math.random() * this.width;  y = this.height; }
                        else                 { x = 0; y = Math.random() * this.height; }
                        this.predators.push(new Predator(type, x, y));
                        if (type === PredatorType.EAGLE) this.playSound('eagle');
                        this.logEvent(`⚠️ New ${type} appeared! (${totalCount} geese attracted predators)`, 'warning');
                    }
                }
            }
        }

        // Hatching
        const stormMod  = this.weather === 'storm' ? 0.70 : 1.0;
        const goslingCount = this.geese.filter(g => g.state === GooseState.GOSLING).length;
        const goslingCrowdMod = goslingCount > 5 ? Math.max(0.4, 1 - (goslingCount - 5) * 0.06) : 1.0;
        const eggsReady = this.geese.filter(g => g.state === GooseState.EGG && g.weeksLeft <= 0);
        let hatchedCount = 0, failedCount = 0;
        eggsReady.forEach(goose => {
            if (Math.random() < goose.survivalChance * stormMod * goslingCrowdMod) {
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
            if (Math.random() < goose.survivalChance * stormMod * goslingCrowdMod) {
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
            this.logEvent(`🪶 Flock needs ${this.breedingCooldown} more week${this.breedingCooldown > 1 ? 's' : ''} to recover before breeding again`, 'warning');
            return;
        }

        const adultCount = this.geese.filter(g => g.state === GooseState.ADULT).length;
        const BREED_SOFT_CAP = 10;
        const BREED_HARD_CAP = 18;

        if (adultCount >= BREED_HARD_CAP) {
            this.logEvent(`🪶 Flock too large to breed — migrate to a new habitat first`, 'important');
            return;
        }

        const allMales   = this.geese.filter(g => g.state === GooseState.ADULT && g.gender === 'male');
        const allFemales = this.geese.filter(g => g.state === GooseState.ADULT && g.gender === 'female');
        const MAX_BREED_AGE = 520; // ~10 years in weeks
        const males   = allMales.filter(g => g.energy > 15 && g.ageWeeks < MAX_BREED_AGE);
        const females = allFemales.filter(g => g.energy > 15 && g.breedingCooldown === 0 && !g.hatching && g.ageWeeks < MAX_BREED_AGE);

        const tooOldFemales = allFemales.filter(g => g.ageWeeks >= MAX_BREED_AGE);
        if (tooOldFemales.length > 0 && females.length === 0 && allFemales.length === tooOldFemales.length) {
            this.logEvent(`👴 All geese are too old to breed`, 'warning');
            return;
        }
        if (females.length === 0 && allFemales.length > 0) {
            this.logEvent(`⏳ All geese on cooldown or exhausted — wait a bit`, 'warning');
            return;
        }

        if (allMales.length === 0) {
            this.logEvent(`💔 No male geese in the flock!`, 'warning');
            return;
        }
        if (allFemales.length === 0) {
            this.logEvent(`💔 No female geese in the flock!`, 'warning');
            return;
        }
        if (males.length === 0 || females.length === 0) {
            this.logEvent(`💔 Hatch failed — geese too exhausted to breed`, 'warning');
            return;
        }

        // Soft cap: reduce success chance as flock grows past 10
        const crowdPenalty = adultCount > BREED_SOFT_CAP
            ? Math.max(0, 1 - (adultCount - BREED_SOFT_CAP) * 0.08)
            : 1.0;

        const breedingSuccess = clamp(
            randomNormal(SIMULATION_PARAMS.BREEDING_SUCCESS_MEAN, SIMULATION_PARAMS.BREEDING_SUCCESS_STDDEV),
            0.2, 1.0
        ) * crowdPenalty;
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
            setTimeout(() => this.showFunFact('hatch'), 2500);
            mother.energy = Math.max(10, mother.energy - 35);
            this.geese.forEach(g => {
                if (g.state === GooseState.ADULT && g !== mother)
                    g.energy = Math.max(10, g.energy - 8);
            });
            mother.hatching = true;
            mother.breedingCooldown = SIMULATION_PARAMS.BREEDING_COOLDOWN;
            this.breedingCooldown = 8;
        } else {
            this.logEvent(`💔 Hatch failed — bad luck this time`, 'warning');
        }
    }

    forceMating() {
        if (this.paused) return;
        this.breed();
    }

    logEvent(message, type = 'normal') {
        this.eventLog.push({ message, type, time: Date.now() });
        if (this.eventLog.length > this.maxLogEntries) this.eventLog.shift();
        this.updateEventLog();
        if (type === 'positive')       this.playNotification('static/audio/goodnews.mp3');
        else if (type === 'warning')   this.playNotification('static/audio/warning.mp3');
        else if (type === 'important') this.playNotification('static/audio/alert.mp3');
        else if (type === 'fun')       this.playSound('fun');
    }

    updateEventLog() {
        const logElement = document.getElementById('eventLog');
        if (!logElement || this.eventLog.length === 0) return;
        const event = this.eventLog[this.eventLog.length - 1];
        let className = 'event-message';
        if (event.type === 'important') className += ' important';
        if (event.type === 'positive')  className += ' positive';
        if (event.type === 'warning')   className += ' warning';
        if (event.type === 'fun')       className += ' fun';
        logElement.innerHTML = `<div class="${className}">${event.message}</div>`;
    }

    getFlockCentroid() {
        const adults = this.geese.filter(g => g.state === GooseState.ADULT && !g.loneGoose);
        if (adults.length === 0) return { x: this.width / 2, y: this.height / 2 };
        return {
            x: adults.reduce((s, g) => s + g.x, 0) / adults.length,
            y: adults.reduce((s, g) => s + g.y, 0) / adults.length,
        };
    }

    spawnLoneGoose() {
        const edge = Math.floor(Math.random() * 4);
        let sx, sy;
        if      (edge === 0) { sx = Math.random() * this.width;  sy = 0; }
        else if (edge === 1) { sx = this.width;                  sy = Math.random() * this.height; }
        else if (edge === 2) { sx = Math.random() * this.width;  sy = this.height; }
        else                 { sx = 0;                           sy = Math.random() * this.height; }

        const gender = Math.random() < 0.5 ? 'male' : 'female';
        const goose = new Goose(GooseState.ADULT, 0, sx, sy, gender);
        goose.game = this;
        goose.loneGoose = true;

        const c = this.getFlockCentroid();
        goose.loneGooseTarget = {
            x: clamp(c.x + (Math.random() - 0.5) * 120, 80, this.width  - 80),
            y: clamp(c.y + (Math.random() - 0.5) * 120, 80, this.height - 80),
        };
        goose.migrating       = true;
        goose.migrationTarget = goose.loneGooseTarget;

        this.geese.push(goose);
        const dirs = ['north', 'east', 'south', 'west'];
        this.logEvent(`🪿 A lone ${gender} goose is approaching from the ${dirs[edge]}!`, 'positive');
    }

    showFunFact(category = 'general') {
        const facts = {
            hatch: [
                "Canada geese lay 2-8 eggs per clutch, averaging around 5.",
                "Goslings can walk, swim, and feed themselves within 24 hours of hatching!",
                "Canada geese mate for life and return to the same nesting spot every year.",
                "The gander stands guard while the female incubates — he never leaves her side.",
                "Goose eggs take about 25-28 days to hatch.",
                "Goslings can dive underwater to dodge predators even before they can fly!",
                "Multiple goose families sometimes merge into giant 'gang broods' to raise goslings together.",
                "Goslings imprint on their parents within hours of hatching.",
                "Young Canada geese stay with their parents for their entire first year of life.",
                "If a nest is destroyed, a goose may re-nest and try again within the same season.",
                "Both parents aggressively defend their goslings — even from dogs and humans much larger than them.",
                "Goslings huddle under their mother's wings at night to stay warm for the first few weeks.",
            ],
            migration: [
                "Canada geese can fly up to 1,500 miles in a single day during migration!",
                "Flying in a V formation reduces drag — each bird gets a lift from the one ahead.",
                "Geese navigate using the sun, stars, and Earth's magnetic field.",
                "Flying in V formation can increase a flock's range by up to 70% compared to flying solo.",
                "Geese decide when to migrate based on day length, not just temperature.",
                "The lead position in a V rotates — geese take turns fighting the headwind.",
                "Canada geese have been recorded flying as high as 29,000 feet during migration!",
                "Geese follow rivers, coastlines, and mountain ranges as natural navigation guides.",
                "In autumn, Canada geese can fly over 600 miles nonstop before resting.",
                "Some Canada goose populations have stopped migrating entirely and now live year-round in cities.",
                "Young geese learn migration routes from their parents on their very first journey.",
                "Geese often honk during flight to encourage each other and keep the formation tight.",
                "Canada geese typically migrate at night, using stars to stay on course.",
            ],
            general: [
                "Canada geese spend about half their waking day grazing on grass and aquatic plants.",
                "A goose's honk can be heard up to a mile away!",
                "Canada geese molt every summer, losing their flight feathers and going flightless for 4-6 weeks.",
                "Geese can sleep with one eye open, keeping half their brain alert for danger.",
                "Canada geese are strong swimmers and can stay afloat for hours.",
                "Geese have a special oil gland that waterproofs their feathers — they preen constantly to stay dry.",
                "A group of geese on the ground is called a 'gaggle'; in flight, it's called a 'skein'.",
                "Geese prefer open areas near water so they can spot predators from far away.",
                "Canada geese can live up to 24 years in the wild.",
                "Canada geese were introduced to Europe, New Zealand, and even Chile.",
                "Despite their size, Canada geese can run at up to 5 mph on land.",
                "Goslings learn to swim almost immediately after hatching — no lessons needed!",
                "Canada geese are highly territorial during nesting season and will chase off much larger animals.",
                "Geese have serrated edges on their bills called lamellae, which help them grip slippery plants.",
                "Geese communicate through at least 13 different calls, from soft murmurs to loud alarm honks.",
                "Canada geese can drink both fresh and salt water.",
                "Geese have excellent memory and can recognize specific humans who have threatened them before.",
                "Canada geese can take off nearly vertically when startled, like a feathered helicopter.",
                "The black-and-white neck pattern of a Canada goose is unique — like a fingerprint.",
                "Canada geese have been clocked flying at over 70 mph with a strong tailwind.",
            ],
        };
        const pool = facts[category] || facts.general;
        const fact = pool[Math.floor(Math.random() * pool.length)];
        this.logEvent(`💡 ${fact}`, 'fun');
    }

    triggerMigration(direction) {
        if (this.weather === 'storm') {
            this.logEvent('⛈️ Too dangerous to fly in a storm — wait for the weather to clear!', 'warning');
            return;
        }

        const POLE_LIMIT = 80;
        if (direction === 'north' && this.latitude >= POLE_LIMIT) {
            this.logEvent(`🧊 Can't fly further north — too close to the North Pole!`, 'important');
            return;
        }
        if (direction === 'south' && this.latitude <= -POLE_LIMIT) {
            this.logEvent(`🧊 Can't fly further south — too close to the South Pole!`, 'important');
            return;
        }

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
        const tailwind = this.weather === 'wind' && Math.random() < 0.5;
        const headwind = this.weather === 'wind' && !tailwind;
        const windMult = tailwind ? 0.5 : headwind ? 1.6 : 1.0;

        const migrants = this.geese.filter(g => g.state === GooseState.ADULT && !g.hatching);
        if (this.fastMigration) {
            migrants.forEach(g => { g.energy = Math.max(5, g.energy - Math.round(80 * windMult)); });
            if (tailwind)      this.logEvent('💨 Tailwind! Sprint boosted — less energy used!', 'positive');
            else if (headwind) this.logEvent('💨 Headwind! Sprint was brutal — extra health lost.', 'warning');
            else               this.logEvent('⚡ Sprint! Health heavily depleted', 'warning');
        } else {
            migrants.forEach(g => { g.energy = Math.max(15, g.energy - Math.round(20 * windMult)); });
            if (tailwind)      this.logEvent('💨 Tailwind pushed the flock along — easy flight!', 'positive');
            else if (headwind) this.logEvent('💨 Headwind made the flight much harder.', 'warning');
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
            this.vegWarnThreshold       = 10 + Math.floor(Math.random() * 7);
            this.geese.forEach(g => { g.survivalChance = g.calculateSurvivalChance(); });
            this.regenerateTerrain();
            this.advanceWeek();
            this.logEvent(`🗺️ Migrated ${direction}! New terrain discovered.`, 'positive');
            setTimeout(() => this.showFunFact('migration'), 2500);
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
        const numVeg = 7 + Math.floor(Math.random() * 4);
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
            if (this.weather === 'sunny') {
                this.geese.forEach(g => { if (g.hiding) g.energy = Math.max(5, g.energy - 3); });
                const sunnyMsg = [
                    '☀️ Hiding on a sunny day — geese need exercise! (-3 health)',
                    '☀️ Hiding on a sunny day — geese need their vitamin D! (-3 health)',
                    '☀️ Hiding on a sunny day — geese missed out to practice their flight skills! (-3 health)',
                    '☀️ Hiding on a sunny day — geese became less fit... (-3 health)',
                ][Math.floor(Math.random() * 3)];
                this.logEvent(sunnyMsg, 'warning');
            }
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
        const weeks = Math.floor(this.gameTime / 120);
        const scoreDisplayEl = document.getElementById('scoreDisplay');
        if (scoreDisplayEl) scoreDisplayEl.innerHTML = `<strong>${weeks}</strong>`;

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
            const wIcons  = { sunny: '☀️ Sunny', rain: '🌧️ Rain', wind: '💨 Wind', storm: '⛈️ Storm' };
            const wColors = { sunny: '#f6d855', rain: '#7babc7', wind: '#95a5a6',  storm: '#ee0979' };
            weatherEl.textContent = wIcons[this.weather] || '☀️ Sunny';
            weatherEl.style.color = wColors[this.weather] || '';
            weatherEl.style.fontWeight = 'bold';
        }

        // Date
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const dateEl = document.getElementById('dateDisplay');
        if (dateEl) dateEl.innerHTML = `${MONTHS[this.month]}<br>Week ${this.week}`;

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
        if (popEl) popEl.innerHTML = `${numAdults}🪿<br>${numGoslings}🐥 ${numEggs}🥚`;
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
        this.vegWarnThreshold  = 10 + Math.floor(Math.random() * 7);
        this.loneGooseCooldown = 100 + Math.floor(Math.random() * 51);
        this.stopAmbient();
        this.stopBGM();
        this.ambientStarted = false;
        this.bgmVariant     = null;
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
