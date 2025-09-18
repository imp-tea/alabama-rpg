/**
 * DebugConsole manages the terminal-style panel UI:
 * - show/hide with toggle()
 * - capture input lines via onLine()
 * - print logs via log()
 *
 * It expects existing DOM nodes with ids:
 *  - #debug-panel
 *  - #debug-input
 *  - #debug-output
 */
export class DebugConsole {
  /**
   * @param {{panel?:HTMLElement,input?:HTMLInputElement,output?:HTMLElement,panelId?:string,inputId?:string,outputId?:string,maxLines?:number}} opts
   */
  constructor(opts = {}) {
    this.panel = opts.panel || document.getElementById(opts.panelId || 'debug-panel');
    this.input = /** @type {HTMLInputElement} */ (opts.input || document.getElementById(opts.inputId || 'debug-input'));
    this.output = opts.output || document.getElementById(opts.outputId || 'debug-output');
    this.maxLines = Number.isFinite(opts.maxLines) ? opts.maxLines : 500;
    this._open = false;
    /** @type {Set<(line:string)=>void>} */
    this._listeners = new Set();

    // Input handlers
    if (this.input) {
      // Submit/close keys
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const v = this.input.value;
          this.input.value = '';
          this._emitLine(v);
        } else if (e.key === 'Escape') {
          this.toggle(false);
        }
      });

      // Guarantee WASD characters type in the console input even if some upstream
      // listener cancels defaults; also isolate them from gameplay/global handlers.
      this.input.addEventListener('keydown', (e) => {
        // Only handle plain key presses (no ctrl/meta/alt)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const code = e.code || '';
        if (/^Key[WASD]$/.test(code)) {
          if (e.defaultPrevented) {
            // Default was canceled upstream; manually insert the character.
            const t = this.input;
            const ch = (typeof e.key === 'string' && e.key.length === 1)
              ? e.key
              : (code === 'KeyW' ? (e.shiftKey ? 'W' : 'w')
              :  code === 'KeyA' ? (e.shiftKey ? 'A' : 'a')
              :  code === 'KeyS' ? (e.shiftKey ? 'S' : 's')
              :                    (e.shiftKey ? 'D' : 'd'));

            const start = t.selectionStart ?? t.value.length;
            const end = t.selectionEnd ?? t.value.length;
            t.value = t.value.slice(0, start) + ch + t.value.slice(end);
            const pos = start + ch.length;
            try { t.setSelectionRange(pos, pos); } catch {}
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          } else {
            // Allow default insertion but keep it from reaching gameplay/global handlers.
            e.stopPropagation();
          }
        }
      }, { capture: true });
    }
  }

  onLine(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _emitLine(line) {
    for (const cb of this._listeners) {
      try { cb(String(line)); } catch { /* ignore */ }
    }
  }

  toggle(force) {
    if (!this.panel) return;
    this._open = typeof force === 'boolean' ? force : !this._open;
    if (this._open) {
      this.panel.classList.add('show');
      if (this.input) {
        this.input.value = '';
        this.input.focus();
      }
      this.log('Opened debug console. Type "help" for commands.');
    } else {
      this.panel.classList.remove('show');
      if (this.input) this.input.blur();
    }
    // Notify listeners (e.g., gameplay input) about open/close state
    try {
      window.dispatchEvent(new CustomEvent('debugconsole:toggle', { detail: { open: this._open } }));
    } catch {}
  }

  isOpen() {
    return !!this._open;
  }

  log(line) {
    if (!this.output) return;
    const div = document.createElement('div');
    div.textContent = String(line);
    this.output.appendChild(div);

    while (this.output.childNodes.length > this.maxLines) {
      this.output.removeChild(this.output.firstChild);
    }
    this.output.scrollTop = this.output.scrollHeight;
  }

  clear() {
    if (this.output) this.output.textContent = '';
  }
}