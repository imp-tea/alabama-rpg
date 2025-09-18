import { CLEAR_COLOR, VIEW_CHUNK_MARGIN, PLAYER_SIZE } from '../config.js';

/**
 * Renderer manages canvas sizing, pixel ratio, and drawing world and player.
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    this.viewW = 0; // in CSS pixels
    this.viewH = 0; // in CSS pixels
    this.dpr = 1;
  }

  /**
   * Resize canvas to match CSS pixel size and DPR.
   * @param {number} cssW
   * @param {number} cssH
   * @param {number} dpr
   */
  resize(cssW, cssH, dpr = window.devicePixelRatio || 1) {
    this.viewW = Math.max(1, Math.floor(cssW));
    this.viewH = Math.max(1, Math.floor(cssH));
    this.dpr = Math.max(1, dpr);

    // Backing store size
    this.canvas.width = Math.floor(this.viewW * this.dpr);
    this.canvas.height = Math.floor(this.viewH * this.dpr);

    // Ensure CSS size matches window; caller typically sets style width/height
    // Configure transform so draw coords are in CSS pixels
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Clear the canvas to a base color.
   */
  clear() {
    const { ctx, viewW, viewH } = this;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = CLEAR_COLOR;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.restore();
  }

  /**
   * Render the world and the player.
   * @param {import('../world/world.js').World} world
   * @param {import('./camera.js').Camera} camera
   * @param {{x:number,y:number}} player
   */
  render(world, camera, player) {
    const { ctx, viewW, viewH } = this;

    // Reset transform to CSS pixel space
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Clear
    ctx.fillStyle = CLEAR_COLOR;
    ctx.fillRect(0, 0, viewW, viewH);

    // Camera rect in world pixels (CSS pixel units)
    const rect = camera.worldRect(viewW, viewH);

    // Draw visible chunk canvases
    world.forEachVisibleChunk(rect, VIEW_CHUNK_MARGIN, ({ cx, cy, origin }) => {
      const chunkCanvas = world.getChunkCanvas(cx, cy);
      const sx = Math.floor(origin.x - rect.x);
      const sy = Math.floor(origin.y - rect.y);
      ctx.drawImage(chunkCanvas, sx, sy);
    });

    // Draw player as centered square
    const half = PLAYER_SIZE / 2;
    const px = Math.floor(player.x - rect.x - half);
    const py = Math.floor(player.y - rect.y - half);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px, py, PLAYER_SIZE, PLAYER_SIZE);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(px + 0.5, py + 0.5, PLAYER_SIZE - 1, PLAYER_SIZE - 1);
  }
}