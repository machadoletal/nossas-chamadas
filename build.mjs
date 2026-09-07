// Roda no GitHub Actions: lê a planilha (ID vem de vars.SHEET_ID, nunca do código),
// converte para chamadas + o que assistimos, e injeta tudo dentro de _site/index.html.
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
const str = (c) => (!c ? '' : c.f != null ? String(c.f) : c.v == null ? '' : String(c.v));
const dt = (c) => {
  if (c && typeof c.v === 'string') {
    const m = c.v.match(/^Date\((\d+),(\d+),(\d+)/);
    if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  }
  return normDate(str(c));
};

async function fetchTab(sheetName) {
  let url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}/gviz/tq?tqx=out:json&headers=1`;
  if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  const json = JSON.parse(raw.replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
  if (json.status === 'error') throw new Error(json.errors?.[0]?.detailed_message || 'erro gviz');
  return json.table;
}
const idx = (labels, ...names) => {
  for (const n of names) { const i = labels.findIndex((h) => h.startsWith(n)); if (i >= 0) return i; }
  return -1;
};

// --- chamadas (aba principal) ---
const t = await fetchTab();
{
  const labels = t.cols.map((c) => (c.label || '').trim().toLowerCase());
  let iD = idx(labels, 'data'), iDur = idx(labels, 'dura'), iT = idx(labels, 'tipo'),
    iP = idx(labels, 'plata'), iQ = idx(labels, 'quem'), iN = idx(labels, 'nota');
  if (iD < 0 && iDur < 0) { iD = 0; iDur = 2; iT = 3; iP = 4; iQ = 5; iN = 6; }
  var calls = [];
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
}
if (!calls.length) { console.error('Nenhuma linha válida na aba de chamadas'); process.exit(1); }

// --- o que assistimos (aba "Assistimos", opcional) ---
let watched = [];
try {
  const w = await fetchTab('Assistimos');
  const labels = w.cols.map((c) => (c.label || '').trim().toLowerCase());
  const iD = idx(labels, 'data');
  const iS = idx(labels, 'série', 'serie', 'títu', 'titu', 'o qu');
  const iE = idx(labels, 'epis');
  const iT = idx(labels, 'tempo', 'temp', 'season');
  const iDurW = idx(labels, 'dura', 'min');
  // "Série" só existe nesta aba — se não achou, gviz caiu na aba de chamadas
  if (iD < 0 || iS < 0) throw new Error('aba não encontrada ou sem as colunas Data/Série');
  const num = (c) => { const n = parseFloat(str(c).replace(',', '.')); return Number.isFinite(n) ? n : ''; };
  for (const r of w.rows || []) {
    const c = r.c || [];
    const date = dt(c[iD]);
    const serie = str(c[iS]).trim();
    if (!date || !serie) continue;
    watched.push({
      date, serie,
      temp: iT >= 0 ? num(c[iT]) : '',
      ep: iE >= 0 ? (num(c[iE]) !== '' ? num(c[iE]) : str(c[iE]).trim()) : '',
      dur: iDurW >= 0 ? (num(c[iDurW]) || 0) : 0,
    });
  }
  console.log(`Aba "Assistimos": ${watched.length} itens.`);
} catch (e) {
  console.log(`Sem aba "Assistimos" (${e.message}) — seguindo sem isso.`);
}

const payload = JSON.stringify({ calls, watched, builtAt: new Date().toISOString() });

let html = await readFile('index.html', 'utf8');
if (!html.includes('const BUILT_DATA=null;')) {
  console.error('Placeholder "const BUILT_DATA=null;" não encontrado no index.html');
  process.exit(1);
}
html = html.replace('const BUILT_DATA=null;', `const BUILT_DATA=${payload};`);

await mkdir('_site', { recursive: true });
await writeFile('_site/index.html', html);
await cp('README.md', '_site/README.md').catch(() => {});
console.log(`OK: ${calls.length} chamadas, ${watched.length} episódios.`);
