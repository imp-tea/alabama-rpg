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

  let enabled = true;
  
  // Treat events as "typing" when coming from form fields or contentEditable.
  // Also check the activeElement for robustness (some browsers may have window as the event target).
  function isTypingTarget(target) {
    const el = /** @type {any} */ (target);
    const active = /** @type {any} */ (document.activeElement);
    const isEditable = (n) => {
      if (!n) return false;
      const tag = (n.tagName || '').toUpperCase?.() || '';
      return tag === 'INPUT' || tag === 'TEXTAREA' || n.isContentEditable === true;
    };
    return isEditable(el) || isEditable(active);
  }
  
  const onKeyDown = (e) => {
    // If globally disabled (e.g., console open), ignore and don't block text input.
    if (!enabled) return;

    // If typing into an input/textarea/contentEditable, do not capture or block defaults.
    if (isTypingTarget(e.target)) {
      return;
    }
    if (tracked.has(e.code)) {
      down.add(e.code);
      e.preventDefault();
    }
  };

  const onKeyUp = (e) => {
    // If globally disabled, ignore and don't block text input.
    if (!enabled) return;

    // While typing, ensure any previously latched movement key is released,
    // but do not prevent default so text input receives the key.
    if (isTypingTarget(e.target)) {
      if (tracked.has(e.code)) {
        down.delete(e.code);
      }
      return;
    }
    if (tracked.has(e.code)) {
      down.delete(e.code);
      e.preventDefault();
    }
  };

  // Listener management (detach completely while console is open to avoid any interference)
  let listening = false;
  function addListeners() {
    if (listening) return;
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp, { passive: false });
    listening = true;
  }
  function removeListeners() {
    if (!listening) return;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    listening = false;
  }
  addListeners();

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
    removeListeners();
    down.clear();
  }

  function clear() {
    down.clear();
  }

  return {
    isDown,
    axis,
    clear,
    setEnabled: (v) => {
      const next = !!v;
      if (next === enabled) return;
      enabled = next;
      if (enabled) addListeners();
      else removeListeners();
    },
    isEnabled: () => enabled,
    destroy
  };
}