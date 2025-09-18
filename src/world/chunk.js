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
export function generateChunkCanvas(cx, cy, noise) {
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PIXEL_SIZE;
  canvas.height = CHUNK_PIXEL_SIZE;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  // Iterate all tiles in the chunk
  for (let ty = 0; ty < CHUNK_SIZE; ty++) {
    for (let tx = 0; tx < CHUNK_SIZE; tx++) {
      const wtx = cx * CHUNK_SIZE + tx; // world tile x
      const wty = cy * CHUNK_SIZE + ty; // world tile y

      let color = '#888888';
      if (typeof noise.sampleAxes === 'function') {
        const axes = noise.sampleAxes(wtx, wty);
        color = colorForAxes(axes);
      } else if (typeof noise.elevation === 'function' && typeof noise.moisture === 'function') {
        const e = noise.elevation(wtx, wty);
        const m = noise.moisture(wtx, wty);
        color = colorFor(e, m);
      }

      ctx.fillStyle = color;
      ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  return canvas;
}