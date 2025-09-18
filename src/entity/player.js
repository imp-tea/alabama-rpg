import { PLAYER_SPEED } from '../config.js';

/**
 * Simple player entity with continuous movement in world pixel space.
 */
export class Player {
  constructor(x = 0, y = 0, speed = PLAYER_SPEED) {
    this.x = x;
    this.y = y;
    this.speed = speed; // pixels per second
  }

  /**
   * Update position based on input axis and delta time.
   * @param {number} dt seconds
   * @param {{x:number,y:number}} axis raw axis from keyboard (-1..1 on each)
   */
  update(dt, axis = { x: 0, y: 0 }) {
    let dx = axis.x || 0;
    let dy = axis.y || 0;

    // Normalize to avoid faster diagonals
    const mag = Math.hypot(dx, dy);
    if (mag > 0) {
      dx /= mag;
      dy /= mag;

      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;
    }
  }
}