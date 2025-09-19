import { MAX_DT, TILE_SIZE } from './config.js';
import { createKeyboard } from './input/keyboard.js';
import { Camera } from './render/camera.js';
import { Renderer } from './render/renderer.js';
import { World } from './world/world.js';
import { makeNoise } from './world/noise.js';
import { Player } from './entity/player.js';
import { makeSeed, randomSeed, toUint32 } from './utils/prng.js';
import { tryLoadBiomesFromCSV, classifyAxes } from './world/biomes.js';

/* Debug modules */
import { DebugConsole } from './debug/console.js';
import { createCommandRegistry } from './debug/registry.js';
import { createCommandContext } from './debug/context.js';
import helpCmd from './debug/commands/help.js';
import tpCmd from './debug/commands/tp.js';
import tileCmd from './debug/commands/tile.js';
import findBiomeCmd from './debug/commands/findbiome.js';
import viewCmd from './debug/commands/view.js';

// DOM refs
const canvas = document.getElementById('game');
const seedOut = document.getElementById('seed-out');
const fpsOut = document.getElementById('fps-out');
const biomeOut = document.getElementById('biome-out');
const posOut = document.getElementById('pos-out');
const tileOut = document.getElementById('tile-out');

// Seed handling via URL ?seed=... (string accepted)
const url = new URL(window.location.href);
const seedParam = url.searchParams.get('seed');
const baseSeed = seedParam ? makeSeed(seedParam) : randomSeed();
const elevSeed = toUint32(baseSeed ^ 0xA5A5A5A5);
const moistSeed = toUint32(baseSeed ^ 0x3C6EF372);

// Display seed (prefer the provided param; else numeric base)
if (seedOut) seedOut.textContent = seedParam ? seedParam : String(baseSeed);

// Noise fields and world
const noise = makeNoise(elevSeed, moistSeed);
const world = new World(noise);

// Player and camera
const player = new Player(0, 0);
const camera = new Camera(player.x, player.y);

// Renderer
const renderer = new Renderer(canvas);

// Input
const kb = createKeyboard();

// Resize handling
function handleResize() {
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  renderer.resize(cssW, cssH, dpr);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

// Animation loop
let last = performance.now();
let fpsEMA = 60;

// HUD update (biome, position, tile)
function updateHUD() {
  // Position and tile coords
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  const txf = player.x / TILE_SIZE;
  const tyf = player.y / TILE_SIZE;
  const tx = Math.floor(txf);
  const ty = Math.floor(tyf);

  if (posOut) posOut.textContent = `${px}, ${py}`;
  if (tileOut) tileOut.textContent = `${tx}, ${ty}`;

  // Biome classification based on integer tile
  if (biomeOut && typeof noise.sampleAxes === 'function') {
    const axes = noise.sampleAxes(tx, ty);
    const cls = classifyAxes(axes);
    biomeOut.textContent = cls.label;
  }
}

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;

  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  if (dt > MAX_DT) dt = MAX_DT;

  // Update
  let axis = kb.axis();

  // When debug console is open, freeze player movement (ignore game input)
  if (debugConsole && typeof debugConsole.isOpen === 'function' && debugConsole.isOpen()) {
    axis = { x: 0, y: 0 };
  }

  player.update(dt, axis);
  camera.follow(player.x, player.y);

  // Render
  renderer.render(world, camera, player);

  // HUD
  updateHUD();

  if (dt > 0) {
    const inst = 1 / dt;
    fpsEMA = fpsEMA * 0.9 + inst * 0.1;
    if (fpsOut) fpsOut.textContent = String(Math.round(fpsEMA));
  }

  requestAnimationFrame(frame);
}

// Avoid dt spike after tab visibility changes
document.addEventListener('visibilitychange', () => {
  last = performance.now();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  kb.destroy();
});

// ---------------- Debug console bootstrap (modular) ----------------
const debugConsole = new DebugConsole();
const registry = createCommandRegistry();

// Clear any latched movement when the debug input gains/loses focus
{
 const debugInputEl = document.getElementById('debug-input');
 if (debugInputEl) {
   const clearKeys = () => { if (kb && typeof kb.clear === 'function') kb.clear(); };
   debugInputEl.addEventListener('focus', clearKeys);
   debugInputEl.addEventListener('blur', clearKeys);
 }
}

// Sync keyboard enable/disable with console visibility (and clear latched keys)
window.addEventListener('debugconsole:toggle', (ev) => {
 const open = !!(ev && ev.detail && ev.detail.open);
 if (typeof kb.setEnabled === 'function') kb.setEnabled(!open);
 if (typeof kb.clear === 'function') kb.clear();
});

// Build command context
const ctx = createCommandContext({
  player, camera, world, noise, renderer,
  print: (line) => debugConsole.log(line),
});

// Register built-in commands
registry
  .register(helpCmd)
  .register(tpCmd)
  .register(tileCmd)
  .register(findBiomeCmd)
  .register(viewCmd);

// Toggle with Backquote
window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') {
    e.preventDefault();
    debugConsole.toggle();
    const isOpen = debugConsole && typeof debugConsole.isOpen === 'function' ? debugConsole.isOpen() : false;
    // Enable/disable game keyboard handler in lockstep with console state
    if (typeof kb.setEnabled === 'function') kb.setEnabled(!isOpen);
    // Clear any latched movement to avoid sticky input regardless of state
    if (typeof kb.clear === 'function') kb.clear();
  }
});

// Execute lines coming from console input
debugConsole.onLine((line) => registry.execute(line, ctx));

// ---------------- Bootstrap ----------------
(async function start() {
  handleResize();
  await tryLoadBiomesFromCSV().then(list => {
    // eslint-disable-next-line no-console
    console.log(`Biomes loaded: ${list.length} prototypes`);
  }).catch(() => {});
  last = performance.now();
  requestAnimationFrame(frame);
})();
// Ensure WASD always type in the debug console input by isolating from gameplay/global handlers.
// If any upstream listener already canceled the event, manually insert the character here.
// This runs in the capture phase so bubbling handlers cannot interfere.
document.addEventListener('keydown', (e) => {
  const active = /** @type {HTMLElement} */ (document.activeElement);
  const isConsoleOpen = (typeof debugConsole?.isOpen === 'function') ? debugConsole.isOpen() : false;
  const isInDebugInput = !!active && active.id === 'debug-input';
  if (!isConsoleOpen || !isInDebugInput) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const code = e.code || '';
  if (!/^Key[WASD]$/.test(code)) return;

  // If default already canceled, manually insert the character into the input.
  const inputEl = /** @type {HTMLInputElement} */ (active);
  if (e.defaultPrevented) {
    const ch = (typeof e.key === 'string' && e.key.length === 1)
      ? e.key
      : (code === 'KeyW' ? (e.shiftKey ? 'W' : 'w')
      :  code === 'KeyA' ? (e.shiftKey ? 'A' : 'a')
      :  code === 'KeyS' ? (e.shiftKey ? 'S' : 's')
      :                    (e.shiftKey ? 'D' : 'd'));
    const start = inputEl.selectionStart ?? inputEl.value.length;
    const end = inputEl.selectionEnd ?? inputEl.value.length;
    inputEl.value = inputEl.value.slice(0, start) + ch + inputEl.value.slice(end);
    const pos = start + ch.length;
    try { inputEl.setSelectionRange(pos, pos); } catch {}
  }

  // Prevent any other listeners from seeing the event (but do NOT preventDefault).
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  else e.stopPropagation();
}, { capture: true });