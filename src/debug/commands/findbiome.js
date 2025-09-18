import { CHUNK_SIZE, TILE_SIZE } from '../../config.js';

/**
 * findbiome: Efficient nearest-biome search with multi-resolution coarse scan
 *            followed by exact refinement to guarantee nearest result.
 *
 * Usage:
 *   findbiome <id> [--tp] [--max=<tiles>] [--verbose] [--start=tx,ty]
 *
 * Details:
 * - Coarse search uses large strides (e.g., 64, 32, 16, 8, 4, 2) to quickly
 *   discover a candidate and establish an upper bound on the search radius.
 * - Exact refinement then scans all tiles up to that bound at step=1 and
 *   computes Euclidean distance to return the actual nearest tile.
 * - Optional teleport to the found location with --tp.
 * - --max sets the maximum Chebyshev radius in tiles to explore (default 8192).
 * - --start allows overriding the starting tile (defaults to player's tile).
 */

// Cache last found tile per biome id to provide a starting hint (optional)
const LAST_HIT = new Map();

/** @param {number} tx @param {number} ty */
function key(tx, ty) { return `${tx},${ty}`; }

/** Parse CLI args */
function parseArgs(args, ctx) {
  if (args.length === 0) {
    return { error: 'Usage: findbiome <id> [--tp] [--max=<tiles>] [--verbose] [--start=tx,ty]' };
  }
  const id = Number.parseInt(String(args[0]), 10);
  if (!Number.isFinite(id)) {
    return { error: 'findbiome: invalid biome id.' };
  }

  let teleport = false;
  let verbose = false;
  let maxTiles = 8192;
  let start = null;

  for (let i = 1; i < args.length; i++) {
    const a = String(args[i]).trim();
    if (a === '--tp' || a === 'tp' || a === '--teleport') teleport = true;
    else if (a === '--verbose' || a === '-v') verbose = true;
    else if (a.startsWith('--max=')) {
      const v = Number.parseInt(a.slice('--max='.length), 10);
      if (Number.isFinite(v) && v > 0) maxTiles = v;
    } else if (a.startsWith('--start=')) {
      const rest = a.slice('--start='.length);
      const m = rest.match(/^\s*(-?\d+)\s*,\s*(-?\d+)\s*$/);
      if (m) {
        start = { tx: Number.parseInt(m[1], 10), ty: Number.parseInt(m[2], 10) };
      }
    }
  }

  // Default start tile = player's current tile
  if (!start) {
    const { tx, ty } = ctx.toTile(ctx.player.x, ctx.player.y);
    start = { tx, ty };
  }

  return { id, teleport, verbose, maxTiles, start };
}

/** Classify tile - returns biome id */
function classifyIdAt(ctx, tx, ty) {
  const axes = ctx.getAxesAtTile(tx, ty);
  const cls = ctx.classifyAxes(axes);
  return cls.id | 0;
}

/** Enumerate perimeter of a Chebyshev ring r (step-multiplied), calling cb(tx,ty) */
function forEachRing(tx0, ty0, r, step, cb) {
  if (r === 0) {
    cb(tx0, ty0);
    return;
  }
  const s = step;
  const x1 = tx0 - r * s, x2 = tx0 + r * s;
  const y1 = ty0 - r * s, y2 = ty0 + r * s;

  // Top and bottom edges (inclusive)
  for (let x = x1; x <= x2; x += s) {
    cb(x, y1);
    cb(x, y2);
  }
  // Left and right edges (excluding corners to avoid duplicates)
  for (let y = y1 + s; y <= y2 - s; y += s) {
    cb(x1, y);
    cb(x2, y);
  }
}

/** Squared Euclidean distance in tiles from (tx0,ty0) to (tx,ty) */
function dist2Tiles(tx0, ty0, tx, ty) {
  const dx = tx - tx0;
  const dy = ty - ty0;
  return dx * dx + dy * dy;
}

/**
 * Coarse scan with stride=step to find first matching ring-hit.
 * Returns { tx, ty, cheb, checked } or null if not found within maxCheb.
 */
function coarseFirstHit(ctx, tx0, ty0, targetId, step, maxCheb, visited, cache) {
  let checked = 0;

  const limitR = Math.max(0, Math.floor(maxCheb / Math.max(1, step)));

  for (let r = 0; r <= limitR; r++) {
    let found = null;
    forEachRing(tx0, ty0, r, step, (tx, ty) => {
      const k = key(tx, ty);
      if (visited.has(k)) return;
      visited.add(k);

      let id;
      if (cache.has(k)) id = cache.get(k);
      else {
        id = classifyIdAt(ctx, tx, ty);
        cache.set(k, id);
      }
      checked++;
      if (id === targetId && found === null) {
        found = { tx, ty, cheb: Math.max(Math.abs(tx - tx0), Math.abs(ty - ty0)) };
      }
    });
    if (found) {
      found.checked = checked;
      return found;
    }
  }
  return null;
}

/**
 * Exact refinement within Chebyshev radius bound (step=1).
 * Returns nearest by Euclidean distance within ubCheb.
 * { tx, ty, d2, checked, ringsScanned }
 */
