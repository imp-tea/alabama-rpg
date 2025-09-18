/**
 * Seed helpers and lightweight hash functions for deterministic procedural gen.
 * World units use CSS pixels and tile coordinates; hashing operates on integer lattice.
 */

// Convert any input (number or string) to a uint32 seed
export function makeSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return toUint32(input);
  }
  if (typeof input === 'string') {
    return seedFromString(input);
  }
  return randomSeed();
}

export function randomSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return toUint32(Math.floor(Math.random() * 0xffffffff));
}

export function seedFromString(str) {
  // xmur3 finalizer
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

export function toUint32(n) {
  return n >>> 0;
}

// Simple fast PRNG for general randomness (not used for hashing lattice)
export function mulberry32(seed) {
  let t = toUint32(seed);
  return function() {
    t = toUint32(t + 0x6D2B79F5);
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 2D integer hash mixed with seed (returns uint32).
 * Deterministic across runs for given (x,y,seed).
 */
export function hash2i(ix, iy, seed) {
  // Mix coordinates and seed through distinct large primes and avalanche
  let h = 2166136261 ^ seed;
  h = Math.imul(h ^ toUint32(ix * 0x27d4eb2d), 16777619);
  h = Math.imul(h ^ toUint32(iy * 0x165667b1), 16777619);

  // Final avalanche (Murmur-inspired)
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;

  return h >>> 0;
}

export function hash2f(ix, iy, seed) {
  return hash2i(ix, iy, seed) / 4294967296; // [0,1)
}