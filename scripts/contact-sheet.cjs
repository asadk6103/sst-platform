// Dev helper: node scripts/contact-sheet.cjs <dir> <out.png> name1 name2 …
const sharp = require('../node_modules/sharp');
const [dir, out, ...names] = process.argv.slice(2);
(async () => {
  const W = 230, H = 150, cols = 4;
  const c = [];
  for (let i = 0; i < names.length; i++) {
    const x = (i % cols) * W, y = Math.floor(i / cols) * H;
    c.push({ input: await sharp(`${dir}/${names[i]}.jpg`).resize(W, H - 18, { fit: 'contain', background: '#fff' }).toBuffer(), left: x, top: y });
    c.push({ input: Buffer.from(`<svg width="${W}" height="18"><text x="2" y="13" font-size="11" font-family="Arial">${names[i]}</text></svg>`), left: x, top: y + H - 18 });
  }
  await sharp({ create: { width: cols * W, height: Math.ceil(names.length / cols) * H, channels: 3, background: '#eee' } }).composite(c).png().toFile(out);
})();
