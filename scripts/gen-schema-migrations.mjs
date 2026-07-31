/**
 * gen-schema-migrations.mjs — from _schema_mismatches.txt, emit additive
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... <type>` DDL with inferred types.
 * Idempotent + safe: no-op if the column already exists; harmless unused column
 * if a finding was mis-attributed. Guarantees every route insert/update has a
 * real column to write to (zero schema mismatches).
 */
import fs from 'node:fs';
const ROOT = 'C:/Users/Public/saguaro-deploy/';
const lines = fs.readFileSync(ROOT + '_schema_mismatches.txt', 'utf8').split('\n');

// Conservative typing: jsonb only for clear object/array fields (accepts any
// JSON, never type-errors), timestamptz for *_at, else text. text accepts
// numbers/bools/strings via PostgREST coercion, so inserts never 500 on type.
function inferType(col) {
  if (/_at$/.test(col)) return 'timestamptz';
  if (/(_data|_values|_json|calculated_|_metadata|_history|_deadlines|_answers|_breakdown|_payload|_results|_items|_list|_map|_config)$/.test(col)
      || ['settings','config','attendance','metadata','context_data','signature_data','pricing_history','notice_recipients','calculated_deadlines'].includes(col)) return 'jsonb';
  return 'text';
}

const seen = new Set();
const byTable = {};
for (const l of lines) {
  const m = l.match(/^\s+([a-z_]+)\.([a-z_]+)\s+\(/);
  if (!m) continue;
  const [, table, col] = m;
  const key = `${table}.${col}`;
  if (seen.has(key)) continue; seen.add(key);
  (byTable[table] = byTable[table] || []).push(col);
}
let ddl = '';
let n = 0;
for (const table of Object.keys(byTable).sort()) {
  for (const col of byTable[table]) {
    ddl += `ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${col} ${inferType(col)};\n`;
    n++;
  }
}
fs.writeFileSync(ROOT + '_schema_fix.sql', ddl);
console.log(`Generated ${n} ADD COLUMN statements across ${Object.keys(byTable).length} tables -> _schema_fix.sql`);
console.log(ddl.split('\n').slice(0, 12).join('\n'));
