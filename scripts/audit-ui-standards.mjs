#!/usr/bin/env node
/**
 * audit-ui-standards.mjs — Saguaro UI standards audit.
 *
 * Recursively scans app/ and components/ for violations of the house UI
 * standards and reports them with file:line. Supports a grandfather
 * baseline (scripts/audit-baseline.json) so existing debt doesn't block
 * ships while any NEW violation fails the build (exit 1).
 *
 * Usage:
 *   node scripts/audit-ui-standards.mjs                  # audit against baseline
 *   node scripts/audit-ui-standards.mjs --write-baseline # snapshot current state as the baseline
 *
 * No dependencies. Node >= 18, ESM.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'audit-baseline.json');
const WRITE_BASELINE = process.argv.includes('--write-baseline');

const SCAN_DIRS = ['app', 'components'];
const SKIP_DIR_NAMES = new Set(['node_modules', '.next', '.git', 'dist', 'build', '_predrift_backup']);
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

// Canonical trade names — the taxonomy lives in lib/construction-intelligence.ts.
const CANONICAL_TRADES = [
  'Electrical', 'Plumbing', 'HVAC', 'Framing', 'Drywall',
  'Roofing', 'Concrete', 'Flooring', 'Painting',
];
const TAXONOMY_HOME = 'lib/construction-intelligence.ts';

// ---------------------------------------------------------------------------
// Rule definitions
// ---------------------------------------------------------------------------
// severity: 'FAIL' rules exit 1 on new violations; 'WARN' rules never fail.

const RULES = {
  'date-raw': {
    severity: 'FAIL',
    desc: 'Raw HTML date input — every date field must use SaguaroDatePicker',
    skipApi: true,
  },
  'trade-hardcode': {
    severity: 'FAIL',
    desc: `Hardcoded trade-name array — import the taxonomy from ${TAXONOMY_HOME}`,
    skipApi: false,
  },
  'black-alpha-dark': {
    severity: 'FAIL',
    desc: 'rgba(0,0,0,…) on a dark-shell surface — dark surfaces take white/gold alphas',
    skipApi: true,
  },
  'taxonomy-slice': {
    severity: 'FAIL',
    desc: 'Truncating the canonical taxonomy with .slice() — never truncate it',
    skipApi: false,
  },
  'money-concat': {
    severity: 'WARN',
    desc: 'Possible string-concat on a money field — wrap with Number(x)||0',
    skipApi: false,
  },
};

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIR_NAMES.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && CODE_EXTS.has(path.extname(e.name))) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function relKey(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join('/');
}

function lineOfIndex(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function isApiRoute(rel) {
  return /(^|\/)api\//.test(rel);
}

// ---------------------------------------------------------------------------
// Per-rule scanners — each returns [{ line, snippet }]
// ---------------------------------------------------------------------------

function scanDateRaw(rel, content) {
  if (!rel.endsWith('.tsx')) return [];
  const hits = [];
  const re = /type=["']date["']|type=["']month["']|type=["']datetime-local["']/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    hits.push({ line: lineOfIndex(content, m.index), snippet: m[0] });
  }
  return hits;
}

function scanTradeHardcode(rel, content) {
  if (rel === TAXONOMY_HOME) return [];
  const hits = [];
  // Innermost bracketed regions (string arrays don't nest). Cap the span so a
  // runaway bracket can't swallow the file.
  const arrRe = /\[[^\[\]]{0,4000}\]/gs;
  let m;
  while ((m = arrRe.exec(content)) !== null) {
    const body = m[0];
    let distinct = 0;
    for (const trade of CANONICAL_TRADES) {
      if (new RegExp(`['"\`]${trade}['"\`]`).test(body)) distinct++;
    }
    if (distinct >= 2) {
      hits.push({
        line: lineOfIndex(content, m.index),
        snippet: body.replace(/\s+/g, ' ').slice(0, 80),
      });
    }
  }
  return hits;
}

function scanBlackAlphaDark(rel, content) {
  // Only the dark shell: app/app/**
  if (!/^app\/app(\/|$)/.test(rel)) return [];
  const hits = [];
  const lines = content.split('\n');
  const CONTEXT_RE = /boxShadow|box-shadow|background|Background|hover|shadow|Shadow/;
  const re = /rgba\(0,\s*0,\s*0/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const line = lineOfIndex(content, m.index);
    // Match must sit in a boxShadow/background/hover style: check the line
    // itself, then a few lines above (property name may precede the value).
    let inStyle = false;
    for (let l = line; l >= Math.max(1, line - 3); l--) {
      if (CONTEXT_RE.test(lines[l - 1] ?? '')) { inStyle = true; break; }
    }
    if (inStyle) {
      hits.push({ line, snippet: (lines[line - 1] ?? '').trim().slice(0, 80) });
    }
  }
  return hits;
}

function scanTaxonomySlice(rel, content) {
  const hits = [];
  const re = /SUB_TRADES\.slice\(|SHEET_DISCIPLINES\.slice\(|CSI_DIVISIONS\)\.slice\(/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    hits.push({ line: lineOfIndex(content, m.index), snippet: m[0] });
  }
  return hits;
}

function scanMoneyConcat(rel, content) {
  const hits = [];
  const re = /\+\s*(\w*\.(cost_impact|original_amount|contract_amount|current_payment_due))\b(?!\s*\))/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    hits.push({ line: lineOfIndex(content, m.index), snippet: m[0].trim().slice(0, 80) });
  }
  return hits;
}

const SCANNERS = {
  'date-raw': scanDateRaw,
  'trade-hardcode': scanTradeHardcode,
  'black-alpha-dark': scanBlackAlphaDark,
  'taxonomy-slice': scanTaxonomySlice,
  'money-concat': scanMoneyConcat,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function loadBaseline() {
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    if (Array.isArray(raw)) return new Set(raw);
  } catch {
    /* no baseline yet — everything is new */
  }
  return new Set();
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const baseline = loadBaseline();

  // violations: { rule, rel, line, snippet, key, grandfathered }
  const violations = [];

  for (const abs of files) {
    const rel = relKey(abs);
    let content;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    for (const [rule, meta] of Object.entries(RULES)) {
      if (meta.skipApi && isApiRoute(rel)) continue;
      const hits = SCANNERS[rule](rel, content);
      for (const hit of hits) {
        const key = `${rel}:${rule}`;
        violations.push({ rule, rel, line: hit.line, snippet: hit.snippet, key });
      }
    }
  }

  if (WRITE_BASELINE) {
    const keys = [...new Set(violations.map((v) => v.key))].sort();
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(keys, null, 2) + '\n', 'utf8');
    console.log(`Baseline written: ${relKey(BASELINE_PATH)} (${keys.length} grandfathered file:rule entries covering ${violations.length} hits)`);
    process.exit(0);
  }

  // Classify against baseline
  let failCount = 0;
  const summary = {};
  for (const rule of Object.keys(RULES)) summary[rule] = { newCount: 0, grandfathered: 0 };

  for (const v of violations) {
    v.grandfathered = baseline.has(v.key);
    if (v.grandfathered) {
      summary[v.rule].grandfathered++;
    } else {
      summary[v.rule].newCount++;
      if (RULES[v.rule].severity === 'FAIL') failCount++;
    }
  }

  // Report new violations first, grandfathered after (quietly).
  const fresh = violations.filter((v) => !v.grandfathered);
  const old = violations.filter((v) => v.grandfathered);

  if (fresh.length) {
    console.log('\n=== NEW VIOLATIONS ===');
    for (const v of fresh) {
      const tag = RULES[v.rule].severity === 'WARN' ? 'WARN' : 'FAIL';
      console.log(`[${tag}] [${v.rule}] ${v.rel}:${v.line}  ${v.snippet}`);
      console.log(`       ${RULES[v.rule].desc}`);
    }
  }
  if (old.length) {
    console.log('\n=== GRANDFATHERED (baseline) ===');
    for (const v of old) {
      console.log(`[GRANDFATHERED] [${v.rule}] ${v.rel}:${v.line}  ${v.snippet}`);
    }
  }

  // Summary table
  console.log('\n=== UI STANDARDS AUDIT SUMMARY ===');
  const ruleW = Math.max(...Object.keys(RULES).map((r) => r.length), 4);
  console.log(`${'RULE'.padEnd(ruleW)}  ${'SEV'.padEnd(4)}  ${'NEW'.padStart(5)}  ${'GRANDFATHERED'.padStart(13)}`);
  for (const [rule, meta] of Object.entries(RULES)) {
    const s = summary[rule];
    console.log(`${rule.padEnd(ruleW)}  ${meta.severity.padEnd(4)}  ${String(s.newCount).padStart(5)}  ${String(s.grandfathered).padStart(13)}`);
  }
  console.log(`\nScanned ${files.length} files. Baseline entries: ${baseline.size}.`);

  if (failCount > 0) {
    console.log(`\nAUDIT FAILED: ${failCount} new violation(s) of FAIL-severity rules.`);
    console.log('Fix them (preferred) or intentionally re-baseline with --write-baseline.');
    process.exit(1);
  }
  console.log('\nAUDIT PASSED: no new violations.');
  process.exit(0);
}

main();
