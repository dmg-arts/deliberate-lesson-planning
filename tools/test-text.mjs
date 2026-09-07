/* Checks for the text-measurement layer: encoding, widths, and wrapping. */
import { stringWidth, wrapText } from '../js/pdf/afm.js';
import { toWinAnsi } from '../js/pdf/encoding.js';

let failures = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}` + (ok ? '' : `\n      got ${actual}, want ${expected}`));
};

check('Helvetica "Hello" @10pt', stringWidth('Hello', 'F1', 10).toFixed(2), '22.78');
check('Helvetica-Bold "Hello" @10pt', stringWidth('Hello', 'F2', 10).toFixed(2), '24.45');
check('em dash is full em', stringWidth(toWinAnsi('—'), 'F1', 10).toFixed(2), '10.00');
check('accented e matches plain e', stringWidth('é', 'F1', 10), stringWidth('e', 'F1', 10));

/* No wrapped line may exceed the box. This is the property that keeps text
   inside the printed worksheet boxes. */
const sample = toWinAnsi(
  'Learners practice WITH the instructor — corrective feedback happens here, ' +
  'immediately, before independent work begins.'
);
const wrapped = wrapText(sample, 'F1', 9, 200);
check('every wrapped line fits', wrapped.every((l) => stringWidth(l, 'F1', 9) <= 200), true);
check('no content lost in wrap', wrapped.join(' ').replace(/ +/g, ' '), sample.replace(/ +/g, ' '));

const urly = wrapText('go https://example.com/a/very/long/path/that/never/breaks end', 'F1', 9, 120);
check('unbreakable word is hard-split', urly.every((l) => stringWidth(l, 'F1', 9) <= 120), true);

check('newlines preserved', JSON.stringify(wrapText('one\ntwo\n\nfour', 'F1', 9, 200)),
  JSON.stringify(['one', 'two', '', 'four']));
check('empty input is one empty line', JSON.stringify(wrapText('', 'F1', 9, 200)), JSON.stringify(['']));

console.log(failures ? `\n${failures} failure(s)` : '\nall text checks passed');
process.exit(failures ? 1 : 0);
