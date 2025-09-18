import { TILE_SIZE } from '../../config.js';

function parseCoord(val) {
  // Accept px numbers or numbers with 't' suffix for tiles, e.g., 128t
  const m = String(val).trim().match(/^(-?\d+(?:\.\d+)?)(t)?$/i);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (!isFinite(num)) return null;
  return m[2] ? num * TILE_SIZE : num;
}

export default {
  name: 'tp',
  aliases: ['teleport'],
  usage: 'tp <x> <y>    (append "t" to use tiles, e.g., 128t 64t)',
  describe: 'Teleport player to world coordinates (px by default; suffix t for tiles).',
  run(args, ctx) {
    if (args.length < 2) {
      ctx.print('Usage: tp <x> <y>   (append "t" to use tiles, e.g., 128t 64t)');
      return;
    }
    const x = parseCoord(args[0]);
    const y = parseCoord(args[1]);
    if (x === null || y === null) {
      ctx.print('tp: invalid coordinates.');
      return;
    }
    ctx.teleportToPx(x, y);
    const { tx, ty } = ctx.toTile(x, y);
    ctx.print(`Teleported to px=(${Math.round(x)}, ${Math.round(y)}) tile=(${tx}, ${ty})`);
  }
};