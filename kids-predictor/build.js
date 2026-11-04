#!/usr/bin/env node
/* Build one self-contained HTML file (data.js + model.js inlined).
 * Usage: node build.js <out.html> [overrides.json]
 * overrides.json = your own figures (incomes, mortgage). Keep it out of git. */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const [out, overrides] = process.argv.slice(2);
if (!out) { console.error('Usage: node build.js <out.html> [overrides.json]'); process.exit(1); }

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const inline = f => '<script>\n' + fs.readFileSync(path.join(dir, f), 'utf8') + '\n</script>';
html = html.replace('<script src="data.js"></script>', () => inline('data.js'));
html = html.replace('<script src="model.js"></script>', () => inline('model.js'));
if (overrides) {
  const o = JSON.parse(fs.readFileSync(overrides, 'utf8'));
  html = html.replace('<script>\n(function () {', () => `<script>window.KIDS_OVERRIDES = ${JSON.stringify(o)};</script>\n<script>\n(function () {`);
}
// Strip document wrapper for claude.ai artifact publishing (it adds its own).
if (process.argv.includes('--fragment') || out.endsWith('.artifact.html')) {
  html = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
    .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
    .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
    .replace(/<meta charset[^>]*>\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '');
}
fs.writeFileSync(out, html);
console.log('Wrote', out, (html.length / 1024).toFixed(1) + ' KB');
