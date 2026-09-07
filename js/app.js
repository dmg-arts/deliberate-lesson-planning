/*
 * app.js — the home screen: start a plan, continue one, reopen an exported
 * PDF, and jump to wherever the user keeps their finished plans.
 */

import { listPlans, deletePlan, savePlan, getPref, setPref } from './storage.js';
import { extractPlan } from './pdf/embed.js';
import { emptyPlan, planTitle } from './schema.js';

function toast(message, tone = '') {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.hidden = false;
  node.dataset.tone = tone;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 7000);
}

const formatted = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], {
    dateStyle: 'medium', timeStyle: 'short'
  });
};

/* ------------------------------------------------------------------ drafts */

async function renderDrafts() {
  const list = document.getElementById('drafts');
  const empty = document.getElementById('drafts-empty');
  const plans = await listPlans();

  empty.hidden = plans.length > 0;
  list.replaceChildren(...plans.map((plan) => {
    const item = document.createElement('li');

    const grow = document.createElement('div');
    grow.className = 'grow';
    const title = document.createElement('div');
    title.className = 'draft-title';
    title.textContent = planTitle(plan.data);
    const meta = document.createElement('div');
    meta.className = 'draft-meta';
    const course = String(plan.data.course || '').trim();
    meta.textContent = (course ? course + ' · ' : '') + 'Last edited ' + formatted(plan.updatedAt);
    grow.append(title, meta);

    const open = document.createElement('a');
    open.className = 'btn';
    open.href = `form.html?id=${encodeURIComponent(plan.id)}`;
    open.textContent = 'Open';

    const remove = document.createElement('button');
    remove.className = 'btn btn-danger';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      if (!confirm(`Delete "${planTitle(plan.data)}" from this device?`)) return;
      await deletePlan(plan.id);
      renderDrafts();
    });

    item.append(grow, open, remove);
    return item;
  }));
}

/* -------------------------------------------------------- reopening a PDF */

async function importPdf(file) {
  if (!file) return;
  if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    toast('That is not a PDF. Choose a worksheet exported from this app.');
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const envelope = extractPlan(bytes);
  if (!envelope) {
    toast('No lesson-plan data found in that PDF. Only worksheets exported from this app can be reopened.');
    return;
  }
  const record = await savePlan({ data: { ...emptyPlan(), ...envelope.data } });
  location.href = `form.html?id=${encodeURIComponent(record.id)}`;
}

function wireImport() {
  const input = document.getElementById('pdf-input');
  const zone = document.getElementById('dropzone');

  input.addEventListener('change', () => {
    importPdf(input.files && input.files[0]);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach((type) =>
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.add('is-over');
    }));
  ['dragleave', 'drop'].forEach((type) =>
    zone.addEventListener(type, () => zone.classList.remove('is-over')));

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    importPdf(event.dataTransfer && event.dataTransfer.files[0]);
  });
}

/* ----------------------------------------------------------- drive shortcut */

/* Only ever navigate to a real web address the user typed themselves. */
function safeUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function renderDrive() {
  const saved = getPref('driveUrl', '');
  const link = document.getElementById('drive-link');
  const editor = document.getElementById('drive-editor');
  const input = document.getElementById('drive-url');
  const url = safeUrl(saved);

  link.hidden = !url;
  editor.hidden = !!url;
  if (url) link.href = url;
  input.value = saved;
}

function wireDrive() {
  const input = document.getElementById('drive-url');

  document.getElementById('drive-save').addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) { setPref('driveUrl', ''); renderDrive(); return; }
    const url = safeUrl(value);
    if (!url) {
      toast('Paste a full web address for your drive folder, starting with https://');
      return;
    }
    setPref('driveUrl', url);
    renderDrive();
    toast('Saved. This link stays on this device.');
  });

  document.getElementById('drive-change').addEventListener('click', () => {
    document.getElementById('drive-editor').hidden = false;
    document.getElementById('drive-link').hidden = true;
    input.focus();
  });
}

/* --------------------------------------------------------------- installing */

function wireInstall() {
  const button = document.getElementById('install');
  let prompt = null;

  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event;
    button.hidden = false;
  });

  button.addEventListener('click', async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    prompt = null;
    button.hidden = true;
  });
}

renderDrafts();
wireImport();
renderDrive();
wireDrive();
wireInstall();
