// Roda no GitHub Actions: lê a planilha (ID vem de vars.SHEET_ID, nunca do código),
// converte para chamadas e injeta os dados dentro de _site/index.html.
// Assim o ID da planilha não chega em nenhum navegador.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';

const SHEET_ID = process.env.SHEET_ID;
if (!SHEET_ID) { console.error('Falta a variável SHEET_ID'); process.exit(1); }

const normTipo = (t) => {
  t = (t || '').toString().trim().toLowerCase();
  if (t.startsWith('vi') || t.startsWith('ví')) return 'Vídeo';
  if (t.startsWith('vo') || t.startsWith('a') || t.startsWith('á')) return 'Áudio';
  return '';
};
const normDate = (s) => {
  s = (s || '').toString().trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};

const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}/gviz/tq?tqx=out:json&headers=1`;
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) { console.error('HTTP', res.status, 'ao ler a planilha'); process.exit(1); }
const raw = await res.text();
const json = JSON.parse(raw.replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
const t = json.table;

const labels = t.cols.map((c) => (c.label || '').trim().toLowerCase());
const col = (n) => labels.findIndex((h) => h.startsWith(n));
let iD = col('data'), iDur = col('dura'), iT = col('tipo'), iP = col('plata'), iQ = col('quem'), iN = col('nota');
if (iD < 0 && iDur < 0) { iD = 0; iDur = 2; iT = 3; iP = 4; iQ = 5; iN = 6; }

const str = (c) => (!c ? '' : c.f != null ? String(c.f) : c.v == null ? '' : String(c.v));
const dt = (c) => {
  if (c && typeof c.v === 'string') {
    const m = c.v.match(/^Date\((\d+),(\d+),(\d+)/);
    if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  }
  return normDate(str(c));
};

const calls = [];
for (const r of t.rows || []) {
  const c = r.c || [];
  const date = dt(c[iD]);
  const dur = parseFloat(str(c[iDur]).replace(',', '.'));
  if (!date || !dur || dur < 1) continue;
  calls.push({
    date, dur: Math.round(dur), tipo: normTipo(str(c[iT])),
    plat: str(c[iP]).trim(), init: str(c[iQ]).trim(), note: str(c[iN]).trim(),
  });
}
if (!calls.length) { console.error('Nenhuma linha válida na planilha'); process.exit(1); }

const payload = JSON.stringify({ calls, builtAt: new Date().toISOString() });

let html = await readFile('index.html', 'utf8');
if (!html.includes('const BUILT_DATA=null;')) {
  console.error('Placeholder "const BUILT_DATA=null;" não encontrado no index.html');
  process.exit(1);
}
html = html.replace('const BUILT_DATA=null;', `const BUILT_DATA=${payload};`);

await mkdir('_site', { recursive: true });
await writeFile('_site/index.html', html);
await cp('README.md', '_site/README.md').catch(() => {});
console.log(`OK: ${calls.length} chamadas embutidas.`);
