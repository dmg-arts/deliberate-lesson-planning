/*
 * encoding.js — Unicode text into the byte range a base-14 PDF font can show.
 *
 * We use WinAnsiEncoding (CP1252) so no font has to be embedded. Anything the
 * user types that CP1252 cannot represent is transliterated to a sensible
 * ASCII stand-in rather than dropped or rendered as a broken glyph — a lesson
 * plan must never come back from the PDF missing characters it went in with.
 */

/* Codepoints that live in CP1252's 0x80-0x9F window. */
const CP1252 = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
]);

/* Common characters outside CP1252 that people paste into worksheets. */
const TRANSLITERATE = new Map([
  ['\u2192', '->'], ['\u2190', '<-'], ['\u21d2', '=>'], ['\u2194', '<->'],
  ['\u2264', '<='], ['\u2265', '>='], ['\u2260', '!='], ['\u2248', '~'],
  ['\u2010', '-'], ['\u2011', '-'], ['\u2012', '-'], ['\u2015', '-'],
  ['\u2212', '-'], ['\u2032', "'"], ['\u2033', '"'], ['\u2044', '/'],
  ['\u25cf', '*'], ['\u25a0', '*'], ['\u25aa', '*'], ['\u2043', '-'],
  ['\u2713', 'v'], ['\u2714', 'v'], ['\u2717', 'x'], ['\u2718', 'x'],
  ['\u200b', ''], ['\ufeff', ''], ['\u00ad', '']
]);

/* Unicode spaces that are not in CP1252 collapse to a plain space. */
const SPACES = /[\u2000-\u200a\u202f\u205f\u3000]/;

/*
 * Map arbitrary text to a string whose char codes are all 0-255 and valid in
 * WinAnsiEncoding. Newlines survive; other control characters do not.
 */
export function toWinAnsi(input) {
  if (input == null) return '';
  const text = String(input).normalize('NFC');
  let out = '';

  for (const ch of text) {
    const cp = ch.codePointAt(0);

    if (ch === '\n') { out += '\n'; continue; }
    if (ch === '\t') { out += '    '; continue; }
    if (SPACES.test(ch)) { out += ' '; continue; }
    if (cp < 0x20) continue;                       // other control chars
    if (cp < 0x7f) { out += ch; continue; }        // plain ASCII
    if (cp >= 0xa0 && cp <= 0xff) { out += ch; continue; } // Latin-1 upper

    const win = CP1252.get(cp);
    if (win !== undefined) { out += String.fromCharCode(win); continue; }

    if (TRANSLITERATE.has(ch)) { out += TRANSLITERATE.get(ch); continue; }

    /* Last resort: strip diacritics via NFD, else a visible placeholder so the
       instructor can see something was substituted rather than lost silently. */
    const stripped = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    out += /^[\x20-\x7e]+$/.test(stripped) ? stripped : '?';
  }
  return out;
}

/* Escape a WinAnsi string for use inside a PDF literal string: ( ... ) */
export function escapePdfString(winAnsi) {
  return String(winAnsi)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '\\r');
}

/* Encode a WinAnsi string to bytes (one char = one byte). */
export function latin1Bytes(winAnsi) {
  const s = String(winAnsi);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
