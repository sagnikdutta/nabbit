/**
 * Phase 8 v1 — offline backfill for the curated challenge library.
 *
 * Writes v1 fields onto every curated Challenge in `src/content/data.ts`:
 *   buggyLineAnswer    (locate-then-fix)   — Pass 1
 *   rankedFixes        (rank-fixes)        — Pass 1
 *   availableFormats                        — Pass 1
 *   seedDistribution   (Autopsy)           — Pass 1
 *
 * Two modes:
 *
 *   npm run backfill -- --defaults
 *       No LLM. Fills missing fields with deterministic defaults — same ones
 *       `src/content/normalize.ts` applies at runtime, now written to disk so
 *       the diff is reviewable in git. Safe and free. `rankedFixes` is left
 *       alone (quality-sensitive).
 *
 *   npm run backfill -- --gemini
 *       Uses GEMINI_API_KEY from .env (never VITE_). Author-time only — this
 *       script is not reachable from the SPA. Writes higher-quality rankings
 *       and distributions. Review the diff before committing.
 *
 * Flags:
 *   --dry-run       print the diff, don't write
 *   --only=<id>     only process challenges whose id matches (substring)
 *
 * All grading remains deterministic — this script never runs at request time.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURATED_CHALLENGES } from '../src/content/data.ts';
import { Challenge, ChallengeFormat } from '../src/lib/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../src/content/data.ts');

type Flags = { mode: 'defaults' | 'gemini'; dryRun: boolean; only?: string; withRankings: boolean };

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { mode: 'defaults', dryRun: false, withRankings: false };
  for (const a of argv) {
    if (a === '--defaults') flags.mode = 'defaults';
    else if (a === '--gemini') flags.mode = 'gemini';
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--with-rankings') flags.withRankings = true;
    else if (a.startsWith('--only=')) flags.only = a.slice('--only='.length);
  }
  return flags;
}

/** Deterministic default seed distribution — mirrors normalize.ts. */
function defaultSeedDistribution(correctOption: number, n: number): number[] {
  const wrong = [0.22, 0.2, 0.16, 0.14, 0.12].slice(0, Math.max(0, n - 1));
  const correctShare = Math.max(0, 1 - wrong.reduce((a, b) => a + b, 0));
  const dist = new Array(n).fill(0);
  let w = 0;
  for (let i = 0; i < n; i++) {
    dist[i] = i === correctOption ? correctShare : wrong[w++] ?? 0;
  }
  return dist;
}

/**
 * Deterministic default ranking (used only when --gemini is unavailable and the
 * caller explicitly passes --with-rankings). Simple heuristic: correct option
 * last (best), the rest in reverse index order (worst → best). This is a
 * placeholder — Gemini is still preferred for quality.
 */
function defaultRankedFixes(challenge: Challenge): number[] {
  const n = challenge.fixOptions.length;
  const others = Array.from({ length: n }, (_, i) => i).filter(i => i !== challenge.correctOption);
  others.sort((a, b) => b - a); // reverse so later-indexed "wrong" options rank worst-first
  return [...others, challenge.correctOption];
}

interface Backfill {
  id: string;
  buggyLineAnswer?: number;
  rankedFixes?: number[];
  availableFormats?: ChallengeFormat[];
  seedDistribution?: number[];
}

function planDefaults(challenges: Challenge[], flags: Flags): Backfill[] {
  const out: Backfill[] = [];
  for (const c of challenges) {
    if (flags.only && !c.id.includes(flags.only)) continue;
    const b: Backfill = { id: c.id };
    let any = false;
    if (typeof c.buggyLineAnswer !== 'number' && c.buggyLines.length > 0) {
      b.buggyLineAnswer = c.buggyLines[0];
      any = true;
    }
    const needsDist =
      !Array.isArray(c.seedDistribution) || c.seedDistribution.length !== c.fixOptions.length;
    if (needsDist) {
      b.seedDistribution = defaultSeedDistribution(c.correctOption, c.fixOptions.length);
      any = true;
    }
    // --with-rankings: emit a HEURISTIC placeholder so Rank-fixes lights up on
    // every drill. Quality: not great — real rankings should come from --gemini.
    if (flags.withRankings && !Array.isArray(c.rankedFixes)) {
      b.rankedFixes = defaultRankedFixes(c);
      any = true;
    }
    if (any) out.push(b);
  }
  return out;
}

