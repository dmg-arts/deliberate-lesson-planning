/*
 * embed.js — round-tripping a lesson plan through its own PDF.
 *
 * An exported worksheet carries its source data twice:
 *
 *   1. As a real PDF file attachment (`lesson-plan.json`), so any PDF tool can
 *      see and extract it, and so the data is visible in Acrobat's attachment
 *      pane.
 *   2. As a `%%DLP-DATA:<base64>` comment before the cross-reference table.
 *
 * The app reloads from the comment, not the attachment: finding it is a single
 * regex over the raw bytes with no PDF parsing, so reopening a plan cannot be
 * broken by a malformed xref or by another tool having rewritten the file.
 */

export const FORMAT = 'deliberate-lesson-planning';
export const FORMAT_VERSION = 1;

const MARKER = '%%DLP-DATA:';

/* Wrap raw field values with enough provenance to migrate them later. */
export function wrapPlan(data, extra = {}) {
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    ...extra,
    data
  };
}

export function encodePlan(data, extra) {
  const json = JSON.stringify(wrapPlan(data, extra));
  const bytes = new TextEncoder().encode(json);
  return { json, bytes, base64: bytesToBase64(bytes) };
}

/*
 * Recover a plan from exported PDF bytes. Returns the parsed envelope, or null
 * if this PDF was not produced by this app.
 */
export function extractPlan(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const text = latin1String(bytes);

  const marked = new RegExp(MARKER + '([A-Za-z0-9+/=]+)').exec(text);
  if (marked) {
    const parsed = safeParse(new TextDecoder().decode(base64ToBytes(marked[1])));
    if (parsed) return parsed;
  }

  /* Fallback: the comment is gone (another tool rewrote the file) but the
     attachment survived. Find the JSON envelope directly and brace-match it. */
  const needle = `{"format":"${FORMAT}"`;
  const start = text.indexOf(needle);
  if (start === -1) return null;
  const json = sliceJsonObject(text, start);
  return json ? safeParse(new TextDecoder().decode(latin1Bytes(json))) : null;
}

function safeParse(json) {
  try {
    const value = JSON.parse(json);
    return value && value.format === FORMAT && value.data ? value : null;
  } catch {
    return null;
  }
}

/* Walk forward from an opening brace to its match, respecting string escapes. */
function sliceJsonObject(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/* ---- byte / string helpers that work identically in browsers and Node ---- */

export function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000; // chunked so long plans cannot blow the call stack
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function latin1String(bytes) {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return out;
}

function latin1Bytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}
