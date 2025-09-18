/**
 * Keyboard input handler for WASD (and arrow keys) with continuous movement.
 * Usage:
 *   import { createKeyboard } from './input/keyboard.js';
 *   const kb = createKeyboard();
 *   const { x, y } = kb.axis(); // raw axis (-1..1)
 *   kb.destroy(); // when tearing down
 */
export function createKeyboard() {
  const tracked = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'
  ]);

  const down = new Set();

  const onKeyDown = (e) => {
    if (tracked.has(e.code)) {
      down.add(e.code);
      e.preventDefault();
    }
  };

  const onKeyUp = (e) => {
    if (tracked.has(e.code)) {
      down.delete(e.code);
      e.preventDefault();
    }
  };

  // Attach listeners
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp, { passive: false });

  function isDown(code) {
    return down.has(code);
  }

  function axis() {
    // Right positive X, Down positive Y (we will invert Y in movement if needed)
    let x = 0;
    let y = 0;

    if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
    if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
    if (down.has('KeyS') || down.has('ArrowDown')) y += 1;

    return { x, y };
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    down.clear();
  }

  return {
    isDown,
    axis,
    destroy
  };
}