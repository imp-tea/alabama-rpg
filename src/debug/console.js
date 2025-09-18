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
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const v = this.input.value;
          this.input.value = '';
          this._emitLine(v);
        } else if (e.key === 'Escape') {
          this.toggle(false);
        }
      });
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