async function planGemini(challenges: Challenge[], flags: Flags): Promise<Backfill[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('--gemini requires GEMINI_API_KEY in .env (never VITE_GEMINI_API_KEY).');
    process.exit(2);
  }
  // Lazy import so --defaults mode never pulls the SDK.
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const out: Backfill[] = [];
  for (const c of challenges) {
    if (flags.only && !c.id.includes(flags.only)) continue;
    const needsLine = typeof c.buggyLineAnswer !== 'number';
    const needsRank = !Array.isArray(c.rankedFixes);
    const needsDist =
      !Array.isArray(c.seedDistribution) || c.seedDistribution.length !== c.fixOptions.length;
    if (!needsLine && !needsRank && !needsDist) continue;

    const prompt = `You are grading a bug-hunt drill. Return ONLY valid JSON.

Concept: ${c.concept}
Difficulty: ${c.difficulty}
Code (one planted flaw):
${c.buggyCode}

Fix options (0-indexed):
${c.fixOptions.map((o, i) => `${i}. ${o}`).join('\n')}

Correct option index: ${c.correctOption}

Return a JSON object with these keys:
  "buggyLineAnswer": the 1-indexed line number of the canonical bug.
  "rankedFixes": the fix option indices sorted worst (most harmful / most wrong) → best (the correct one, last).
  "seedDistribution": array of ${c.fixOptions.length} numbers summing to 1.0 — a plausible distribution of what newer developers would pick.
Nothing else, no prose, no code fence.`;

    const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const text = res.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(`[${c.id}] no JSON in Gemini response — skipping`);
      continue;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      console.warn(`[${c.id}] JSON parse failed — skipping`);
      continue;
    }
    const b: Backfill = { id: c.id };
    if (needsLine && typeof parsed.buggyLineAnswer === 'number') b.buggyLineAnswer = parsed.buggyLineAnswer;
    if (needsRank && Array.isArray(parsed.rankedFixes) && parsed.rankedFixes.length === c.fixOptions.length) {
      b.rankedFixes = parsed.rankedFixes;
    }
    if (needsDist && Array.isArray(parsed.seedDistribution) && parsed.seedDistribution.length === c.fixOptions.length) {
      b.seedDistribution = parsed.seedDistribution;
    }
    if (b.buggyLineAnswer || b.rankedFixes || b.seedDistribution) out.push(b);
    console.log(`[${c.id}] ok`);
  }
  return out;
}

/**
 * Apply backfills into `src/content/data.ts` by inserting lines right after the
 * matching `buggyLines:` row of each challenge. Idempotent — fields that are
 * already present are not re-written (the backfill plan already filtered those out).
 */
function applyBackfills(backfills: Backfill[]): { updated: string; count: number } {
  const src = fs.readFileSync(DATA_FILE, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n'; // preserve existing line endings
  let out = src;
  let count = 0;
  for (const b of backfills) {
    // Find the challenge block: `    id: '<id>',` through its own `buggyLines:` line.
    // Accept either LF or CRLF line endings so the script is Windows-safe.
    const idLineRe = new RegExp(
      `(^\\s{4}id:\\s*'${b.id.replace(/'/g, "\\'")}',[\\s\\S]*?^\\s{4}buggyLines:\\s*\\[[^\\]]*\\],\\r?\\n)`,
      'm',
    );
    const m = out.match(idLineRe);
    if (!m) {
      console.warn(`[${b.id}] couldn't find anchor in data.ts — skipping`);
      continue;
    }
    const insertions: string[] = [];
    if (typeof b.buggyLineAnswer === 'number') {
      insertions.push(`    buggyLineAnswer: ${b.buggyLineAnswer}, // backfill`);
    }
    if (Array.isArray(b.rankedFixes)) {
      insertions.push(`    rankedFixes: [${b.rankedFixes.join(', ')}], // backfill`);
    }
    if (Array.isArray(b.seedDistribution)) {
      const rounded = b.seedDistribution.map(v => Number(v.toFixed(3)));
      insertions.push(`    seedDistribution: [${rounded.join(', ')}], // backfill`);
    }
    if (insertions.length === 0) continue;
    out = out.replace(idLineRe, m[1] + insertions.join(eol) + eol);
    count++;
  }
  return { updated: out, count };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  console.log(`Mode: ${flags.mode}${flags.dryRun ? ' (dry-run)' : ''}${flags.only ? ` only=${flags.only}` : ''}`);

  const plan =
    flags.mode === 'gemini'
      ? await planGemini(CURATED_CHALLENGES, flags)
      : planDefaults(CURATED_CHALLENGES, flags);

  if (plan.length === 0) {
    console.log('Nothing to backfill — every selected drill already has the fields.');
    return;
  }
  console.log(`Planned ${plan.length} drill(s):`);
  for (const b of plan) {
    const keys = ['buggyLineAnswer', 'rankedFixes', 'seedDistribution']
      .filter(k => (b as any)[k] !== undefined)
      .join(', ');
    console.log(`  ${b.id} → ${keys}`);
  }

  if (flags.dryRun) {
    console.log('--dry-run: nothing written.');
    return;
  }

  const { updated, count } = applyBackfills(plan);
  fs.writeFileSync(DATA_FILE, updated, 'utf8');
  console.log(`Wrote ${count} drill update(s) → ${DATA_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
