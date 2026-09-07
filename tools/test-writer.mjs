/* Builds a small PDF and verifies its structure byte-for-byte. */
import { writeFileSync } from 'node:fs';
import { PDFDocument } from '../js/pdf/writer.js';

const out = process.argv[2] || '/tmp/writer-smoke.pdf';

const doc = new PDFDocument();
doc.setInfo({ title: 'Writer Smoke Test', subject: 'Deliberate Lesson Planning' });

const p1 = doc.addPage();
p1.rect(0, 0, 612, 64, { fill: '#131C30' });
p1.text(48, 40, 'Teaching on Purpose — The Deliberate Lesson Model',
  { font: 'F2', size: 15, color: '#FFFFFF' });
p1.rect(36, 100, 540, 26, { fill: '#2E7D4E' });
p1.text(48, 118, 'Stage 1: Backward Design', { font: 'F2', size: 12, color: '#FFFFFF' });
p1.rect(36, 126, 540, 120, { stroke: '#C8CDD4' });
p1.text(48, 150, 'Parens ( ) backslash \\ and a middot · survive escaping.', { size: 10 });
p1.line(48, 170, 564, 170, { color: '#C8CDD4' });

const p2 = doc.addPage();
p2.text(48, 60, 'Second page.', { size: 11 });

const payload = new TextEncoder().encode(JSON.stringify({ topic: 'Round trip' }));
doc.attachFile('lesson-plan.json', payload, {
  mime: 'application/json',
  description: 'Machine-readable source data'
});
doc.setTrailingData(Buffer.from(payload).toString('base64'));

const bytes = doc.build();
writeFileSync(out, bytes);

/* --- structural self-check: every xref offset must land on "N 0 obj" --- */
const text = Buffer.from(bytes).toString('latin1');
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
};

check('starts with %PDF-1.7', text.startsWith('%PDF-1.7'));
check('ends with %%EOF', text.trimEnd().endsWith('%%EOF'));

const startxref = Number(/startxref\s+(\d+)/.exec(text)[1]);
check('startxref within file', startxref > 0 && startxref < bytes.length);
check('startxref points at xref table', text.slice(startxref, startxref + 4) === 'xref');

const xrefBody = text.slice(startxref);
const trailer = text.slice(text.lastIndexOf('trailer'));
const entries = [...xrefBody.matchAll(/^(\d{10}) (\d{5}) ([nf]) $/gm)];
check('xref entry count matches /Size',
  entries.length === Number(/\/Size (\d+)/.exec(trailer)[1]));

let badOffset = null;
entries.forEach((m, i) => {
  if (m[3] === 'f') return;
  const at = Number(m[1]);
  if (!new RegExp(`^${i} 0 obj`).test(text.slice(at, at + 24))) {
    badOffset = `object ${i} offset ${at} -> ${JSON.stringify(text.slice(at, at + 20))}`;
  }
});
check('every xref offset resolves to its object', badOffset === null, badOffset);

check('startxref is near the end of file', bytes.length - startxref < 1024,
  `${bytes.length - startxref} bytes of tail`);
check('trailing data marker present', /%%DLP-DATA:[A-Za-z0-9+/=]+\n/.test(text));
check('embedded file declared', text.includes('/Type /EmbeddedFile'));
check('mime name is hex-escaped', /\/Subtype \/application#2[fF]json/.test(text));

console.log(`\n${bytes.length} bytes, ${entries.length - 1} objects, 2 pages`);
console.log(failures ? `${failures} failure(s)` : 'writer structure OK');
process.exit(failures ? 1 : 0);
