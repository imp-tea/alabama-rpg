/**
 * Command Registry: registers commands, parses/executes lines, and exposes help.
 *
 * Command spec shape:
 * {
 *   name: 'tp',
 *   aliases: ['teleport'],
 *   usage: 'tp <x> <y>',
 *   describe: 'Teleport player to coordinates',
 *   run(args, ctx, api) { ... }
 * }
 *
 * ctx is built by createCommandContext() and provides access to engine objects and helpers.
 */

export function createCommandRegistry() {
  /** @type {Map<string, any>} name/alias -> spec */
  const byName = new Map();
  /** @type {Set<any>} unique primary specs */
  const specs = new Set();

  function register(spec) {
    if (!spec || !spec.name) throw new Error('Invalid command spec');
    specs.add(spec);
    byName.set(spec.name.toLowerCase(), spec);
    if (Array.isArray(spec.aliases)) {
      for (const a of spec.aliases) {
        byName.set(String(a).toLowerCase(), spec);
      }
    }
    return api;
  }

  function find(name) {
    return byName.get(String(name || '').toLowerCase()) || null;
  }

  function list() {
    return Array.from(specs.values());
  }

  function parse(line) {
    const text = String(line || '').trim();
    if (!text) return { cmd: null, args: [] };
    const parts = text.split(/\s+/);
    const name = parts.shift();
    return { cmd: name, args: parts };
  }

  function usage(name) {
    const spec = find(name);
    if (!spec) return `No such command: ${name}`;
    return spec.usage ? spec.usage : spec.name;
  }

  function helpText() {
    const lines = [];
    for (const s of list().sort((a,b) => a.name.localeCompare(b.name))) {
      lines.push(`${s.name}${s.aliases && s.aliases.length ? ` (aliases: ${s.aliases.join(', ')})` : ''}`);
      if (s.describe) lines.push(`  ${s.describe}`);
      if (s.usage) lines.push(`  usage: ${s.usage}`);
    }
    return lines.join('\n');
  }

  function execute(line, ctx) {
    const { cmd, args } = parse(line);
    if (!cmd) return;
    const spec = find(cmd);
    if (!spec) {
      ctx.print?.(`Unknown command: ${cmd}. Type "help" for list.`);
      return;
    }
    try {
      return spec.run(args, ctx, api);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      ctx.print?.(`Error: ${msg}`);
    }
  }

  const api = {
    register,
    find,
    list,
    parse,
    usage,
    helpText,
    execute,
  };

  return api;
}