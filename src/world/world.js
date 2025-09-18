import { CHUNK_PIXEL_SIZE, VIEW_CHUNK_MARGIN } from '../config.js';
import { generateChunkCanvas, chunkWorldOriginPx } from './chunk.js';
import { chunkKey } from './chunk.js';

/**
 * World manager: caches chunk canvases and computes visible ranges.
 */
export class World {
  /**
   * @param {{elevation:(x:number,y:number)=>number, moisture:(x:number,y:number)=>number}} noise
   */
  constructor(noise) {
    this.noise = noise;
    /** @type {Map<string, HTMLCanvasElement>} */
    this.chunks = new Map();
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
      canvas = generateChunkCanvas(cx, cy, this.noise);
      this.chunks.set(key, canvas);
    }
    return canvas;
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