function exactNearestWithinBound(ctx, tx0, ty0, targetId, ubCheb, visited, cache) {
  let best = null;
  let checked = 0;

  for (let r = 0; r <= ubCheb; r++) {
    forEachRing(tx0, ty0, r, 1, (tx, ty) => {
      const k = key(tx, ty);
      if (visited.has(k)) return;
      visited.add(k);

      let id;
      if (cache.has(k)) id = cache.get(k);
      else {
        id = classifyIdAt(ctx, tx, ty);
        cache.set(k, id);
      }
      checked++;
      if (id === targetId) {
        const d2 = dist2Tiles(tx0, ty0, tx, ty);
        if (!best || d2 < best.d2) {
          best = { tx, ty, d2 };
        }
      }
    });

    // Early exit: If we already found a candidate with Euclidean distance <= r,
    // then no tile in outer rings can be closer (Euclidean distance grows).
    if (best && Math.sqrt(best.d2) <= r) {
      break;
    }
  }

  if (best) {
    best.checked = checked;
    best.ringsScanned = ubCheb;
  }
  return best;
}

/**
 * Full search: multi-resolution coarse -> exact refinement.
 */
function findNearestBiome(ctx, startTx, startTy, targetId, opts) {
  const visited = new Set();
  const cache = new Map();

  const maxCheb = Math.max(1, opts.maxTiles | 0);

  // Try a hint from last time to tighten bound (optional)
  const hint = LAST_HIT.get(targetId);
  let upperBound = maxCheb;

  if (hint) {
    const hintCheb = Math.max(Math.abs(hint.tx - startTx), Math.abs(hint.ty - startTy));
    if (hintCheb > 0 && hintCheb < upperBound) upperBound = hintCheb;
  }

  // Coarse steps derived from chunk size down to 2
  const base = Math.max(2, CHUNK_SIZE);
  const steps = [];
  let s = base;
  while (s > 1) { steps.push(s); s = Math.max(1, Math.floor(s / 2)); if (s === 1) break; }
  // Ensure a few smaller strides too
  for (const extra of [16, 8, 4, 2]) {
    if (!steps.includes(extra) && extra <= base) steps.push(extra);
  }
  // Sort descending unique > 1
  steps.sort((a, b) => b - a);
  const stepStats = [];

  let coarseHit = null;
  for (const step of steps) {
    const t0 = performance.now?.() ?? 0;
    const hit = coarseFirstHit(ctx, startTx, startTy, targetId, step, upperBound, visited, cache);
    const t1 = performance.now?.() ?? 0;
    stepStats.push({ step, checked: hit ? hit.checked : 0, ms: (t1 - t0) });

    if (hit) {
      coarseHit = hit;
      upperBound = Math.min(upperBound, hit.cheb);
      break;
    }
  }

  // If no coarse hit, attempt a limited exact search up to maxCheb (may be heavy)
  if (!coarseHit) {
    const exact = exactNearestWithinBound(ctx, startTx, startTy, targetId, upperBound, visited, cache);
    if (exact) {
      LAST_HIT.set(targetId, { tx: exact.tx, ty: exact.ty });
      return {
        tx: exact.tx, ty: exact.ty,
        tiles: Math.sqrt(exact.d2),
        checked: visited.size,
        stepStats,
        bounded: upperBound,
        exact: true,
      };
    }
    return null;
  }

  // Exact refinement within coarse bound
  const exact = exactNearestWithinBound(ctx, startTx, startTy, targetId, upperBound, visited, cache);
  if (!exact) {
    // Unlikely, but if refinement fails, fall back to the coarse hit tile.
    LAST_HIT.set(targetId, { tx: coarseHit.tx, ty: coarseHit.ty });
    const d2 = dist2Tiles(startTx, startTy, coarseHit.tx, coarseHit.ty);
    return {
      tx: coarseHit.tx, ty: coarseHit.ty,
      tiles: Math.sqrt(d2),
      checked: visited.size,
      stepStats,
      bounded: upperBound,
      exact: false,
    };
  }

  LAST_HIT.set(targetId, { tx: exact.tx, ty: exact.ty });
  return {
    tx: exact.tx, ty: exact.ty,
    tiles: Math.sqrt(exact.d2),
    checked: visited.size,
    stepStats,
    bounded: upperBound,
    exact: true,
  };
}

export default {
  name: 'findbiome',
  aliases: ['fb', 'findbio'],
  usage: 'findbiome <id> [--tp] [--max=<tiles>] [--verbose] [--start=tx,ty]',
  describe: 'Search for the nearest tile classified with the given biome id. Multi-resolution search with exact refinement.',
  run(args, ctx) {
    const parsed = parseArgs(args, ctx);
    if (parsed.error) {
      ctx.print(parsed.error);
      return;
    }
    const { id, teleport, verbose, maxTiles, start } = parsed;

    const tStart = performance.now?.() ?? 0;
    const res = findNearestBiome(ctx, start.tx, start.ty, id, { maxTiles });
    const tEnd = performance.now?.() ?? 0;

    if (!res) {
      ctx.print(`findbiome: biome id=${id} not found within radius ${maxTiles} tiles.`);
      return;
    }

    const px = res.tx * TILE_SIZE;
    const py = res.ty * TILE_SIZE;

    if (teleport) {
      ctx.teleportToPx(px, py);
    }

    const distTiles = res.tiles;
    const distPx = Math.round(distTiles * TILE_SIZE);
    const timeMs = Math.max(0, tEnd - tStart).toFixed(2);

    ctx.print(
      `Found biome id=${id} at tile=(${res.tx}, ${res.ty})  ~${distTiles.toFixed(2)} tiles (${distPx}px) from start.\n` +
      `Searched ${res.checked} samples in ${timeMs} ms. Bound=${res.bounded} exact=${res.exact ? 'yes' : 'no'}` +
      (teleport ? `\nTeleported to (${px}, ${py})` : '')
    );

    if (verbose && Array.isArray(res.stepStats)) {
      for (const st of res.stepStats) {
        if (!st) continue;
        ctx.print(`  step=${st.step} checked=${st.checked ?? 0} ms=${(st.ms ?? 0).toFixed(2)}`);
      }
    }
  }
};