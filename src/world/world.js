import { CHUNK_PIXEL_SIZE, VIEW_CHUNK_MARGIN } from '../config.js';
import { generateChunkCanvas, chunkWorldOriginPx } from './chunk.js';
import { chunkKey } from './chunk.js';

/**
 * Available render view modes for chunks.
 * - 'biomes' uses biome classification colors
 * - Others render a single axis in grayscale: 0 (black) .. 1 (white)
 */
export const VIEW_MODES = new Set(['biomes', 'temp', 'moist', 'elev', 'rough', 'sal', 'fert', 'fire']);

/**
 * World manager: caches chunk canvases and computes visible ranges.
 */
export class World {
  /**
   * @param {{elevation?:(x:number,y:number)=>number, moisture?:(x:number,y:number)=>number, sampleAxes?:(x:number,y:number)=>{temp:number,moist:number,elev:number,rough:number,sal:number,fert:number,fire:number}}} noise
   */
  constructor(noise) {
    this.noise = noise;
    /** @type {Map<string, HTMLCanvasElement>} */
    this.chunks = new Map();
    /** @type {'biomes'|'temp'|'moist'|'elev'|'rough'|'sal'|'fert'|'fire'} */
    this.viewMode = 'biomes';
  }

  /**
   * Get (or generate and cache) a chunk canvas.
   * @param {number} cx
   * @param {number} cy
   * @returns {HTMLCanvasElement}
   */
  getChunkCanvas(cx, cy) {
    const key = chunkKey(cx, cy);
    let canvas = this.chunks.get(key);
    if (!canvas) {
      canvas = generateChunkCanvas(cx, cy, this.noise, this.viewMode);
      this.chunks.set(key, canvas);
    }
    return canvas;
  }

  /**
   * Clear all cached chunk canvases (forces regeneration on next render).
   */
  clearChunks() {
    this.chunks.clear();
  }

  /**
   * Set the current rendering view mode ('biomes' or a single axis).
   * Clears cached chunks when changed to force regeneration.
   * @param {'biomes'|'temp'|'moist'|'elev'|'rough'|'sal'|'fert'|'fire'} mode
   */
  setViewMode(mode) {
    const m = String(mode || '').toLowerCase();
    if (!VIEW_MODES.has(m)) {
      throw new Error(`Invalid view mode: ${mode}. Valid: ${Array.from(VIEW_MODES).join(', ')}`);
    }
    if (m !== this.viewMode) {
      this.viewMode = m;
      this.clearChunks();
    }
  }

  /**
   * Get the current rendering view mode.
   */
  getViewMode() {
    return this.viewMode;
  }

  /**
   * Compute visible chunk bounds from a world-space pixel rect.
   * @param {{x:number,y:number,w:number,h:number}} rectPx
   * @param {number} marginChunks
   */
  getVisibleChunkRange(rectPx, marginChunks = VIEW_CHUNK_MARGIN) {
    const minCx = Math.floor(rectPx.x / CHUNK_PIXEL_SIZE) - marginChunks;
    const minCy = Math.floor(rectPx.y / CHUNK_PIXEL_SIZE) - marginChunks;

    // Use (x + w - 1) so exact edges land in the correct inclusive chunk
    const maxCx = Math.floor((rectPx.x + rectPx.w - 1) / CHUNK_PIXEL_SIZE) + marginChunks;
    const maxCy = Math.floor((rectPx.y + rectPx.h - 1) / CHUNK_PIXEL_SIZE) + marginChunks;

    return { minCx, minCy, maxCx, maxCy };
  }

  /**
   * Iterate visible chunk coordinates and provide draw info.
   * @param {{x:number,y:number,w:number,h:number}} rectPx
   * @param {number} marginChunks
   * @param {(info:{cx:number,cy:number,origin:{x:number,y:number}})=>void} fn
   */
  forEachVisibleChunk(rectPx, marginChunks, fn) {
    const { minCx, minCy, maxCx, maxCy } = this.getVisibleChunkRange(rectPx, marginChunks);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        fn({ cx, cy, origin: chunkWorldOriginPx(cx, cy) });
      }
    }
  }

  /**
   * Optional future: prune far-away chunks.
   * Not implemented in this starter to keep behavior simple.
   */
  prune() {}
}