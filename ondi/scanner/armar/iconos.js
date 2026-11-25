// dibuja el ícono de Ondi en PNG a varios tamaños (para el .exe de Windows y la app de Mac)
const { chromium } = require('playwright'); const fs = require('fs');
const svg = fs.readFileSync(process.argv[2], 'utf8'), out = process.argv[3];
(async () => { const br = await chromium.launch(); const pg = await br.newPage();
  for (const [n, tam, marco] of [['win', 256, 0], ['mac', 1024, 100]]) {
    await pg.setViewportSize({ width: tam, height: tam });
    await pg.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${tam}px;height:${tam}px;display:grid;place-items:center">
      <div style="width:${tam - 2 * marco}px;height:${tam - 2 * marco}px;${marco ? 'filter:drop-shadow(0 ' + tam * .012 + 'px ' + tam * .02 + 'px rgba(0,0,0,.28))' : ''}">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`);
    await pg.screenshot({ path: `${out}/${n}.png`, omitBackground: true }); }
  await br.close(); })();
