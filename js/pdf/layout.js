/*
 * layout.js — renders a lesson plan onto the Deliberate Lesson Model worksheet.
 *
 * The page is composed as a vertical flow of "atoms": indivisible slices of
 * drawn content that each know their own height. A field box takes as many
 * atoms as fit on the current page, draws its border around exactly those, and
 * continues on the next page under a "(continued)" caption.
 *
 * That design exists to satisfy one hard rule: a lesson plan of any length
 * must survive export intact. Nothing is ever clipped, truncated, or dropped
 * because a box ran out of room.
 *
 * An empty field is drawn as ruled lines, so exporting a blank plan produces a
 * printable paper worksheet identical in spirit to the original.
 */

import { PDFDocument } from './writer.js';
import { stringWidth, wrapText } from './afm.js';
import { toWinAnsi } from './encoding.js';
import { encodePlan } from './embed.js';
import { META, COLORS, HEADER_FIELDS, STAGES, planTitle } from '../schema.js';

const PAGE = { w: 612, h: 792 };
const MARGIN = 36;
const CONTENT_W = PAGE.w - MARGIN * 2;
const HEADER_H = 58;
const TOP = HEADER_H + 20;
const BOTTOM = PAGE.h - 44;
const PAD = 10;
const GAP = 10;

const TYPE = {
  fieldLabel: { font: 'F2', size: 10.5, leading: 14 },
  subLabel:   { font: 'F2', size: 9,    leading: 12 },
  help:       { font: 'F3', size: 8.5,  leading: 11 },
  body:       { font: 'F1', size: 9.5,  leading: 12.5 }
};

const WHITE = '#FFFFFF';
const EMPTY_RULE = '#D8DCE2';

/* ------------------------------------------------------------------ atoms */

/* An atom is { h, draw(page, x, yTop, width) }. */

function spacer(h) {
  return { h, draw: () => {} };
}

function textAtoms(text, style, width, color) {
  const lines = wrapText(toWinAnsi(text), style.font, style.size, width);
  return lines.map((line) => ({
    h: style.leading,
    draw: (page, x, y) =>
      page.text(x, y + style.size, line, {
        font: style.font,
        size: style.size,
        color
      })
  }));
}

/* Ruled lines standing in for an unanswered field, so a blank export prints. */
function ruledAtoms(count) {
  return Array.from({ length: count }, () => ({
    h: 15,
    draw: (page, x, y, w) =>
      page.line(x, y + 12, x + w, y + 12, { color: EMPTY_RULE, lineWidth: 0.5 })
  }));
}

/* A row of check-squares: filled for the chosen option, outlined for the rest. */
function choiceAtoms(choice, value, width, accent) {
  const BOX = 7.5;
  const LABEL_GAP = 5;
  const ITEM_GAP = 16;

  const items = choice.options.map((option) => {
    const label = toWinAnsi(option);
    const selected = String(value || '').trim() === option;
    const font = selected ? 'F2' : 'F1';
    return {
      label, selected, font,
      w: BOX + LABEL_GAP + stringWidth(label, font, 9)
    };
  });

  const prefix = choice.label ? toWinAnsi(choice.label + ':') : '';
  const prefixW = prefix ? stringWidth(prefix, 'F3', 8.5) + 8 : 0;

  /* Greedy pack into rows; the label prefix only sits on the first row. */
  const rows = [];
  let row = [];
  let used = prefixW;
  for (const item of items) {
    const need = item.w + (row.length ? ITEM_GAP : 0);
    if (row.length && used + need > width) {
      rows.push(row);
      row = [];
      used = 0;
    }
    used += row.length ? need : item.w;
    row.push(item);
  }
  if (row.length) rows.push(row);

  return rows.map((cells, rowIndex) => ({
    h: 14,
    draw: (page, x, y) => {
      let cursor = x;
      if (rowIndex === 0 && prefix) {
        page.text(cursor, y + 9, prefix, { font: 'F3', size: 8.5, color: COLORS.help });
        cursor += prefixW;
      }
      for (const cell of cells) {
        page.rect(cursor, y + 2, BOX, BOX, {
          fill: cell.selected ? accent : undefined,
          stroke: cell.selected ? accent : COLORS.rule,
          lineWidth: 0.75
        });
        page.text(cursor + BOX + LABEL_GAP, y + 9, cell.label, {
          font: cell.font,
          size: 9,
          color: cell.selected ? COLORS.ink : COLORS.help
        });
        cursor += cell.w + ITEM_GAP;
      }
    }
  }));
}

