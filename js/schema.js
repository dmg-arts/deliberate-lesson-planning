/*
 * schema.js — the single source of truth for the Deliberate Lesson Model worksheet.
 *
 * Both the HTML entry form and the PDF layout are generated from this file.
 * Nothing else in the app hard-codes a field name, label, or help string. If the
 * worksheet changes, it changes here and everywhere downstream follows.
 *
 * Field shapes
 *   type: 'text'     single-line input
 *   type: 'textarea' multi-line input
 *   type: 'group'    a container whose `fields` are rendered as labelled sub-blocks
 *
 * Optional decorations on any leaf field:
 *   choice: { id, label, options }  a radio row rendered above the input
 *   lead:   { id, label }           a short inline input rendered before the body
 *                                   (reproduces the worksheet's "After:" / "Not until:" lines)
 *   help:   printed guidance text, shown in the form and on the PDF
 */

export const META = {
  title: 'Teaching on Purpose',
  subtitle: 'The Deliberate Lesson Model',
  worksheet: 'Worksheet: Practice / Group',
  footer:
    'Lesson design MUST show explicit connections across all three parts. ' +
    'They are not separate boxes, but one framework.'
};

/* Palette lifted from the printed worksheet. Shared by CSS custom properties
   and the PDF writer so the screen and the export cannot drift apart. */
export const COLORS = {
  header: '#131C30',
  stage1: '#2E7D4E',
  stage2: '#91560A',
  stage3: '#B0443A',
  ink: '#1B2029',
  help: '#5A6472',
  rule: '#C8CDD4'
};

export const HEADER_FIELDS = [
  { id: 'topic', number: 1, label: 'Lesson Topic', type: 'text' },
  { id: 'course', label: 'Course / Week', type: 'text' },
  {
    id: 'level',
    label: 'Performance Level',
    type: 'choice',
    options: ['Ka', 'Kb', 'P1', 'P2', 'P3']
  }
];

