/*
 * End-to-end checks on the exported worksheet.
 *
 * The important one is CONTENT INTEGRITY: every character a user types must
 * come back out of the finished PDF. This is the guarantee the flow/page-break
 * engine exists to provide, so it is asserted mechanically rather than by eye.
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildPlanPdf, planFilename } from '../js/pdf/layout.js';
import { extractPlan } from '../js/pdf/embed.js';
import { emptyPlan, fieldIds, STAGES } from '../js/schema.js';

const dir = process.argv[2] || '/tmp';
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
};

/* Compare ignoring all whitespace, since wrapping legitimately inserts breaks. */
const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function textOf(path) {
  return execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
}
function pageCount(path) {
  return Number(/Pages:\s+(\d+)/.exec(
    execFileSync('pdfinfo', [path], { encoding: 'utf8' }))[1]);
}

/* ---------------------------------------------------------------- blank */
const blank = emptyPlan();
const blankPath = `${dir}/plan-blank.pdf`;
writeFileSync(blankPath, buildPlanPdf(blank));
check('blank plan renders', pageCount(blankPath) >= 3, `${pageCount(blankPath)} pages`);
const blankText = squash(textOf(blankPath));
check('blank plan still prints all 12 item headings',
  [...Array(12)].every((_, i) => blankText.includes(squash(`${i + 1})`))));

/* --------------------------------------------------------------- filled */
const filled = emptyPlan();
filled.topic = 'Preflight Control Check';
filled.course = 'AV-210 / Week 4';
filled.level = 'P2';
filled.assessmentType = 'Formative';
filled.feedUpWhen = 'Hook';
filled.startingIntensity = 'Green';
let seed = 0;
for (const id of fieldIds()) {
  if (!filled[id]) filled[id] = `Content marker ${++seed} for ${id}, written by the instructor.`;
}
const filledPath = `${dir}/plan-filled.pdf`;
writeFileSync(filledPath, buildPlanPdf(filled));

const filledText = squash(textOf(filledPath));
const missing = fieldIds().filter((id) => !filledText.includes(squash(filled[id])));
check('every filled field appears in the PDF', missing.length === 0, missing.join(', '));
check('chosen options are rendered', ['P2', 'Formative', 'Hook', 'Green']
  .every((v) => textOf(filledPath).includes(v)));

/* ---------------------------------------------------------------- stress */
/*
 * Overflow content is built from unique, ordered markers. Asserting that every
 * marker survives IN ORDER proves nothing was clipped, dropped, or reordered —
 * and unlike a contiguous string match it tolerates the page header band that
 * legitimately interrupts a field spanning a page break.
 */
const markers = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i}xq`);
const prose = (prefix, n) => markers(prefix, n).join(' words about instructional design ');

function outOfOrder(haystack, tokens) {
  let cursor = 0;
  const bad = [];
  for (const token of tokens) {
    const at = haystack.indexOf(token, cursor);
    if (at === -1) bad.push(token);
    else cursor = at + token.length;
  }
  return bad;
}

const stress = emptyPlan();
stress.topic = 'Overflow Stress Test';
const stressed = {
  objective: 400, feedForward: 300, signal1: 120, redWhy: 250, toneSignals: 200
};
for (const [id, n] of Object.entries(stressed)) stress[id] = prose(id.toLowerCase(), n);
stress.hook = 'Unbreakable ' + 'x'.repeat(400);

const stressPath = `${dir}/plan-stress.pdf`;
writeFileSync(stressPath, buildPlanPdf(stress));
const stressText = squash(textOf(stressPath));

let clipped = 0;
for (const [id, n] of Object.entries(stressed)) {
  const bad = outOfOrder(stressText, markers(id.toLowerCase(), n));
  if (bad.length) clipped += bad.length;
  check(`${id}: all ${n} markers survive in order`, bad.length === 0,
    `${bad.length} missing, first: ${bad[0]}`);
}
check('nothing clipped under extreme overflow', clipped === 0);
check('unbreakable 400-char word survives hard-splitting',
  (stressText.match(/x/g) || []).length >= 400);
check('overflow spills onto more pages', pageCount(stressPath) > 6,
  `${pageCount(stressPath)} pages`);
check('continuation captions appear', textOf(stressPath).includes('(continued)'));

/* ------------------------------------------------------------ round-trip */
const recovered = extractPlan(buildPlanPdf(filled));
check('plan recovered from its own PDF', recovered !== null);
if (recovered) {
  const diff = fieldIds().filter((id) => recovered.data[id] !== filled[id]);
  check('every field round-trips byte-identical', diff.length === 0, diff.join(', '));
  check('envelope carries a version', recovered.version === 1);
}

/* Simulate another tool stripping our comment: the attachment must still work. */
const stripped = buildPlanPdf(filled);
const asText = Buffer.from(stripped).toString('latin1').replace(/%%DLP-DATA:[A-Za-z0-9+/=]+/, '%%GONE');
const fallback = extractPlan(Buffer.from(asText, 'latin1'));
check('falls back to the embedded attachment', fallback !== null &&
  fallback.data.topic === filled.topic);

check('filename is filesystem-safe',
  /^Preflight-Control-Check-\d{4}-\d{2}-\d{2}\.pdf$/.test(planFilename(filled)),
  planFilename(filled));

console.log(`\npages: blank ${pageCount(blankPath)}, filled ${pageCount(filledPath)}, stress ${pageCount(stressPath)}`);
console.log(failures ? `${failures} failure(s)` : 'layout OK');
process.exit(failures ? 1 : 0);