/* The worksheet's inline "After: ______" / "Not until: ______" lines. */
function leadAtoms(lead, value, width) {
  const label = toWinAnsi(lead.label + ':');
  const labelW = stringWidth(label, 'F2', 9) + 6;
  const text = toWinAnsi(value || '');
  const lines = wrapText(text, 'F1', 9.5, Math.max(40, width - labelW));

  return lines.map((line, index) => ({
    h: 15,
    draw: (page, x, y, w) => {
      if (index === 0) {
        page.text(x, y + 10, label, { font: 'F2', size: 9, color: COLORS.help });
      }
      const textX = index === 0 ? x + labelW : x;
      if (line) {
        page.text(textX, y + 10, line, { font: 'F1', size: 9.5, color: COLORS.ink });
      } else {
        page.line(textX, y + 12, x + w, y + 12, { color: EMPTY_RULE, lineWidth: 0.5 });
      }
    }
  }));
}

/* --------------------------------------------------------------- the flow */

class Flow {
  constructor(doc) {
    this.doc = doc;
    this.pages = [];
    this.page = null;
    this.y = 0;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage();
    this.pages.push(this.page);
    this.y = TOP;
    drawHeaderBand(this.page);
    return this.page;
  }

  get room() {
    return BOTTOM - this.y;
  }

  ensure(height) {
    if (this.room < height && this.y > TOP) this.newPage();
  }
}

function drawHeaderBand(page) {
  page.rect(0, 0, PAGE.w, HEADER_H, { fill: COLORS.header });

  const title = toWinAnsi(META.title);
  const subtitle = toWinAnsi(META.subtitle);
  const titleW = stringWidth(title + ' ', 'F2', 14);

  page.text(MARGIN, 30, title, { font: 'F2', size: 14, color: WHITE });
  page.text(MARGIN + titleW, 30, subtitle, { font: 'F2', size: 14, color: WHITE });
  page.line(MARGIN + titleW, 33, MARGIN + titleW + stringWidth(subtitle, 'F2', 14), 33,
    { color: WHITE, lineWidth: 0.6 });
}

/*
 * Draw a stack of atoms inside a bordered box, splitting across pages when it
 * cannot fit. `title` labels the continuation caption.
 */
function drawBox(flow, atoms, title, minContent = 0) {
  let index = 0;
  let firstSegment = true;

  while (index < atoms.length) {
    if (!firstSegment) {
      flow.page.text(MARGIN, flow.y + 8, toWinAnsi(title + ' (continued)'),
        { font: 'F3', size: 8, color: COLORS.help });
      flow.y += 12;
    }

    const available = BOTTOM - flow.y - PAD * 2;
    let used = 0;
    let count = 0;
    while (index + count < atoms.length && used + atoms[index + count].h <= available) {
      used += atoms[index + count].h;
      count++;
    }

    /* Nothing fits: move to a fresh page and retry. On an already-fresh page,
       force one atom through rather than loop forever — an atom taller than a
       whole page can only be drawn as-is. */
    if (count === 0) {
      if (flow.y > TOP) { flow.newPage(); firstSegment = index === 0; continue; }
      count = 1;
      used = atoms[index].h;
    }

    const complete = index + count >= atoms.length;
    const content = complete ? Math.max(used, minContent) : used;
    const boxH = content + PAD * 2;

    flow.page.rect(MARGIN, flow.y, CONTENT_W, boxH,
      { stroke: COLORS.rule, lineWidth: 0.75 });

    let y = flow.y + PAD;
    for (let k = 0; k < count; k++) {
      atoms[index + k].draw(flow.page, MARGIN + PAD, y, CONTENT_W - PAD * 2);
      y += atoms[index + k].h;
    }

    flow.y += boxH + GAP;
    index += count;
    firstSegment = false;
    if (index < atoms.length) flow.newPage();
  }
}

/* ------------------------------------------------------------- composition */

function leafAtoms(field, data, accent, width, isSub) {
  const atoms = [];
  const labelStyle = isSub ? TYPE.subLabel : TYPE.fieldLabel;
  const heading = field.number ? `${field.number}) ${field.label}` : field.label;

  atoms.push(...textAtoms(heading, labelStyle, width, isSub ? COLORS.ink : accent));
  if (field.help) atoms.push(...textAtoms(field.help, TYPE.help, width, COLORS.help));
  if (field.choice) {
    atoms.push(spacer(3));
    atoms.push(...choiceAtoms(field.choice, data[field.choice.id], width, accent));
  }
  if (field.lead) {
    atoms.push(spacer(2));
    atoms.push(...leadAtoms(field.lead, data[field.lead.id], width));
  }

  const value = String(data[field.id] || '').trim();
  atoms.push(spacer(4));
  if (value) {
    atoms.push(...textAtoms(value, TYPE.body, width, COLORS.ink));
  } else {
    atoms.push(...ruledAtoms(field.type === 'text' ? 1 : field.rows || 3));
  }
  return atoms;
}

