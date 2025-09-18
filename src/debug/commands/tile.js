export default {
  name: 'tile',
  aliases: ['where'],
  usage: 'tile',
  describe: 'Print current position (px), tile (tx,ty), axes, and biome classification.',
  run(args, ctx) {
    const px = ctx.player.x;
    const py = ctx.player.y;
    const { tx, ty } = ctx.toTile(px, py);

    const axes = ctx.getAxesAtTile(tx, ty);
    const cls = ctx.classifyAxes(axes);

    const f = (n) => ctx.fmt(n, 3);

    ctx.print(
`Tile:
  px=(${Math.round(px)}, ${Math.round(py)})  tile=(${tx}, ${ty})
  axes: temp=${f(axes.temp)}  moist=${f(axes.moist)}  elev=${f(axes.elev)}
        rough=${f(axes.rough)}  sal=${f(axes.sal)}  fert=${f(axes.fert)}  fire=${f(axes.fire)}
  biome: ${cls.label} (id=${cls.id})`
    );
  }
};