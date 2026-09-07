/*
 * afm.js — Adobe Core-14 glyph advance widths for Helvetica and Helvetica-Bold.
 *
 * These exist for one reason: word wrapping. Because the PDF uses base-14
 * fonts, no font file is embedded, so the viewer supplies the glyphs but we
 * must know their widths to decide where a line breaks and how tall a block
 * becomes. Widths are in 1/1000 em, the PDF text-space convention.
 */

/* Advance widths for codes 32-126, in order. */
const ASCII_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 222, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  222, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

const ASCII_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 278, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  278, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
];

/* Codes 128-191: symbols and punctuation, [regular, bold]. */
const UPPER_SYMBOLS = {
  0x80: [556, 556], 0x82: [222, 278], 0x83: [556, 556], 0x84: [333, 500],
  0x85: [1000, 1000], 0x86: [556, 556], 0x87: [556, 556], 0x88: [333, 333],
  0x89: [1000, 1000], 0x8a: [667, 667], 0x8b: [333, 333], 0x8c: [1000, 1000],
  0x8e: [611, 611], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500],
  0x94: [333, 500], 0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000],
  0x98: [333, 333], 0x99: [1000, 1000], 0x9a: [500, 556], 0x9b: [333, 333],
  0x9c: [944, 944], 0x9e: [500, 500], 0x9f: [667, 667], 0xa0: [278, 278],
  0xa1: [333, 333], 0xa2: [556, 556], 0xa3: [556, 556], 0xa4: [556, 556],
  0xa5: [556, 556], 0xa6: [260, 280], 0xa7: [556, 556], 0xa8: [333, 333],
  0xa9: [737, 737], 0xaa: [370, 370], 0xab: [556, 556], 0xac: [584, 584],
  0xad: [333, 333], 0xae: [737, 737], 0xaf: [333, 333], 0xb0: [400, 400],
  0xb1: [584, 584], 0xb2: [333, 333], 0xb3: [333, 333], 0xb4: [333, 333],
  0xb5: [556, 611], 0xb6: [537, 556], 0xb7: [278, 278], 0xb8: [333, 333],
  0xb9: [333, 333], 0xba: [365, 365], 0xbb: [556, 556], 0xbc: [834, 834],
  0xbd: [834, 834], 0xbe: [834, 834], 0xbf: [611, 611]
};

/*
 * Codes 192-255 are accented Latin letters. In Helvetica an accented glyph has
 * the same advance as its unaccented base, so rather than transcribe 64 more
 * numbers (and risk typos), we derive them from the base letter. A space in
 * this string means "not a plain accented letter" - see UPPER_EXCEPTIONS.
 */
const ACCENT_BASE =
  'AAAAAA CEEEEIIII NOOOOO  UUUUY  ' +
  'aaaaaa ceeeeiiii nooooo  uuuuy y';

/* The entries in 192-255 that are not simple accented letters. */
const UPPER_EXCEPTIONS = {
  0xc6: [1000, 1000], // AE
  0xd0: [722, 722],   // Eth
  0xd7: [584, 584],   // multiply
  0xd8: [778, 778],   // Oslash
  0xde: [667, 667],   // Thorn
  0xdf: [611, 611],   // germandbls
  0xe6: [889, 889],   // ae
  0xf0: [556, 611],   // eth
  0xf7: [584, 584],   // divide
  0xf8: [611, 611],   // oslash
  0xfe: [556, 611]    // thorn
};

function buildTable(asciiTable, boldIndex) {
  const w = new Array(256).fill(asciiTable[0]);
  for (let c = 32; c <= 126; c++) w[c] = asciiTable[c - 32];
  for (const code of Object.keys(UPPER_SYMBOLS)) {
    w[code] = UPPER_SYMBOLS[code][boldIndex];
  }
  for (let c = 0xc0; c <= 0xff; c++) {
    if (UPPER_EXCEPTIONS[c]) { w[c] = UPPER_EXCEPTIONS[c][boldIndex]; continue; }
    const base = ACCENT_BASE.charCodeAt(c - 0xc0);
    if (base !== 32) w[c] = asciiTable[base - 32];
  }
  return w;
}

/* F3 is Helvetica-Oblique, which is Helvetica slanted: identical advances. */
const REGULAR = buildTable(ASCII_REGULAR, 0);
const WIDTHS = { F1: REGULAR, F2: buildTable(ASCII_BOLD, 1), F3: REGULAR };

/* Width of an already-WinAnsi-encoded string, in points, at a given size. */
export function stringWidth(winAnsi, font, size) {
  const table = WIDTHS[font] || WIDTHS.F1;
  let total = 0;
  const s = String(winAnsi);
  for (let i = 0; i < s.length; i++) total += table[s.charCodeAt(i) & 0xff];
  return (total * size) / 1000;
}

/*
 * Break WinAnsi text into lines that fit `maxWidth`.
 *
 * Explicit newlines are honoured. A single word longer than the line box is
 * hard-split rather than allowed to overflow, because an unbroken URL or a
 * long compound term must never run off the edge of the printed worksheet.
 */
export function wrapText(winAnsi, font, size, maxWidth) {
  const lines = [];
  const source = String(winAnsi == null ? '' : winAnsi);

  for (const para of source.split('\n')) {
    const words = para.split(/ +/).filter((w) => w !== '');
    let line = '';

    for (let word of words) {
      /* Hard-split any word that cannot fit on a line by itself. */
      while (stringWidth(word, font, size) > maxWidth) {
        let cut = 1;
        while (
          cut < word.length &&
          stringWidth(word.slice(0, cut + 1), font, size) <= maxWidth
        ) cut++;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }

      const candidate = line ? line + ' ' + word : word;
      if (line && stringWidth(candidate, font, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }

  /* A trailing blank line adds height but no content; drop it. */
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
