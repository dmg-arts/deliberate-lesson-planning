/*
 * writer.js — a minimal, dependency-free PDF 1.7 writer.
 *
 * Scope is deliberately narrow: filled and stroked rectangles, straight lines,
 * and text in the two base-14 Helvetica faces. That is everything the
 * Deliberate Lesson Model worksheet needs, and nothing else, which keeps the
 * whole generator small enough to audit in one sitting.
 *
 * Coordinates: callers work in TOP-LEFT space (y grows downward), because the
 * worksheet is laid out top-down. The conversion to PDF's bottom-left origin
 * happens here, once, so no layout code has to think about it.
 */

import { escapePdfString, latin1Bytes, toWinAnsi } from './encoding.js';

const LETTER = { width: 612, height: 792 };

/* '#RRGGBB' -> the '0.204 0.267 0.322' triple PDF operators expect. */
function pdfColor(hex) {
  const h = String(hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const f = (v) => (v / 255).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0');
  return `${f((n >> 16) & 255)} ${f((n >> 8) & 255)} ${f(n & 255)}`;
}

const num = (v) => (Math.round(v * 1000) / 1000).toString();

class Page {
  constructor(doc) {
    this.doc = doc;
    this.width = doc.width;
    this.height = doc.height;
    this.ops = [];
  }

  /* y is the text BASELINE measured down from the top of the page. */
  text(x, y, str, opts = {}) {
    const { font = 'F1', size = 10, color = '#000000' } = opts;
    const encoded = escapePdfString(toWinAnsi(str));
    if (encoded === '') return this;
    this.ops.push(
      'BT',
      `/${font} ${num(size)} Tf`,
      `${pdfColor(color)} rg`,
      `1 0 0 1 ${num(x)} ${num(this.height - y)} Tm`,
      `(${encoded}) Tj`,
      'ET'
    );
    return this;
  }

  /* y is the TOP edge of the rectangle. */
  rect(x, y, w, h, opts = {}) {
    const { fill, stroke, lineWidth = 0.75 } = opts;
    if (!fill && !stroke) return this;
    if (fill) this.ops.push(`${pdfColor(fill)} rg`);
    if (stroke) {
      this.ops.push(`${pdfColor(stroke)} RG`, `${num(lineWidth)} w`);
    }
    this.ops.push(`${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re`);
    this.ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
    return this;
  }

  line(x1, y1, x2, y2, opts = {}) {
    const { color = '#000000', lineWidth = 0.75 } = opts;
    this.ops.push(
      `${pdfColor(color)} RG`,
      `${num(lineWidth)} w`,
      `${num(x1)} ${num(this.height - y1)} m`,
      `${num(x2)} ${num(this.height - y2)} l`,
      'S'
    );
    return this;
  }

  contentBytes() {
    return latin1Bytes(this.ops.join('\n') + '\n');
  }
}

export class PDFDocument {
  constructor(opts = {}) {
    this.width = opts.width || LETTER.width;
    this.height = opts.height || LETTER.height;
    this.pages = [];
    this.info = {};
    this.attachments = [];
    this.trailingData = null;
  }

  addPage() {
    const page = new Page(this);
    this.pages.push(page);
    return page;
  }

  setInfo(info) {
    Object.assign(this.info, info);
    return this;
  }

  /*
   * Attach a file inside the PDF. Used to carry the lesson plan's own JSON so
   * an exported worksheet can be reopened and edited.
   */
  attachFile(name, bytes, opts = {}) {
    this.attachments.push({
      name,
      bytes,
      mime: opts.mime || 'application/octet-stream',
      description: opts.description || ''
    });
    return this;
  }

  /*
   * An ASCII comment written just before the cross-reference table. This is
   * how the app finds its own data on reload: one regex over the raw bytes,
   * with no PDF parsing at all. It sits before the xref (not after %%EOF) so
   * that `startxref` stays near the end of the file where readers expect it.
   */
  setTrailingData(ascii) {
    this.trailingData = ascii;
    return this;
  }

  build() {
    /* Object slots are reserved first so forward references resolve cleanly. */
    const objects = [];
    const reserve = () => { objects.push(null); return objects.length; };
    const define = (id, dict, stream = null) => { objects[id - 1] = { dict, stream }; };

    const catalogId = reserve();
    const pagesId = reserve();
    const fontRegularId = reserve();
    const fontBoldId = reserve();
    const fontObliqueId = reserve();
    const infoId = reserve();

    define(fontRegularId,
      '/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    define(fontBoldId,
      '/Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
    define(fontObliqueId,
      '/Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding');

    const pageIds = [];
    for (const page of this.pages) {
      const pageId = reserve();
      const contentId = reserve();
      pageIds.push(pageId);
      define(pageId,
        `/Type /Page /Parent ${pagesId} 0 R ` +
        `/MediaBox [0 0 ${num(page.width)} ${num(page.height)}] ` +
        `/Contents ${contentId} 0 R`);
      define(contentId, '', page.contentBytes());
    }

    define(pagesId,
      `/Type /Pages /Count ${pageIds.length} ` +
      `/Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] ` +
      '/Resources << /Font << ' +
      `/F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontObliqueId} 0 R >> ` +
      '/ProcSet [/PDF /Text] >>');

    /* Embedded files, if any. */
    const specIds = [];
    for (const att of this.attachments) {
      const streamId = reserve();
      const specId = reserve();
      specIds.push({ id: specId, name: att.name });
      define(streamId,
        `/Type /EmbeddedFile /Subtype ${nameObject(att.mime)} ` +
        `/Params << /Size ${att.bytes.length} /ModDate (${pdfDate()}) >>`,
        att.bytes);
      define(specId,
        `/Type /Filespec /F (${escapePdfString(att.name)}) ` +
        `/UF (${escapePdfString(att.name)}) ` +
        `/Desc (${escapePdfString(toWinAnsi(att.description))}) ` +
        `/EF << /F ${streamId} 0 R /UF ${streamId} 0 R >>`);
    }

    let catalogExtras = '';
    if (specIds.length) {
      const names = specIds
        .map((s) => `(${escapePdfString(s.name)}) ${s.id} 0 R`)
        .join(' ');
      catalogExtras =
        ` /Names << /EmbeddedFiles << /Names [${names}] >> >>` +
        ` /AF [${specIds.map((s) => `${s.id} 0 R`).join(' ')}]` +
        ' /PageMode /UseAttachments';
    }
    define(catalogId, `/Type /Catalog /Pages ${pagesId} 0 R${catalogExtras}`);

    const meta = [
      ['Title', this.info.title],
      ['Author', this.info.author],
      ['Subject', this.info.subject],
      ['Keywords', this.info.keywords],
      ['Creator', this.info.creator || 'Deliberate Lesson Planning'],
      ['Producer', 'Deliberate Lesson Planning (dependency-free PDF writer)']
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => `/${k} (${escapePdfString(toWinAnsi(v))})`)
      .join(' ');
    define(infoId, `${meta} /CreationDate (${pdfDate()}) /ModDate (${pdfDate()})`);

    /* ---- serialise ---- */
    const chunks = [];
    let length = 0;
    const push = (data) => {
      const bytes = typeof data === 'string' ? latin1Bytes(data) : data;
      chunks.push(bytes);
      length += bytes.length;
    };

    push('%PDF-1.7\n');
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker

    const offsets = new Array(objects.length).fill(0);
    objects.forEach((obj, index) => {
      const id = index + 1;
      offsets[index] = length;
      const dict = obj.stream
        ? `<< ${obj.dict ? obj.dict + ' ' : ''}/Length ${obj.stream.length} >>`
        : `<< ${obj.dict} >>`;
      push(`${id} 0 obj\n${dict}\n`);
      if (obj.stream) {
        push('stream\n');
        push(obj.stream);
        push('\nendstream\n');
      }
      push('endobj\n');
    });

    if (this.trailingData) push(`%%DLP-DATA:${this.trailingData}\n`);

    const xrefOffset = length;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    push(xref);

    const id = documentId();
    push(
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R ` +
      `/Info ${infoId} 0 R /ID [<${id}> <${id}>] >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`
    );

    const out = new Uint8Array(length);
    let cursor = 0;
    for (const chunk of chunks) { out.set(chunk, cursor); cursor += chunk.length; }
    return out;
  }
}

/* '/application#2Fjson' — '/' and other specials must be hex-escaped in names. */
function nameObject(value) {
  return '/' + String(value).replace(/[^A-Za-z0-9]/g, (c) =>
    '#' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}

function pdfDate(date = new Date()) {
  const p = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  return (
    `D:${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}` +
    `${sign}${p(Math.floor(Math.abs(tz) / 60))}'${p(Math.abs(tz) % 60)}'`
  );
}

function documentId() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export { LETTER };
