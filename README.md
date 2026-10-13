# Deliberate Lesson Planning

A progressive web app for the **Teaching on Purpose · Deliberate Lesson Model**
worksheet. Fill in the three-part plan, export a print-ready PDF, and
reopen that same PDF later to keep editing.

No accounts. No server. No dependencies. Works offline.

## What it does

- **The full worksheet** — all twelve numbered items across Backward Design,
  Feedback Strategy Design, and Cognition & Intensity Design.
- **Autosaves as you type**, to your own device. Closing the tab loses nothing.
- **Exports a PDF** that reproduces the printed worksheet — coloured part
  bands, numbered items, and the guidance text.
- **Reopens its own exports.** Every PDF carries its source data inside it, so
  dropping one back into the app restores every field. Move the file between
  devices and your plan moves with it.
- **Prints blank.** Export without filling anything in and you get a paper
  worksheet with ruled lines.
- **Never truncates.** A plan of any length flows onto as many pages as it
  needs; nothing is clipped to fit a box.
- **Fails loudly, not silently.** If the browser blocks or wedges its database
  (private windows, locked profiles), the app says so and tells you to export,
  rather than pretending your work is saved.

## Saving and sharing

Exports **download to your device**, then you file them wherever you already
keep things. The home screen has a **My Drive** shortcut — paste the web address
of your own Google Drive, iCloud, OneDrive, Dropbox, or school folder and it
becomes a one-tap link. That link is stored only on your device.

**Email** hands the PDF to your device's share sheet with the file already
attached, so you can pick Mail and send it. Where a browser cannot share files
(Firefox, some desktop Linux) the PDF downloads and a mail draft opens for you
to attach it to.

### Why there is no "sign in to Google Drive"

Writing to Google Drive requires OAuth — a sign-in — which this app
deliberately does not have. It would also mean a Google Cloud project, a public
OAuth client ID, and scripts loaded from Google's servers at runtime, which
would break both the zero-dependency goal and offline support. A single shared
"class drive" is not possible either: service accounts cannot own consumer Drive
storage, and an unauthenticated shared upload target is a privacy hazard for
anything containing student information.

Syncing a local folder with your drive's desktop app achieves the same result
with none of that.

## Running it

There is no build step. Serve the folder over HTTP:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (A service worker needs `http://localhost`
or HTTPS; opening `index.html` as a `file://` URL disables offline support but
everything else still works.)

## Tests

```sh
npm test          # or run the three files individually:

node tools/test-text.mjs      # encoding, glyph metrics, word wrapping
node tools/test-writer.mjs    # PDF structure: xref offsets, trailer, attachments
node tools/test-layout.mjs    # end-to-end export, overflow integrity, round-trip
```

There is nothing to install — `package.json` exists only to declare ES modules
and shorthand scripts, and lists no dependencies.

To check a specific browser, serve the app and open `tools/browser-test.html`,
which exercises IndexedDB, `Blob`, `File`, and the PDF round-trip in place.

`test-layout.mjs` needs [poppler](https://poppler.freedesktop.org)
(`brew install poppler`) for `pdftotext` and `pdfinfo`; it re-extracts the text
from generated PDFs to prove that nothing a user typed was lost.

## How it is built

Plain ES modules, served as authored. No npm, no bundler, no framework, and no
third-party code at runtime.

| File | Role |
| --- | --- |
| `js/schema.js` | The worksheet itself — every field, label, and hint. Both the form and the PDF are generated from it. |
| `js/pdf/writer.js` | A minimal PDF 1.7 writer: pages, text, rectangles, lines, attachments. |
| `js/pdf/layout.js` | Lays the worksheet out and handles page breaking. |
| `js/pdf/afm.js` | Helvetica glyph widths, so text can be wrapped without embedding a font. |
| `js/pdf/encoding.js` | Unicode → WinAnsi, so typed characters survive export. |
| `js/pdf/embed.js` | Writes the plan's data into the PDF and reads it back. |
| `js/form.js` | Builds the entry form from the schema; autosaves. |
| `js/storage.js` | IndexedDB drafts and local preferences. |
| `js/share.js` | Download, share sheet, and mail fallback. |
| `sw.js` | Offline precache. |
| `tools/make-icons.py` | Regenerates the PNG icons (standard library only). |

## Licence

Code is MIT licensed — see [LICENSE](LICENSE).

The Deliberate Lesson Model worksheet, its stage structure, and its instructional
guidance are the work of their original author and are reproduced here with that
author's involvement. If you fork this for a different framework, replace
`js/schema.js` with your own.
