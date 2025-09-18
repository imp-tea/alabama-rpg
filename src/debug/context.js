/**
 * Command Context: passed to each command to interact with the game safely.
 * Provides access to engine objects and helper utilities.
 */
import { TILE_SIZE } from '../config.js';
import { classifyAxes as classifyAxesFn } from '../world/biomes.js';

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

/**
 * Build a context object with utilities for commands.
 * @param {{player:any,camera:any,world:any,noise:any,renderer:any,print:(line:string)=>void}} deps
 */
export function createCommandContext(deps) {
  const { player, camera, world, noise, renderer, print } = deps;

  function toTile(px, py) {
    return { tx: Math.floor(px / TILE_SIZE), ty: Math.floor(py / TILE_SIZE) };
  }

  function toWorld(tx, ty) {
    return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
  }

  function teleportToPx(x, y) {
    player.x = x;
    player.y = y;
    camera.follow(player.x, player.y);
  }

  function getAxesAtTile(tx, ty) {
    if (noise && typeof noise.sampleAxes === 'function') {
      return noise.sampleAxes(tx, ty);
    }
    // Fallback if multi-axis sampler not present
    const elev = clamp01(noise?.elevation?.(tx, ty) ?? 0.5);
    const moist = clamp01(noise?.moisture?.(tx, ty) ?? 0.5);
    return {
      temp: 0.6 * (1 - elev) + 0.4 * moist,
      moist,
      elev,
      rough: Math.abs(elev - 0.5) * 0.8,
      sal: 0.2 * (1 - elev),
      fert: 0.6 * (1 - Math.abs(elev - 0.4)) + 0.2 * moist,
      fire: 0.6 * (1 - moist),
    };
  }

  function getAxesAtPx(px, py) {
    const { tx, ty } = toTile(px, py);
    return getAxesAtTile(tx, ty);
  }

  function classifyAxes(axes) {
    return classifyAxesFn(axes);
  }

  function fmt(n, digits = 3) {
    const f = Math.pow(10, digits);
    return (Math.round(n * f) / f).toFixed(digits);
  }

  return {
    // engine references
    player, camera, world, noise, renderer,
    // io
    print,
    // helpers
    toTile, toWorld, teleportToPx, getAxesAtTile, getAxesAtPx, classifyAxes, fmt,
  };
}