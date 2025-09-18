/**
 * Multi-axis environmental noise for Alabama-inspired biomes.
 * Axes: temp, moist, elev, rough, sal, fert, fire (0..1 each).
 *
 * Implementation:
 * - Base fBM value-noise per axis with per-axis seeds.
 * - Large-scale north-south gradients (temperature/salinity) with elevation coupling.
 * - Roughness from local elevation slope + detail noise.
 * - Fertility from moisture and mid-elevation preference + noise.
 * - Fire frequency from dryness, temperature, low elevation preference + noise.
 */

import { NOISE_PARAMS, GRADIENTS } from '../config.js';
import { toUint32 } from '../utils/prng.js';
import { hash2f } from '../utils/prng.js';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

function valueNoise2D(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const v00 = hash2f(ix, iy, seed);
  const v10 = hash2f(ix + 1, iy, seed);
  const v01 = hash2f(ix, iy + 1, seed);
  const v11 = hash2f(ix + 1, iy + 1, seed);

  const u = fade(fx);
  const v = fade(fy);

  const x0 = lerp(v00, v10, u);
  const x1 = lerp(v01, v11, u);
  return lerp(x0, x1, v);
}

export function fbm2(x, y, seed, params = {}) {
  const octaves = params.octaves ?? 4;
  const frequency = params.frequency ?? 0.01;
  const lacunarity = params.lacunarity ?? 2.0;
  const gain = params.gain ?? 0.5;

  let amp = 1.0;
  let sum = 0.0;
  let ampSum = 0.0;

  let nx = x * frequency;
  let ny = y * frequency;

  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2D(nx, ny, seed);
    sum += n * amp;
    ampSum += amp;

    nx *= lacunarity;
    ny *= lacunarity;
    amp *= gain;
  }

  return ampSum > 0 ? (sum / ampSum) : 0.0;
}

const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;

function mixSeed(a, k) {
  // Simple avalanche mix to derive distinct axis seeds from base seeds
  let h = toUint32(a ^ toUint32(k * 0x9E3779B1));
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Create a multi-axis noise sampler.
 * @param {number} elevSeed - base seed primarily for elevation field
 * @param {number} moistSeed - base seed primarily for moisture field
 * @param {*} params - NOISE_PARAMS override
 * @param {*} gradients - GRADIENTS override
 */
export function makeNoise(elevSeed, moistSeed, params = NOISE_PARAMS, gradients = GRADIENTS) {
  const elevParams = params?.elevation ?? NOISE_PARAMS.elevation;
  const moistParams = params?.moisture ?? NOISE_PARAMS.moisture;

  // Derive seeds for other axes
  const tempSeed  = mixSeed(elevSeed ^ moistSeed, 0xA1);
  const roughSeed = mixSeed(elevSeed, 0xB2);
  const salSeed   = mixSeed(moistSeed, 0xC3);
  const fertSeed  = mixSeed(elevSeed ^ (moistSeed << 1), 0xD4);
  const fireSeed  = mixSeed(moistSeed ^ (elevSeed << 1), 0xE5);

  const tempParams   = params?.temperature ?? NOISE_PARAMS.temperature;
  const roughParams  = params?.roughness ?? NOISE_PARAMS.roughness;
  const salParams    = params?.salinity ?? NOISE_PARAMS.salinity;
  const fertParams   = params?.fertility ?? NOISE_PARAMS.fertility;
  const fireParams   = params?.fire ?? NOISE_PARAMS.fire;

  const {
    TEMP_LAT_GRAD_TILES,
    SAL_LAT_GRAD_TILES,
    TEMP_ELEV_COOLING,
    SAL_ELEV_REDUCTION,
    ROUGH_SLOPE_SCALE
  } = gradients ?? GRADIENTS;

  function elevation(tx, ty) {
    return fbm2(tx, ty, elevSeed, elevParams);
  }

  function moisture(tx, ty) {
    // Slight decorrelation offset
    return fbm2(tx + 157.31, ty - 89.97, moistSeed, moistParams);
  }

  function latSouth(y, scale) {
    // 0 (far north) -> 1 (far south), compressed with tanh for asymptote
    return 0.5 * (1 + Math.tanh((y) / (scale || 4096)));
  }

  function sampleAxes(tx, ty) {
    // Base elevation and moisture
    const elev = clamp01(elevation(tx, ty));
    const moist = clamp01(moisture(tx, ty));

    const latT = latSouth(ty, TEMP_LAT_GRAD_TILES);
    const latS = latSouth(ty, SAL_LAT_GRAD_TILES);

    // Temperature: base noise + southern warmth - elevation cooling
    const tNoise = fbm2(tx, ty, tempSeed, tempParams);
    const temp = clamp01(0.55 * tNoise + 0.35 * latT - TEMP_ELEV_COOLING * elev + 0.10);

    // Roughness: from elevation slope + detail noise
    const e0 = fbm2(tx, ty, elevSeed, elevParams);
    const ex = fbm2(tx + 1, ty, elevSeed, elevParams) - e0;
    const ey = fbm2(tx, ty + 1, elevSeed, elevParams) - e0;
    const slope = Math.hypot(ex, ey); // ~0..1-ish
    const rNoise = fbm2(tx, ty, roughSeed, roughParams);
    const rough = clamp01(Math.min(1, slope * ROUGH_SLOPE_SCALE) * 0.7 + rNoise * 0.3);

    // Salinity: base noise + southern salinity - reduced by elevation
    const sNoise = fbm2(tx - 233.7, ty + 411.9, salSeed, salParams);
    const sal = clamp01(0.5 * sNoise + 0.4 * latS - (SAL_ELEV_REDUCTION * elev * 0.5));

    // Fertility: favors moist, mid-low elevation + texture noise
    const fNoise = fbm2(tx + 991.1, ty - 72.3, fertSeed, fertParams);
    const elevBand = 1 - Math.abs(elev - 0.35) * 2; // peak near ~0.35
    const fertBase = 0.6 * moist + 0.3 * elevBand;
    const fert = clamp01(0.75 * fertBase + 0.25 * fNoise);

    // Fire frequency: higher in dry, warm, low-elevation regions + noise
    const fireN = fbm2(tx - 55.2, ty + 23.7, fireSeed, fireParams);
    const dryness = (1 - moist);
    const fire = clamp01(0.6 * dryness + 0.2 * temp + 0.15 * (1 - elev) + 0.05 * fireN);

    return { temp, moist, elev, rough, sal, fert, fire };
  }

  return {
    elevation,
    moisture,
    sampleAxes
  };
}