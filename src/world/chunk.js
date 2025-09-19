import { TILE_SIZE, CHUNK_SIZE, CHUNK_PIXEL_SIZE } from '../config.js';
import { colorForAxes, colorFor } from './biomes.js';

/**
 * Stable cache key for chunk coordinates.
 */
export function chunkKey(cx, cy) {
  return `${cx},${cy}`;
}

/**
 * World-space pixel origin for a chunk.
 */
export function chunkWorldOriginPx(cx, cy) {
  return {
    x: cx * CHUNK_PIXEL_SIZE,
    y: cy * CHUNK_PIXEL_SIZE,
  };
}

/**
 * Generate an offscreen canvas for a chunk by rasterizing biome colors per tile.
 * Prefers multi-axis classification when available; falls back to elevation/moisture.
 * @param {number} cx Chunk X index (integer)
 * @param {number} cy Chunk Y index (integer)
 * @param {{elevation?:(x:number,y:number)=>number, moisture?:(x:number,y:number)=>number, sampleAxes?:(x:number,y:number)=>{temp:number,moist:number,elev:number,rough:number,sal:number,fert:number,fire:number}}} noise
 * @returns {HTMLCanvasElement}
 */
export function generateChunkCanvas(cx, cy, noise, viewMode = 'biomes') {
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PIXEL_SIZE;
  canvas.height = CHUNK_PIXEL_SIZE;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  // Local helpers (kept inside to avoid extra exports)
  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const grayHex = (v) => {
    const i = Math.max(0, Math.min(255, Math.round(v * 255)));
    const h = i.toString(16).padStart(2, '0');
    return `#${h}${h}${h}`;
  };
  const fallbackAxes = (elev, moist) => {
    elev = clamp01(elev);
    moist = clamp01(moist);
    return {
      temp: 0.6 * (1 - elev) + 0.4 * moist,
      moist,
      elev,
      rough: Math.abs(elev - 0.5) * 0.8,
      sal: 0.2 * (1 - elev),
      fert: 0.6 * (1 - Math.abs(elev - 0.4)) + 0.2 * moist,
      fire: 0.6 * (1 - moist),
    };
  };

  // Iterate all tiles in the chunk
  for (let ty = 0; ty < CHUNK_SIZE; ty++) {
    for (let tx = 0; tx < CHUNK_SIZE; tx++) {
      const wtx = cx * CHUNK_SIZE + tx; // world tile x
      const wty = cy * CHUNK_SIZE + ty; // world tile y

      // Build full axes vector either via multi-axis sampler or fallback from elev/moist
      let axes;
      if (typeof noise.sampleAxes === 'function') {
        axes = noise.sampleAxes(wtx, wty);
      } else if (typeof noise.elevation === 'function' && typeof noise.moisture === 'function') {
        const e = noise.elevation(wtx, wty);
        const m = noise.moisture(wtx, wty);
        axes = fallbackAxes(e, m);
      } else {
        axes = { temp: 0.5, moist: 0.5, elev: 0.5, rough: 0.5, sal: 0.5, fert: 0.5, fire: 0.5 };
      }

      let color;
      if (viewMode === 'biomes') {
        // Standard biome classification color
        // If we only had elev/moist, colorFor(e,m) matches colorForAxes(fallbackAxes(e,m))
        color = colorForAxes(axes);
      } else {
        // Grayscale by selected axis: temp|moist|elev|rough|sal|fert|fire
        const v = Number(axes?.[viewMode]);
        const vv = Number.isFinite(v) ? clamp01(v) : 0;
        color = grayHex(vv);
      }

      ctx.fillStyle = color || '#888888';
      ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  return canvas;
}