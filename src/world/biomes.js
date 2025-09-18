/**
 * Alabama-focused biome classification using 7 environmental axes:
 * temp, moist, elev, rough, sal, fert, fire (each normalized 0..1).
 *
 * Strategy:
 * - Classify each tile by nearest prototype in weighted 7D space.
 * - Prototypes come from an embedded default set (from biomes.csv) and
 *   can be hot-reloaded from ./src/world/biomes.csv at runtime.
 * - Colors: fixed palette per prototype id for clear map differentiation.
 */

import { CLASSIFY_WEIGHTS } from '../config.js';

// ---------------------------- Utilities ----------------------------

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

function weightedDist2(a, b, w) {
  let d = 0;
  d += w.temp  * (a.temp  - b.temp)  * (a.temp  - b.temp);
  d += w.moist * (a.moist - b.moist) * (a.moist - b.moist);
  d += w.elev  * (a.elev  - b.elev)  * (a.elev  - b.elev);
  d += w.rough * (a.rough - b.rough) * (a.rough - b.rough);
  d += w.sal   * (a.sal   - b.sal)   * (a.sal   - b.sal);
  d += w.fert  * (a.fert  - b.fert)  * (a.fert  - b.fert);
  d += w.fire  * (a.fire  - b.fire)  * (a.fire  - b.fire);
  return d;
}

// ---------------------------- Default prototypes (from CSV) ----------------------------

const DEFAULT_COLORS_BY_ID = {
  1:  '#2e6b3f', // Appalachian Highlands Forest - deep green
  2:  '#4e7f9e', // Sandstone Canyon & Falls - cool slate/blue-green
  3:  '#6a7d6f', // Karst Plateau & Caves - muted green-gray
  4:  '#3f6a54', // Ridge-and-Valley Mixed Woods - green
  5:  '#caa247', // Longleaf Pine Savanna - warm golden
  6:  '#4f7f64', // Pine Flatwoods - medium green
  7:  '#9ed46f', // Pitcher-Plant Seepage Bogs - bright spring green
  8:  '#cdbb76', // Black Belt Prairie - khaki
  9:  '#2f5130', // Bottomland Hardwood & Swamp - dark swamp green
  10: '#5aa7c7', // Shoal Rivers & Rocky Riffles - clear blue
  11: '#3b7f6b', // Mobile–Tensaw Delta - teal green
  12: '#8db36a', // Tidal Salt Marsh & Estuary - olive
  13: '#e8d6a0', // Coastal Dune & Beach - pale sand
  14: '#6e8b5e', // Maritime Forest & Scrub - dull green
};

const DEFAULT_ALABAMA_BIOMES = [
  { id: 1,  label: 'Appalachian Highlands Forest',  anchor: 'Talladega/Cheaha uplands',                 temp:0.45, moist:0.55, elev:0.85, rough:0.75, sal:0.00, fert:0.50, fire:0.20 },
  { id: 2,  label: 'Sandstone Canyon & Falls',      anchor: 'Sipsey-style gorges & waterfalls',        temp:0.50, moist:0.70, elev:0.60, rough:0.80, sal:0.00, fert:0.60, fire:0.10 },
  { id: 3,  label: 'Karst Plateau & Caves',         anchor: 'Interior/Cumberland Plateau karst',       temp:0.50, moist:0.55, elev:0.55, rough:0.55, sal:0.00, fert:0.60, fire:0.00 },
  { id: 4,  label: 'Ridge-and-Valley Mixed Woods',  anchor: 'Appalachian ridge/valley belts',          temp:0.50, moist:0.55, elev:0.65, rough:0.70, sal:0.00, fert:0.50, fire:0.10 },
  { id: 5,  label: 'Longleaf Pine Savanna',         anchor: 'Fire-maintained longleaf/wiregrass',      temp:0.70, moist:0.55, elev:0.35, rough:0.30, sal:0.00, fert:0.45, fire:0.90 },
  { id: 6,  label: 'Pine Flatwoods',                anchor: 'Coastal Plain flatwoods',                 temp:0.75, moist:0.60, elev:0.25, rough:0.20, sal:0.00, fert:0.40, fire:0.50 },
  { id: 7,  label: 'Pitcher-Plant Seepage Bogs',    anchor: 'Gulf Coastal Plain seepage bogs',         temp:0.80, moist:0.95, elev:0.20, rough:0.15, sal:0.00, fert:0.10, fire:0.60 },
  { id: 8,  label: 'Black Belt Prairie',            anchor: 'Chalk/limestone prairie arc',             temp:0.65, moist:0.50, elev:0.30, rough:0.25, sal:0.00, fert:0.85, fire:0.20 },
  { id: 9,  label: 'Bottomland Hardwood & Swamp',   anchor: 'Major-river floodplains & sloughs',       temp:0.70, moist:0.90, elev:0.20, rough:0.20, sal:0.00, fert:0.70, fire:0.05 },
  { id: 10, label: 'Shoal Rivers & Rocky Riffles',  anchor: 'Fall-line bedrock shoals',                temp:0.60, moist:0.80, elev:0.35, rough:0.50, sal:0.00, fert:0.60, fire:0.05 },
  { id: 11, label: 'Mobile–Tensaw Delta',           anchor: 'Large deltaic swamp/bayous',              temp:0.85, moist:1.00, elev:0.05, rough:0.15, sal:0.10, fert:0.60, fire:0.05 },
  { id: 12, label: 'Tidal Salt Marsh & Estuary',    anchor: 'Brackish marsh margins',                  temp:0.90, moist:1.00, elev:0.05, rough:0.10, sal:0.60, fert:0.50, fire:0.00 },
  { id: 13, label: 'Coastal Dune & Beach',          anchor: 'Barrier-island dune/beach systems',       temp:0.95, moist:0.60, elev:0.05, rough:0.25, sal:1.00, fert:0.15, fire:0.00 },
  { id: 14, label: 'Maritime Forest & Scrub',       anchor: 'Back-dune oak/pine thickets',             temp:0.90, moist:0.70, elev:0.08, rough:0.20, sal:0.40, fert:0.40, fire:0.00 },
].map(b => ({ ...b, color: DEFAULT_COLORS_BY_ID[b.id] || '#888888' }));

