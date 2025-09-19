/**
 * View command: switch rendering to a specific layer (biomes or a single axis).
 * Examples:
 *  - view biomes
 *  - view temp | moist | elev | rough | sal | fert | fire
 * Without args: prints current mode and available options.
 */
import { VIEW_MODES } from '../../world/world.js';

const USAGE = 'view [biomes|temp|moist|elev|rough|sal|fert|fire]';

const ALIAS_MAP = new Map([
  ['biome', 'biomes'],
  ['bio', 'biomes'],
  ['temperature', 'temp'],
  ['t', 'temp'],
  ['moisture', 'moist'],
  ['m', 'moist'],
  ['elevation', 'elev'],
  ['height', 'elev'],
  ['h', 'elev'],
  ['roughness', 'rough'],
  ['r', 'rough'],
  ['salinity', 'sal'],
  ['salt', 'sal'],
  ['sa', 'sal'],
  ['fertility', 'fert'],
  ['f', 'fert'],
  ['fi', 'fire'],
  ['burn', 'fire'],
]);

function canonicalize(input) {
  if (!input) return null;
  const raw = String(input).toLowerCase();
  const mapped = ALIAS_MAP.get(raw) || raw;
  // Accept singular/plural typo for 'biomes'
  const norm = mapped === 'biome' ? 'biomes' : mapped;
  return VIEW_MODES.has(norm) ? norm : null;
}

function listModes() {
  return Array.from(VIEW_MODES).join(', ');
}

export default {
  name: 'view',
  aliases: ['viewmode', 'layer'],
  usage: USAGE,
  describe: 'Change the world rendering between biome colors or a single parameter in grayscale.',
  run(args, ctx) {
    const want = args && args[0] ? canonicalize(args[0]) : null;
    if (!want) {
      const current = typeof ctx.world?.getViewMode === 'function' ? ctx.world.getViewMode() : 'biomes';
      ctx.print(`view: current mode = ${current}\nusage: ${USAGE}\navailable: ${listModes()}`);
      return;
    }
    if (typeof ctx.world?.setViewMode === 'function') {
      ctx.world.setViewMode(want);
      ctx.print(`view: set mode to ${want}`);
    } else {
      ctx.print('view: world does not support view modes in this build.');
    }
  }
};