export const STAGES = [
  {
    id: 'stage1',
    number: 1,
    title: 'Part 1: Backward Design',
    color: 'stage1',
    fields: [
      {
        id: 'objective',
        number: 2,
        label: 'SMART Objective',
        type: 'textarea',
        rows: 7,
        help: 'Specific, Measurable, Achievable, Relevant, Time-bound.'
      },
      {
        id: 'assessmentMethod',
        number: 3,
        label: 'Assessment Type & Method',
        type: 'textarea',
        rows: 6,
        help: 'How will you know they got it?',
        choice: {
          id: 'assessmentType',
          label: 'Type',
          options: ['Diagnostic', 'Formative', 'Summative']
        }
      },
      {
        id: 'sequence',
        number: 4,
        label: 'Instruction Sequence',
        type: 'group',
        fields: [
          {
            id: 'hook',
            label: 'HOOK',
            type: 'textarea',
            rows: 3,
            help: 'Engage before you inform. State the objective. Answer WIIFM.'
          },
          {
            id: 'input',
            label: 'INPUT',
            type: 'textarea',
            rows: 3,
            help: 'Core knowledge with clear examples.'
          },
          {
            id: 'guided',
            label: 'GUIDED PRACTICE',
            type: 'textarea',
            rows: 3,
            help: 'Cadets practice WITH the instructor. Corrective feedback here.'
          },
          {
            id: 'independent',
            label: 'INDEPENDENT PRACTICE',
            type: 'textarea',
            rows: 3,
            help: 'Cadets work alone. Instructor observes. Formative assessment.'
          },
          {
            id: 'closure',
            label: 'CLOSURE',
            type: 'textarea',
            rows: 3,
            help: 'Echo the objective. Confirm mastery. Bridge to next lesson.'
          }
        ]
      }
    ]
  },

  {
    id: 'stage2',
    number: 2,
    title: 'Part 2: Feedback Strategy Design',
    color: 'stage2',
    fields: [
      {
        id: 'feedUpNotes',
        number: 5,
        label: 'Feed-Up: Where Is the Goal Stated?',
        type: 'textarea',
        rows: 6,
        help: 'How will the goal be stated at that point?',
        choice: {
          id: 'feedUpWhen',
          label: 'When',
          options: ['Hook', 'Input', 'Guided', 'Independent', 'Closure']
        }
      },
      {
        id: 'checkpointNotes',
        number: 6,
        label: 'Formative Feedback Checkpoint',
        type: 'textarea',
        rows: 6,
        help: 'What will you check, and what does "good" look like?',
        lead: { id: 'checkpointAfter', label: 'After' }
      },
      {
        id: 'feedForward',
        number: 7,
        label: 'Feed-Forward Phrasing Example',
        type: 'textarea',
        rows: 7,
        help: 'Write the exact words you would say:'
      },
      {
        id: 'toneTiming',
        number: 8,
        label: 'Tone & Timing Monitoring Plan',
        type: 'group',
        fields: [
          {
            id: 'toneIntended',
            label: 'Lesson tone & recovery plan',
            type: 'textarea',
            rows: 3,
            help: 'Identify lesson tone and recovery plan should the tone fail.'
          },
          {
            id: 'toneFeedbackPoints',
            label: 'Where feedback is required',
            type: 'textarea',
            rows: 3,
            help: 'Identify where in the lesson feedback will be required.'
          },
          {
            id: 'toneSignals',
            label: 'Cadet signals of misalignment',
            type: 'textarea',
            rows: 3,
            help:
              'Identify cadet signals (verbal / non-verbal) identifying tone or timing misalignment.'
          }
        ]
      }
    ]
  },

  {
    id: 'stage3',
    number: 3,
    title: 'Part 3: Cognition & Intensity Design',
    color: 'stage3',
    fields: [
      {
        id: 'intensityRationale',
        number: 9,
        label: 'Starting Intensity & Rationale',
        type: 'textarea',
        rows: 5,
        help: 'Rationale:',
        choice: {
          id: 'startingIntensity',
          label: 'Starting intensity',
          options: ['Green', 'Yellow', 'Red']
        }
      },
      {
        id: 'scaffolding',
        number: 10,
        label: 'Scaffolding Stage Plan',
        type: 'group',
        fields: [
          {
            id: 'scaffold1',
            label: 'Stage 1 — Full Verbal Guidance · Green',
            type: 'textarea',
            rows: 2
          },
          {
            id: 'scaffold2',
            label: 'Stage 2 — Partial Cues · Yellow',
            type: 'textarea',
            rows: 2
          },
          {
            id: 'scaffold3',
            label: 'Stage 3 — Independent Execution · Orange',
            type: 'textarea',
            rows: 2
          },
          {
            id: 'scaffold4',
            label: 'Stage 4 — Evaluation · Red',
            type: 'textarea',
            rows: 2,
            help: 'NOT until Stage 3 is consistent: 8+ of 10, on two separate sessions.'
          }
        ]
      },
      {
        id: 'amygdala',
        number: 11,
        label: 'Cognitive Overload (Hijack) Recognition',
        type: 'group',
        help: 'Three signals to watch for:',
        fields: [
          { id: 'signal1', label: 'Signal 1', type: 'text' },
          { id: 'signal2', label: 'Signal 2', type: 'text' },
          { id: 'signal3', label: 'Signal 3', type: 'text' }
        ]
      },
      {
        id: 'redWhy',
        number: 12,
        label: 'When Red Intensity Is Introduced and Why',
        type: 'textarea',
        rows: 5,
        help: 'Why is that the right moment?',
        lead: { id: 'redNotUntil', label: 'Not until' }
      }
    ]
  }
];

/* ---------- helpers used by the form, storage, and PDF layers ---------- */

/* Every input id in document order, including choice and lead sub-inputs. */
export function fieldIds() {
  const ids = [];
  const walk = (f) => {
    if (f.choice) ids.push(f.choice.id);
    if (f.lead) ids.push(f.lead.id);
    if (f.type === 'group') f.fields.forEach(walk);
    else ids.push(f.id);
  };
  HEADER_FIELDS.forEach(walk);
  STAGES.forEach((s) => s.fields.forEach(walk));
  return ids;
}

/* An empty record with every key present, so saved data has a stable shape. */
export function emptyPlan() {
  const data = {};
  fieldIds().forEach((id) => (data[id] = ''));
  return data;
}

/* A human label for a stored id, used for filenames and the drafts list. */
export function planTitle(data) {
  const topic = (data && data.topic || '').trim();
  return topic || 'Untitled Lesson Plan';
}
