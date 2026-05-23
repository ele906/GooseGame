export const CLIMATE_ZONES = {
    ARCTIC:                  { min: 60,  max: 90,  name: 'Arctic',       color: '#d4e4f7', survivalMod: 0.6  },
    SUBARCTIC:               { min: 50,  max: 60,  name: 'Subarctic',    color: '#b8e6f0', survivalMod: 0.8  },
    TEMPERATE:               { min: 30,  max: 50,  name: 'Temperate',    color: '#98d8c8', survivalMod: 1.0  },
    SUBTROPICAL:             { min: 15,  max: 30,  name: 'Subtropical',  color: '#f6d186', survivalMod: 0.85 },
    TROPICAL:                { min: -15, max: 15,  name: 'Tropical',     color: '#f7a072', survivalMod: 0.7  },
    SOUTHERN_SUBTROPICAL:    {min: -30, max: -15,  name: 'Subtropical',  color: '#f7a072', survivalMod: 0.85 },
    SOUTHERN_TEMPERATE:      { min: -45, max: -35, name: 'Temperate', color: '#98d8c8', survivalMod: 1.0 },
    SUBANTARCTIC :           { min: -60, max: -45, name: 'Temperate', color: '#98d8c8', survivalMod: 0.8  },
    ANTARCTIC:               { min: -90, max: -60, name: 'Antarctic',    color: '#d4e4f7', survivalMod: 0.6  },
};

export function getClimateZone(latitude) {
    for (const zone of Object.values(CLIMATE_ZONES)) {
        if (latitude >= zone.min && latitude <= zone.max) return zone;
    }
    return CLIMATE_ZONES.TEMPERATE;
}

export function getVegTypes(absLat) {
    if (absLat >= 50) return ['snow', 'snow2'];
    if (absLat >= 30) return ['bush', 'bush2', 'bush3'];
    if (absLat >= 15) return ['cactus'];
    return ['palm'];
}
