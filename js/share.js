/*
 * share.js — getting a finished plan off the device.
 *
 * Two routes, no backend and no accounts on either:
 *
 *   Download — a normal browser download. Works everywhere. The user files it
 *              into whatever cloud drive they already sync.
 *   Email    — the Web Share API with the PDF as a real file attachment, which
 *              opens the native share sheet (Mail included) on iOS/macOS
 *              Safari, Android Chrome, and Windows Chrome/Edge.
 *
 * Where sharing files is unsupported, Email degrades to: download the PDF, then
 * open a prefilled mail draft for the user to attach it to. `mailto:` cannot
 * carry attachments — RFC 6068 has no field for one — so this is the closest
 * an app with no server can get.
 */

import { buildPlanPdf, planFilename } from './pdf/layout.js';
import { planTitle } from './schema.js';

function toBlob(data) {
  return new Blob([buildPlanPdf(data)], { type: 'application/pdf' });
}

export function downloadPlan(data) {
  const blob = toBlob(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = planFilename(data);
  document.body.appendChild(link);
  link.click();
  link.remove();
  /* Revoke on the next tick; Safari needs the URL alive during the click. */
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { method: 'download', filename: link.download };
}

export function canShareFiles() {
  if (!navigator.canShare || !navigator.share || typeof File === 'undefined') return false;
  try {
    const probe = new File([new Uint8Array([0x25])], 'probe.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function mailSubject(data) {
  const title = planTitle(data);
  const course = String(data.course || '').trim();
  return course ? `Lesson Plan — ${title} — ${course}` : `Lesson Plan — ${title}`;
}

/*
 * Hand the PDF to the OS share sheet. Returns how it was delivered so the UI
 * can tell the user what just happened — especially in the fallback case,
 * where they must attach the downloaded file themselves.
 */
export async function emailPlan(data) {
  const filename = planFilename(data);
  const subject = mailSubject(data);

  if (canShareFiles()) {
    const file = new File([toBlob(data)], filename, { type: 'application/pdf' });
    try {
      await navigator.share({ files: [file], title: subject });
      return { method: 'share', filename };
    } catch (error) {
      /* The user dismissing the sheet is not a failure. */
      if (error && error.name === 'AbortError') return { method: 'cancelled', filename };
      /* Anything else: fall through to the download route. */
    }
  }

  downloadPlan(data);
  /* Blank recipient by design — the instructor addresses it themselves. */
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}`;
  return { method: 'mailto', filename };
}
