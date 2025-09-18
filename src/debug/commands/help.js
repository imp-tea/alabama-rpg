/**
 * Help command: prints registry help or specific command usage.
 */
export default {
  name: 'help',
  aliases: ['?'],
  usage: 'help [command]',
  describe: 'Show help for all commands or usage for a specific command.',
  run(args, ctx, api) {
    const target = args[0];
    if (target) {
      ctx.print(api.usage(target));
    } else {
      ctx.print(api.helpText());
    }
  }
};