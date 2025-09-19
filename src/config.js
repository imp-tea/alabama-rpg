export const TILE_SIZE = 16;              // pixels per tile
export const CHUNK_SIZE = 64;             // tiles per chunk side
export const CHUNK_PIXEL_SIZE = TILE_SIZE * CHUNK_SIZE;

export const PLAYER_SPEED = 200;          // pixels per second

// How many chunks beyond the viewport to draw/generate
export const VIEW_CHUNK_MARGIN = 1;

// Extended noise parameters for environmental axes
export const NOISE_PARAMS = {
  elevation: { octaves: 5, frequency: 1 / 96,  lacunarity: 2.0, gain: 0.5 },
  moisture:  { octaves: 4, frequency: 1 / 64, lacunarity: 2.0, gain: 0.5 },
  temperature: { octaves: 4, frequency: 1 / 256, lacunarity: 2.0, gain: 0.55 },
  roughness:   { octaves: 3, frequency: 1 / 32,  lacunarity: 2.5, gain: 0.6 },
  salinity:    { octaves: 3, frequency: 1 / 384, lacunarity: 2.0, gain: 0.5 },
  fertility:   { octaves: 4, frequency: 1 / 192, lacunarity: 2.0, gain: 0.5 },
  fire:        { octaves: 3, frequency: 1 / 128, lacunarity: 2.0, gain: 0.55 },
};

// Large-scale gradients to evoke Alabama-like north-south variation
export const GRADIENTS = {
  TEMP_LAT_GRAD_TILES: 8192, // hotter to the south (positive Y)
  SAL_LAT_GRAD_TILES:  8192, // more saline toward the coast (south)
  TEMP_ELEV_COOLING:   0.25, // temperature reduced by elevation
  SAL_ELEV_REDUCTION:  0.50, // salinity reduced by elevation
  ROUGH_SLOPE_SCALE:   10.0, // scales slope magnitude to [0,1]ish
};

// Optional weights if we later weight axes in classification
export const CLASSIFY_WEIGHTS = {
  temp: 1.0,
  moist: 1.0,
  elev: 1.1,
  rough: 1.0,
  sal: 1.1,
  fert: 1.0,
  fire: 1.0,
};

// Clamp huge delta spikes (tab switch) to avoid tunneling
export const MAX_DT = 0.1; // seconds

// Player render size (square), in pixels
export const PLAYER_SIZE = 10;

// Background clear color when no chunk yet
export const CLEAR_COLOR = "#0a0f1a";