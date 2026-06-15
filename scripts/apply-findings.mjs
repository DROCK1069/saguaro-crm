/**
 * apply-findings.mjs — apply the audit's per-context snippet->suggestedFix
 * edits. Systematic findings already handled by flip-light-2 simply won't
 * match (no-op). Bespoke ones (#374151 buttons, accent banners + paired text,
 * step labels, toasts) apply with the agent's contextual fix.
 */
import fs from 'node:fs';

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const files = raw.result.filesWithIssues;
let applied = 0, skipped = 0;
const missing = [];

for (const f of files) {
  let src; try { src = fs.readFileSync(f.file, 'utf8'); } catch { continue; }
  let out = src;
  for (const iss of f.issues) {
    if (!iss.suggestedFix || iss.snippet === iss.suggestedFix) { skipped++; continue; }
    if (out.includes(iss.snippet)) { out = out.split(iss.snippet).join(iss.suggestedFix); applied++; }
    else { skipped++; missing.push(`${f.file.replace(/.*saguaro-deploy\//, '')} :: ${iss.snippet.slice(0, 60).replace(/\n/g, ' ')}`); }
  }
  if (out !== src) fs.writeFileSync(f.file, out);
}
console.log(`Applied ${applied} bespoke findings, skipped/already-fixed ${skipped}.`);
if (missing.length) {
  console.log(`\nUNMATCHED ${missing.length} (already fixed systematically, or needs manual review):`);
  missing.slice(0, 50).forEach(m => console.log('  - ' + m));
}
