/**
 * Camera tracks a world-space position (center of the viewport).
 * Provides helper to compute the visible world rect for a given canvas size (in CSS pixels).
 */
export class Camera {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  follow(targetX, targetY) {
    this.x = targetX;
    this.y = targetY;
  }

  /**
   * Compute the world-space rectangle visible on screen given the canvas size in CSS pixels.
   * @param {number} viewW
   * @param {number} viewH
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  worldRect(viewW, viewH) {
    return {
      x: this.x - viewW / 2,
      y: this.y - viewH / 2,
      w: viewW,
      h: viewH
    };
  }
}