/**
 * schema-check.mjs — deterministic API↔DB column audit.
 * Parses _schema.txt (public schema) into table->columns, then scans every
 * write route for `.from('table')...insert/update/upsert({ literalKeys })` and
 * flags literal top-level keys not present on that table. Conservative: only
 * flags clear literal-key object writes (skips spreads/dynamic).
 */
import fs from 'node:fs';

const ROOT = 'C:/Users/Public/saguaro-deploy/';
// --- parse schema ---
const schemaRaw = fs.readFileSync(ROOT + '_schema.txt', 'utf8');
const tableCols = {};
for (const m of schemaRaw.matchAll(/\{\\?"table_name\\?":\\?"([a-z_]+)\\?",\\?"columns\\?":\\?"([^"]*?)\\?"\}/g)) {
  tableCols[m[1]] = m[2].split(',').map(s => s.trim().replace(/\\/g, '')).filter(Boolean);
}
// fallback parse if escaping differs
if (Object.keys(tableCols).length < 50) {
  for (const m of schemaRaw.matchAll(/"table_name":"([a-z_]+)","columns":"([^"]*)"/g)) {
    tableCols[m[1]] = m[2].split(',').map(s => s.trim()).filter(Boolean);
  }
}
console.log(`Parsed ${Object.keys(tableCols).length} tables from schema.`);

const routes = fs.readFileSync(ROOT.replace(/\/$/, '') + '/_write_routes.json', 'utf8');
const files = JSON.parse(routes);

const findings = [];
for (const f of files) {
  let src; try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
  // find every `.from('table')` ... up to the next `.insert(` / `.update(` / `.upsert(` and capture the object literal
  // write must DIRECTLY follow .from('table') (only whitespace between) — avoids
  // pairing a read .from('a').select() with an unrelated later .from('b').insert()
  const re = /\.from\(\s*['"`]([a-z_]+)['"`]\s*\)\s*\.(insert|update|upsert)\(\s*(\{[\s\S]*?\n\s*\})/g;
  let mm;
  while ((mm = re.exec(src))) {
    const table = mm[1], op = mm[2], objText = mm[3];
    const cols = tableCols[table];
    if (!cols) continue; // table not in schema (already covered) or a storage bucket
    // extract literal top-level keys:  key:  (identifier or 'quoted')
    const keys = [];
    for (const km of objText.matchAll(/(?:^|[,{]\s*)(?:([a-zA-Z_][a-zA-Z0-9_]*)|['"]([a-z_]+)['"])\s*:/g)) {
      const k = km[1] || km[2];
      if (k && !['data', 'error', 'select', 'from', 'eq', 'in'].includes(k)) keys.push(k);
    }
    for (const k of keys) {
      // snake_case columns only; skip camelCase (those are JS object spreads/vars, not column names)
      if (!/^[a-z][a-z0-9_]*$/.test(k)) continue;
      if (k.includes('_') || cols.includes(k)) {
        if (!cols.includes(k)) {
          findings.push({ file: f.replace(ROOT, ''), table, op, column: k });
        }
      }
    }
  }
}
// dedupe
const seen = new Set(), uniq = [];
for (const x of findings) { const k = `${x.file}|${x.table}|${x.column}`; if (!seen.has(k)) { seen.add(k); uniq.push(x); } }
console.log(`\n=== ${uniq.length} potential column mismatches (literal key not on table) ===`);
for (const x of uniq) console.log(`  ${x.table}.${x.column}  (${x.op})  ${x.file}`);
