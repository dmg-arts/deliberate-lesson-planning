/*
 * form.js — the worksheet entry screen.
 *
 * The entire form is generated from js/schema.js. Nothing here knows the name
 * of a single lesson-plan field, so the worksheet can be revised in one file.
 *
 * Work is autosaved to the device as it is typed. There is no Save button to
 * forget, and closing the tab loses nothing.
 */

import { HEADER_FIELDS, STAGES, emptyPlan, fieldIds, planTitle } from './schema.js';
import { getPlan, savePlan, deletePlan } from './storage.js';
import { downloadPlan, emailPlan, canShareFiles } from './share.js';

const SAVE_DELAY = 400;

let planId = new URLSearchParams(location.search).get('id') || null;
let data = emptyPlan();
let createdAt = null;
let saveTimer = null;

/* ---------------------------------------------------------------- helpers */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(child);
  }
  return node;
}

function autosize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(68, textarea.scrollHeight + 2) + 'px';
}

/* ---------------------------------------------------------------- rendering */

function choiceGroup(id, legend, options) {
  const fieldset = el('fieldset', { class: 'choices' });
  if (legend) fieldset.appendChild(el('legend', { text: legend }));
  for (const option of options) {
    const input = el('input', { type: 'radio', name: id, value: option, id: `f-${id}-${option}` });
    input.checked = data[id] === option;
    input.addEventListener('change', () => {
      /* Clicking the selected option again clears it — a mis-click on a radio
         is otherwise impossible to undo without a reset button. */
      data[id] = input.checked ? option : '';
      queueSave();
    });
    input.addEventListener('click', (event) => {
      if (data[id] === option) {
        event.currentTarget.checked = false;
        data[id] = '';
        queueSave();
      }
    });
    fieldset.appendChild(el('label', { class: 'choice' }, [input, el('span', { text: option })]));
  }
  return fieldset;
}

function textControl(field) {
  const isArea = field.type !== 'text';
  const control = el(isArea ? 'textarea' : 'input', {
    id: `f-${field.id}`,
    name: field.id,
    rows: isArea ? String(field.rows || 3) : undefined,
    type: isArea ? undefined : 'text',
    autocomplete: 'off',
    spellcheck: 'true'
  });
  control.value = data[field.id] || '';
  control.addEventListener('input', () => {
    data[field.id] = control.value;
    if (isArea) autosize(control);
    queueSave();
  });
  if (isArea) requestAnimationFrame(() => autosize(control));
  return control;
}

function renderLeaf(field, isSub) {
  const wrap = el('div', { class: isSub ? 'subfield' : 'field' });
  const heading = field.number ? `${field.number}) ${field.label}` : field.label;

  /* A pure choice field (Performance Level) has no text body. */
  if (field.type === 'choice') {
    wrap.appendChild(el('span', { class: 'field-label', text: heading }));
    if (field.help) wrap.appendChild(el('p', { class: 'field-help', text: field.help }));
    wrap.appendChild(choiceGroup(field.id, '', field.options));
    return wrap;
  }

  wrap.appendChild(el('label', { class: 'field-label', for: `f-${field.id}`, text: heading }));
  if (field.help) wrap.appendChild(el('p', { class: 'field-help', text: field.help }));
  if (field.choice) {
    wrap.appendChild(choiceGroup(field.choice.id, field.choice.label + ':', field.choice.options));
  }
  if (field.lead) {
    const lead = el('input', {
      type: 'text', id: `f-${field.lead.id}`, autocomplete: 'off',
      placeholder: field.lead.label + '…'
    });
    lead.value = data[field.lead.id] || '';
    lead.addEventListener('input', () => { data[field.lead.id] = lead.value; queueSave(); });
    wrap.appendChild(el('label', {
      class: 'field-help', for: `f-${field.lead.id}`, text: field.lead.label + ':'
    }));
    wrap.appendChild(lead);
    wrap.appendChild(el('div', { style: 'height:10px' }));
  }
  wrap.appendChild(textControl(field));
  return wrap;
}

function renderField(field) {
  if (field.type !== 'group') return renderLeaf(field, false);
  const wrap = el('div', { class: 'field' });
  wrap.appendChild(el('span', {
    class: 'field-label',
    text: field.number ? `${field.number}) ${field.label}` : field.label
  }));
  if (field.help) wrap.appendChild(el('p', { class: 'field-help', text: field.help }));
  field.fields.forEach((sub) => wrap.appendChild(renderLeaf(sub, true)));
  return wrap;
}

function render() {
  const identity = document.getElementById('identity');
  identity.replaceChildren(...HEADER_FIELDS.map((f) => renderLeaf(f, false)));

  const stages = document.getElementById('stages');
  stages.replaceChildren(...STAGES.map((stage) =>
    el('section', { class: 'stage', 'data-stage': stage.id }, [
      el('h2', { class: 'stage-band', text: stage.title }),
      el('div', { class: 'stage-body' }, stage.fields.map(renderField))
    ])
  ));
}

/* ------------------------------------------------------------------ saving */

function setStatus(text) {
  document.getElementById('savestate').textContent = text;
}

function queueSave() {
  setStatus('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, SAVE_DELAY);
}

async function flush() {
  clearTimeout(saveTimer);
  const record = await savePlan({ id: planId, data, createdAt });

  /* Never let the header claim a save that did not happen — a teacher losing a
     lesson plan to a silently blocked database is the worst failure this app
     could have. */
  if (record.persisted === false) {
    setStatus('Not saved — this browser is blocking storage. Download the PDF to keep your work.');
    return;
  }

  if (!planId) {
    planId = record.id;
    createdAt = record.createdAt;
    history.replaceState(null, '', `?id=${encodeURIComponent(planId)}`);
  }
  const time = new Date(record.updatedAt).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit'
  });
  setStatus(`Saved on this device · ${time}`);
  document.title = `${planTitle(data)} · Deliberate Lesson Planning`;
}

function toast(message) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 6000);
}

/* ------------------------------------------------------------------- boot */

async function boot() {
  if (planId) {
    const record = await getPlan(planId);
    if (record) {
      data = { ...emptyPlan(), ...record.data };
      createdAt = record.createdAt;
      setStatus('Loaded from this device');
    } else {
      planId = null;
      setStatus('That plan is no longer on this device — starting a new one');
    }
  } else {
    setStatus('Not saved yet');
  }

  render();
  document.title = `${planTitle(data)} · Deliberate Lesson Planning`;

  document.getElementById('download').addEventListener('click', async () => {
    await flush();
    const result = downloadPlan(data);
    toast(`Downloaded ${result.filename}. Move it into your drive folder to keep it.`);
  });

  const emailButton = document.getElementById('email');
  emailButton.addEventListener('click', async () => {
    await flush();
    emailButton.disabled = true;
    try {
      const result = await emailPlan(data);
      if (result.method === 'share') toast('Shared. Pick Mail to send it with the PDF attached.');
      else if (result.method === 'mailto') {
        toast(`Your browser can't attach files directly. ${result.filename} was downloaded — ` +
              'attach it to the draft that just opened.');
      }
    } finally {
      emailButton.disabled = false;
    }
  });

  document.getElementById('delete').addEventListener('click', async () => {
    if (!confirm('Delete this plan from this device? Exported PDFs are not affected.')) return;
    if (planId) await deletePlan(planId);
    location.href = 'index.html';
  });

  /* Flush before the tab goes away, so the last keystroke is never lost. */
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  addEventListener('pagehide', () => flush());

  if (!canShareFiles()) {
    emailButton.title =
      'This browser cannot attach files to a share. The PDF will download and a mail draft will open.';
  }
}

boot();
