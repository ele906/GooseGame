export let CANVAS_WIDTH  = 1000;
export let CANVAS_HEIGHT = 600;
export const FPS = 60;

export function setCanvasSize(w, h) {
    CANVAS_WIDTH  = w;
    CANVAS_HEIGHT = h;
}

export const getResponsiveCanvasSize = () => ({
    width:  Math.min(window.innerWidth  * 0.9, 1000),
    height: Math.min(window.innerHeight * 0.65, 750),
});

export const SIMULATION_PARAMS = {
    EGG_SURVIVAL_MEAN:          0.85,
    EGG_SURVIVAL_STDDEV:        0.10,
    GOSLING_SURVIVAL_MEAN:      0.70,
    GOSLING_SURVIVAL_STDDEV:    0.12,
    PREDATOR_CATCH_PROBABILITY: 0.02,
    BREEDING_SUCCESS_MEAN:      0.80,
    BREEDING_SUCCESS_STDDEV:    0.15,
    BREEDING_COOLDOWN:          24,
    CLUTCH_SIZE_MEAN:           4,
    CLUTCH_SIZE_STDDEV:         1.5,
    CLUTCH_SIZE_MIN:            1,
    CLUTCH_SIZE_MAX:            8,
    MIGRATION_ENERGY_LOSS:      0.1,
    MIGRATION_SUCCESS_RATE:     0.95,
    WEATHER_VARIANCE:           0.3,
    SAFE_PERIOD_SECONDS:        10,
    LATITUDE_MIN:               -60,
    LATITUDE_MAX:               75,
    OPTIMAL_LATITUDE_MIN:       35,
    OPTIMAL_LATITUDE_MAX:       55,
    LATITUDE_SURVIVAL_PENALTY:  0.3,
    MIGRATION_DISTANCE_NORMAL:  3.5,
    MIGRATION_DISTANCE_FAST:    21.5,
    MIGRATION_LONG_NORMAL:      5.0,
    MIGRATION_LONG_FAST:        15.0,
};

export let currentDifficulty = 'normal';

export const DIFFICULTY_SETTINGS = {
    easy:   { startPredators: 0, catchProb: 0.01, spawnThreshold: 8, spawnInterval: 2400 },
    normal: { startPredators: 2, catchProb: 0.02, spawnThreshold: 3, spawnInterval: 1800 },
    hard:   { startPredators: 4, catchProb: 0.04, spawnThreshold: 2, spawnInterval: 1200 },
};

export function applyDifficulty(level) {
    currentDifficulty = level;
    SIMULATION_PARAMS.PREDATOR_CATCH_PROBABILITY = DIFFICULTY_SETTINGS[level].catchProb;
}

export function randomNormal(mean, stddev) {
    const u1 = Math.random(), u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * stddev + mean;
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export const GooseState   = { EGG: 'egg', GOSLING: 'gosling', ADULT: 'adult' };
export const PredatorType = { FOX: 'fox', EAGLE: 'eagle' };
