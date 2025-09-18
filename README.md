Tile World Starter (No-build, ES Modules, Canvas)

Overview
- Infinite-feel top-down tile world with procedural biomes and water.
- Plain JavaScript ES modules, no bundler.
- Chunked world with cached offscreen canvases for performance.
- Continuous WASD movement, camera follow.

Run locally
Browsers can restrict ES module imports over file://. Use a simple local server.

- Node.js (PowerShell/CMD):
  - npx http-server -c-1 -p 5173 .
  - Then open http://localhost:5173/

- Python 3:
  - python -m http.server 5173
  - Then open http://localhost:5173/

Open the app
- Entry HTML: [index.html](index.html)
- Main module: [src/main.js](src/main.js)
- Works in modern browsers (Chrome, Edge, Firefox).

Controls
- Move: W A S D (or Arrow keys)
- Camera follows player
- Seed shown in HUD (top-left)

Seeding
- Optional URL parameter ?seed=your-seed
  - Example: http://localhost:5173/?seed=my-world
- If omitted, a random seed is generated and displayed.

Project structure
- App shell: [index.html](index.html)
- Config: [src/config.js](src/config.js)
- Input: [src/input/keyboard.js](src/input/keyboard.js)
- Rendering
  - Camera: [src/render/camera.js](src/render/camera.js)
  - Renderer: [src/render/renderer.js](src/render/renderer.js)
- World
  - Noise: [src/world/noise.js](src/world/noise.js)
  - Biomes: [src/world/biomes.js](src/world/biomes.js)
  - Chunk rasterization: [src/world/chunk.js](src/world/chunk.js)
  - World manager: [src/world/world.js](src/world/world.js)
- Entity: Player [src/entity/player.js](src/entity/player.js)
- Utils: PRNG + hash [src/utils/prng.js](src/utils/prng.js)

Configuration
- Tile size: 16 px
- Chunk size: 64 tiles per side (1024 px per chunk)
- Player speed: 200 px/s
- View margin: 1 chunk beyond viewport
- Noise parameters: [src/config.js](src/config.js)

Implementation notes
- Chunks render once to an offscreen canvas and are cached.
- Noise: lightweight hash-based value noise with fBM for elevation and moisture fields:
  - Elevation and moisture are decorrelated via different seeds/offsets.
- Biome mapping:
  - Water: elevation below sea level
  - Beach near shoreline
  - Inland varies by elevation and moisture (desert, grassland, forest, mountain, snow)

Customization
- Change colors/thresholds in [src/world/biomes.js](src/world/biomes.js)
- Adjust world look in [src/config.js](src/config.js) (NOISE_PARAMS)
- Tweak player speed and tile/chunk sizes in [src/config.js](src/config.js)

Performance tips
- Larger chunks reduce draw calls but increase generation cost. Current: 64x64 tiles.
- Increase VIEW_CHUNK_MARGIN for smoother edge loading at the cost of more memory.
- Future enhancements: LRU cache eviction of far-away chunks, async chunk generation via workers.

Troubleshooting
- Blank page or console error about CORS/mime: ensure you’re serving via http:// (see Run locally).
- Choppy movement after tab switch: dt spike is clamped; it should stabilize within a frame.
- If the canvas doesn’t fill the window, ensure the page isn’t inside an iframe or adjust CSS.

License
- Starter intended for educational and project-bootstrapping purposes; use freely.