// Active list can be replaced by CSV at runtime.
let ACTIVE_BIOMES = DEFAULT_ALABAMA_BIOMES;

// ---------------------------- CSV loading (optional) ----------------------------

function parseBiomesCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return [];

  const header = lines[0].toLowerCase();
  const startIdx = header.startsWith('id,label,real_world_anchor') ? 1 : 0;

  const out = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(',');
    if (parts.length < 10) continue;

    const id = Number(parts[0]);
    const label = parts[1];
    const anchor = parts[2];

    const temp  = Number(parts[3]);
    const moist = Number(parts[4]);
    const elev  = Number(parts[5]);
    const rough = Number(parts[6]);
    const sal   = Number(parts[7]);
    const fert  = Number(parts[8]);
    const fire  = Number(parts[9]);

    out.push({
      id, label, anchor,
      temp: clamp01(temp),
      moist: clamp01(moist),
      elev: clamp01(elev),
      rough: clamp01(rough),
      sal: clamp01(sal),
      fert: clamp01(fert),
      fire: clamp01(fire),
      color: DEFAULT_COLORS_BY_ID[id] || '#888888',
    });
  }
  return out;
}

/**
 * Try to load ./src/world/biomes.csv at runtime. On success, swaps ACTIVE_BIOMES.
 * Returns the loaded list or the current ACTIVE_BIOMES if fetch fails.
 */
export async function tryLoadBiomesFromCSV(url = './src/world/biomes.csv') {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return ACTIVE_BIOMES;
    const text = await res.text();
    const parsed = parseBiomesCSV(text);
    if (parsed.length) {
      ACTIVE_BIOMES = parsed;
    }
    return ACTIVE_BIOMES;
  } catch {
    return ACTIVE_BIOMES;
  }
}

// ---------------------------- Classification ----------------------------

/**
 * Return the nearest biome prototype to the provided axes.
 * @param {{temp:number,moist:number,elev:number,rough:number,sal:number,fert:number,fire:number}} axes
 * @param {Array} list optional list to search (defaults to ACTIVE_BIOMES)
 * @returns {{id:number,label:string,anchor:string,color:string,dist:number}}
 */
export function classifyAxes(axes, list = ACTIVE_BIOMES, weights = CLASSIFY_WEIGHTS) {
  let best = null;
  let bestD = Infinity;
  for (const b of list) {
    const d = weightedDist2(axes, b, weights);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return { id: best.id, label: best.label, anchor: best.anchor, color: best.color, dist: bestD };
}

export function colorForAxes(axes, list = ACTIVE_BIOMES, weights = CLASSIFY_WEIGHTS) {
  const cls = classifyAxes(axes, list, weights);
  return cls.color;
}

// Backward-compatibility wrappers (for older calls):
export function colorFor(elev, moist) {
  // Construct a plausible axes vector given only elev + moist.
  const axes = {
    temp: 0.6 * (1 - elev) + 0.4 * moist,
    moist,
    elev,
    rough: Math.abs(elev - 0.5) * 0.8, // rougher at extremes as a fallback guess
    sal: 0.2 * (1 - elev),
    fert: 0.6 * (1 - Math.abs(elev - 0.4)) + 0.2 * moist,
    fire: 0.6 * (1 - moist),
  };
  return colorForAxes(axes);
}