function fieldAtoms(field, data, accent, width) {
  if (field.type !== 'group') return leafAtoms(field, data, accent, width, false);

  const atoms = [];
  const heading = field.number ? `${field.number}) ${field.label}` : field.label;
  atoms.push(...textAtoms(heading, TYPE.fieldLabel, width, accent));
  if (field.help) atoms.push(...textAtoms(field.help, TYPE.help, width, COLORS.help));

  field.fields.forEach((sub, index) => {
    atoms.push(spacer(index === 0 ? 6 : 8));
    atoms.push(...leafAtoms(sub, data, accent, width, true));
  });
  return atoms;
}

/* The three-cell identity strip under the header on page one. */
function drawIdentityStrip(flow, data) {
  const H = 48;
  flow.ensure(H + GAP);
  const widths = [246, 147, 147];
  const y = flow.y;

  flow.page.rect(MARGIN, y, CONTENT_W, H, { stroke: COLORS.rule, lineWidth: 0.75 });

  let x = MARGIN;
  HEADER_FIELDS.forEach((field, index) => {
    const w = widths[index];
    if (index > 0) {
      flow.page.line(x, y, x, y + H, { color: COLORS.rule, lineWidth: 0.75 });
    }
    const label = field.number ? `${field.number}) ${field.label}` : field.label;
    flow.page.text(x + PAD, y + 15, label,
      { font: 'F2', size: 8.5, color: COLORS.header });

    const value = String(data[field.id] || '').trim();
    if (value) {
      const inner = w - PAD * 2;
      const line = wrapText(toWinAnsi(value), 'F1', 10, inner)[0];
      flow.page.text(x + PAD, y + 31, line, { font: 'F1', size: 10, color: COLORS.ink });
    } else {
      flow.page.line(x + PAD, y + 32, x + w - PAD, y + 32,
        { color: EMPTY_RULE, lineWidth: 0.5 });
    }

    if (field.type === 'choice') {
      flow.page.text(x + PAD, y + 42, toWinAnsi(field.options.join(' · ')),
        { font: 'F1', size: 7.5, color: COLORS.help });
    }
    x += w;
  });

  flow.y += H + GAP;
}

function drawStageBand(flow, stage) {
  const H = 24;
  /* Never strand a stage heading at the foot of a page. */
  flow.ensure(H + 70);
  flow.page.rect(MARGIN, flow.y, CONTENT_W, H, { fill: COLORS[stage.color] });
  flow.page.text(MARGIN + 12, flow.y + 16, stage.title,
    { font: 'F2', size: 11.5, color: WHITE });
  flow.y += H + GAP;
}

function drawFooterRule(flow) {
  const lines = wrapText(toWinAnsi(META.footer), 'F2', 9, CONTENT_W);
  const H = lines.length * 12 + 14;
  flow.ensure(H);
  flow.page.line(MARGIN, flow.y, MARGIN + CONTENT_W, flow.y,
    { color: COLORS.header, lineWidth: 1.2 });
  lines.forEach((line, i) => {
    flow.page.text(MARGIN, flow.y + 14 + i * 12, line,
      { font: 'F2', size: 9, color: COLORS.header });
  });
  flow.y += H;
}

/* Page counters are stamped last, once the total is known. */
function stampPageNumbers(pages) {
  pages.forEach((page, index) => {
    const label = toWinAnsi(`${META.worksheet} · ${index + 1} of ${pages.length}`);
    const w = stringWidth(label, 'F1', 8.5);
    page.text(PAGE.w - MARGIN - w, 30, label,
      { font: 'F1', size: 8.5, color: '#AEB7C6' });
  });
}

/* --------------------------------------------------------------- exported */

export function buildPlanPdf(data) {
  const doc = new PDFDocument({ width: PAGE.w, height: PAGE.h });
  const flow = new Flow(doc);
  const innerWidth = CONTENT_W - PAD * 2;

  drawIdentityStrip(flow, data);

  for (const stage of STAGES) {
    drawStageBand(flow, stage);
    const accent = COLORS[stage.color];
    for (const field of stage.fields) {
      const atoms = fieldAtoms(field, data, accent, innerWidth);
      drawBox(flow, atoms, `${field.number}) ${field.label}`, 40);
    }
  }

  drawFooterRule(flow);
  stampPageNumbers(flow.pages);

  const { bytes, base64 } = encodePlan(data);
  doc.attachFile('lesson-plan.json', bytes, {
    mime: 'application/json',
    description: 'Machine-readable lesson plan. Reopen this PDF in the app to edit it.'
  });
  doc.setTrailingData(base64);
  doc.setInfo({
    title: planTitle(data),
    subject: `${META.title} — ${META.subtitle}`,
    keywords: 'lesson plan, instructional design, deliberate lesson model'
  });

  return doc.build();
}

/* A filesystem-safe, human-readable filename for the export. */
export function planFilename(data) {
  const slug = planTitle(data)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'lesson-plan';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${date}.pdf`;
}
