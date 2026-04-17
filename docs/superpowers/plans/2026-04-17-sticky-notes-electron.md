# Sticky Notes Electron Packaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing Sticky Notes HTML/React prototype as a native Ubuntu desktop application (`.deb` + `.AppImage`) via Electron, with file-based persistence at `~/.config/sticky-notes/notes.json`. Mac support is deferred — Linux-first.

**Architecture:** Electron main process owns a single `BrowserWindow` at 1920×1080 and exposes four async IPC channels (`notes:load`, `notes:save`, `notes:export`, `notes:import`). Pure `storage.js` module handles atomic file I/O (`tmp` + rename). Renderer loads vendored React/Babel from `vendor/` — no CDN. `app.jsx` gains a `useStickyStore()` hook that shows a brief `<Loading/>` on mount, hydrates from disk, and debounce-saves (500 ms) the consolidated state.

**Tech Stack:** Electron 32, electron-builder 25, React 18.3.1, Babel-standalone 7.29.0, sharp 0.33 (dev), node:test (no extra test runner).

**User preferences baked into this plan:**
- **No git init, no commits** during implementation. Checkpoints are manual smoke-tests, not commits. Once everything works end-to-end, user will decide about git.
- **Linux first.** Mac `.dmg` build steps are deferred to a follow-up plan.
- **sudo step at the end** (installing the `.deb`) is manual — user runs it.

**Reference spec:** `docs/superpowers/specs/2026-04-17-sticky-notes-electron-design.md`

---

## File Structure

**Prototype files (copied in from bundle, untouched except HTML and app.jsx):**
- `Sticky Notes.html` — renderer entry shell. Modified once (swap CDN → vendor).
- `app.jsx` — main React app. Modified in three focused refactors (Tasks 10–12).
- `Sticky Notes (standalone).html` — reference only; not loaded at runtime.

**New top-level files:**
- `package.json` — deps, scripts, electron-builder config.
- `main.js` — Electron main process (window, menu, IPC, window-bounds persistence).
- `preload.js` — context-isolated IPC bridge.
- `storage.js` — pure file I/O module (load + atomic save). Isolated so node:test can import it directly.
- `build-icons.mjs` — one-shot SVG → PNG rasterizer via sharp.
- `.gitignore` — `node_modules/`, `dist/`.

**New asset files:**
- `build/icon.svg` — 512×512 flat yellow sticky, 4° rotation, folded corner.
- `build/icon.png` — 1024×1024 raster of the SVG (built by `build-icons.mjs`).

**Vendored libraries (committed to tree, ~1.4 MB):**
- `vendor/react.production.min.js` — React 18.3.1.
- `vendor/react-dom.production.min.js` — ReactDOM 18.3.1.
- `vendor/babel.min.js` — @babel/standalone 7.29.0.

**Tests:**
- `tests/storage.test.mjs` — unit tests for storage module (node --test).

**Runtime data location (created by main on first save):**
- `~/.config/sticky-notes/notes.json` — consolidated app state.
- `~/.config/sticky-notes/window.json` — window bounds.

---

## Task 1: Scaffold project directory

**Files:**
- Copy: `/tmp/design-pkg/test-high-fidelity/project/Sticky Notes.html` → `/home/farid/open_source/sticky-notes/Sticky Notes.html`
- Copy: `/tmp/design-pkg/test-high-fidelity/project/app.jsx` → `/home/farid/open_source/sticky-notes/app.jsx`
- Copy: `/tmp/design-pkg/test-high-fidelity/project/Sticky Notes (standalone).html` → `/home/farid/open_source/sticky-notes/Sticky Notes (standalone).html`
- Create: `/home/farid/open_source/sticky-notes/.gitignore`

- [ ] **Step 1.1: Copy prototype files**

Run:
```bash
cp "/tmp/design-pkg/test-high-fidelity/project/Sticky Notes.html" "/home/farid/open_source/sticky-notes/Sticky Notes.html"
cp "/tmp/design-pkg/test-high-fidelity/project/app.jsx" "/home/farid/open_source/sticky-notes/app.jsx"
cp "/tmp/design-pkg/test-high-fidelity/project/Sticky Notes (standalone).html" "/home/farid/open_source/sticky-notes/Sticky Notes (standalone).html"
```

Verify: `ls -la /home/farid/open_source/sticky-notes/` shows the three files.

- [ ] **Step 1.2: Write .gitignore**

Create `/home/farid/open_source/sticky-notes/.gitignore` with:

```
node_modules/
dist/
*.tmp
.DS_Store
```

Verify: `cat /home/farid/open_source/sticky-notes/.gitignore` prints the five lines.

---

## Task 2: Create package.json and install dependencies

**Files:**
- Create: `/home/farid/open_source/sticky-notes/package.json`

- [ ] **Step 2.1: Write initial package.json (no build config yet)**

Create `/home/farid/open_source/sticky-notes/package.json` with:

```json
{
  "name": "sticky-notes",
  "version": "1.0.0",
  "description": "Spatial sticky-notes canvas",
  "main": "main.js",
  "private": true,
  "scripts": {
    "start": "electron .",
    "test": "node --test tests/",
    "build:icons": "node build-icons.mjs",
    "build": "electron-builder --linux",
    "build:linux": "electron-builder --linux"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0",
    "sharp": "^0.33.0"
  }
}
```

Note: `main: "main.js"` pointer is wrong — Electron will crash until Task 7 creates `main.js`. Expected; we're scaffolding.

- [ ] **Step 2.2: Install dependencies**

Run (from `/home/farid/open_source/sticky-notes/`):
```bash
npm install
```

Expected: downloads Electron (~150 MB Linux binaries), electron-builder, sharp. Takes 1–3 minutes on first install.

Verify: `ls node_modules/electron node_modules/electron-builder node_modules/sharp` — each exists.
Verify: `npx electron --version` prints `v32.x.x` (or whatever 32.x ships).

---

## Task 3: Vendor React / ReactDOM / Babel locally

**Files:**
- Create: `/home/farid/open_source/sticky-notes/vendor/react.production.min.js`
- Create: `/home/farid/open_source/sticky-notes/vendor/react-dom.production.min.js`
- Create: `/home/farid/open_source/sticky-notes/vendor/babel.min.js`

- [ ] **Step 3.1: Create vendor directory and download pinned versions**

Run:
```bash
mkdir -p /home/farid/open_source/sticky-notes/vendor
cd /home/farid/open_source/sticky-notes/vendor
curl -fsSL -o react.production.min.js     https://unpkg.com/react@18.3.1/umd/react.production.min.js
curl -fsSL -o react-dom.production.min.js https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js
curl -fsSL -o babel.min.js                https://unpkg.com/@babel/standalone@7.29.0/babel.min.js
```

Verify: `ls -la /home/farid/open_source/sticky-notes/vendor/` shows three files, each non-empty. Expected sizes (approximate): react ~7 KB, react-dom ~130 KB, babel ~1.2 MB.

- [ ] **Step 3.2: Sanity-check the vendored files**

Run:
```bash
head -c 200 /home/farid/open_source/sticky-notes/vendor/react.production.min.js
```

Expected: compact minified JS beginning roughly with `/** @license React v18.3.1 ...` and `!function(...)`. If it starts with `<html>`, curl followed a redirect to an error page — delete and retry.

---

## Task 4: Point Sticky Notes.html at vendored scripts

**Files:**
- Modify: `/home/farid/open_source/sticky-notes/Sticky Notes.html` (lines 15–17)

- [ ] **Step 4.1: Swap the three CDN `<script>` tags**

Replace lines 15–17 of `Sticky Notes.html`:

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
```

With:

```html
<script src="./vendor/react.production.min.js"></script>
<script src="./vendor/react-dom.production.min.js"></script>
<script src="./vendor/babel.min.js"></script>
```

Verify: `grep -c "unpkg.com" "/home/farid/open_source/sticky-notes/Sticky Notes.html"` prints `0`.
Verify: `grep -c "./vendor/" "/home/farid/open_source/sticky-notes/Sticky Notes.html"` prints `3`.

---

## Task 5: Write storage.js tests (test-first)

**Files:**
- Create: `/home/farid/open_source/sticky-notes/tests/storage.test.mjs`

- [ ] **Step 5.1: Create tests directory**

Run: `mkdir -p /home/farid/open_source/sticky-notes/tests`

- [ ] **Step 5.2: Write the test file**

Create `/home/farid/open_source/sticky-notes/tests/storage.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { load, save } from '../storage.js';

function tmpPath() {
  return path.join(
    os.tmpdir(),
    `sticky-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

function cleanup(p) {
  for (const f of [p, p + '.tmp']) {
    try { fs.unlinkSync(f); } catch {}
  }
}

test('load returns {} when file does not exist', () => {
  const p = tmpPath();
  assert.deepEqual(load(p), {});
});

test('save then load round-trips the object', () => {
  const p = tmpPath();
  const data = { notes: [{ id: 'a', title: 'hello' }], tweaks: { theme: 'paper' } };
  save(p, data);
  assert.deepEqual(load(p), data);
  cleanup(p);
});

test('load returns {} on invalid JSON and warns', () => {
  const p = tmpPath();
  fs.writeFileSync(p, '{ not valid json');
  const origWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  try {
    assert.deepEqual(load(p), {});
    assert.ok(warned, 'expected console.warn to be called');
  } finally {
    console.warn = origWarn;
    cleanup(p);
  }
});

test('save creates the parent directory if missing', () => {
  const dir = path.join(os.tmpdir(), `sticky-dir-${Date.now()}`);
  const p = path.join(dir, 'nested', 'notes.json');
  try {
    save(p, { hi: 1 });
    assert.ok(fs.existsSync(p));
    assert.deepEqual(load(p), { hi: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('save writes to .tmp first then renames', (t) => {
  const p = tmpPath();
  let tmpExistedAtRename = false;
  const origRename = fs.renameSync.bind(fs);
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (from === p + '.tmp' && to === p) {
      tmpExistedAtRename = fs.existsSync(p + '.tmp');
    }
    return origRename(from, to);
  });
  save(p, { hi: 1 });
  assert.ok(tmpExistedAtRename, 'tmp file should exist at moment of rename');
  cleanup(p);
});

test('save preserves original file if rename throws', (t) => {
  const p = tmpPath();
  save(p, { original: true });
  const m = t.mock.method(fs, 'renameSync', () => { throw new Error('simulated crash'); });
  assert.throws(() => save(p, { new: true }), /simulated crash/);
  m.mock.restore();
  assert.deepEqual(load(p), { original: true });
  cleanup(p);
});
```

- [ ] **Step 5.3: Run tests — expect FAIL (storage.js doesn't exist yet)**

Run: `cd /home/farid/open_source/sticky-notes && node --test tests/`

Expected: test run reports an import error: `Cannot find module '/home/farid/open_source/sticky-notes/storage.js'`. This is the correct failing state before Task 6.

---

## Task 6: Implement storage.js until tests pass

**Files:**
- Create: `/home/farid/open_source/sticky-notes/storage.js`

- [ ] **Step 6.1: Write the module (CommonJS)**

The package has no `"type": "module"` field, so `.js` files default to CommonJS. Writing `storage.js` in CJS lets `main.js` `require()` it directly (simpler than dynamic import), and Node 22's named-import interop lets the ESM test file still `import { load, save } from '../storage.js'`.

Create `/home/farid/open_source/sticky-notes/storage.js` with:

```js
const fs = require('node:fs');
const path = require('node:path');

function load(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] Failed to parse ${filePath}: ${err.message}`);
    return {};
  }
}

function save(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

module.exports = { load, save };
```

- [ ] **Step 6.2: Run tests — expect PASS**

Run: `cd /home/farid/open_source/sticky-notes && node --test tests/`

Expected output (abridged):
```
# tests 6
# suites 0
# pass 6
# fail 0
```

If any test fails, fix `storage.js` and re-run until all 6 pass. Do **not** modify the tests.

- [ ] **Step 6.3: Checkpoint**

No commit (per user preference). Note the passing state and proceed.

---

## Task 7: Write main.js (Electron main process)

**Files:**
- Create: `/home/farid/open_source/sticky-notes/main.js`

- [ ] **Step 7.1: Write main.js**

Create `/home/farid/open_source/sticky-notes/main.js` with:

```js
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { load: loadNotes, save: saveNotes } = require('./storage.js');

const userDataDir = () => app.getPath('userData');
const notesPath   = () => path.join(userDataDir(), 'notes.json');
const windowPath  = () => path.join(userDataDir(), 'window.json');

let mainWindow = null;
let pendingSave = null;        // { data } — debounced on renderer, but we also flush on quit
let isQuitting  = false;

function loadBounds() {
  try {
    if (fs.existsSync(windowPath())) {
      return JSON.parse(fs.readFileSync(windowPath(), 'utf8'));
    }
  } catch {}
  return { width: 1920, height: 1080 };
}

function saveBounds(b) {
  try {
    fs.mkdirSync(path.dirname(windowPath()), { recursive: true });
    fs.writeFileSync(windowPath(), JSON.stringify(b));
  } catch (err) {
    console.warn('[main] failed to save window bounds:', err.message);
  }
}

function createWindow() {
  const bounds = loadBounds();
  mainWindow = new BrowserWindow({
    width:  bounds.width  ?? 1920,
    height: bounds.height ?? 1080,
    x: bounds.x,
    y: bounds.y,
    minWidth:  800,
    minHeight: 600,
    backgroundColor: '#14181d',
    title: 'Sticky Notes',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload uses require('electron'); sandbox would block that
    },
  });

  mainWindow.loadFile('Sticky Notes.html');

  mainWindow.on('close', () => {
    if (mainWindow) saveBounds(mainWindow.getBounds());
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Notes…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow?.webContents.send('menu:export'),
        },
        {
          label: 'Import Notes…',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow?.webContents.send('menu:import'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut'  }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ]},
    { role: 'help', submenu: [
      {
        label: 'About',
        click: () => dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Sticky Notes',
          message: 'Sticky Notes',
          detail: 'Spatial sticky-notes canvas.\nData: ~/.config/sticky-notes/notes.json',
        }),
      },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- IPC ---------- */

ipcMain.handle('notes:load', async () => {
  return loadNotes(notesPath());
});

ipcMain.handle('notes:save', async (_e, data) => {
  pendingSave = { data };
  try {
    saveNotes(notesPath(), data);
    pendingSave = null;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('notes:export', async (_e, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Sticky Notes',
    defaultPath: 'sticky-notes-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('notes:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Sticky Notes',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.length) return { ok: false, canceled: true };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ---------- Lifecycle ---------- */

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (isQuitting) return;
  isQuitting = true;
  if (pendingSave) {
    try {
      saveNotes(notesPath(), pendingSave.data);
    } catch (err) {
      console.warn('[main] final save failed:', err.message);
    }
  }
});
```

- [ ] **Step 7.2: Sanity-check file syntax**

Run: `node --check /home/farid/open_source/sticky-notes/main.js`

Expected: exits with no output (syntax OK).

---

## Task 8: Write preload.js

**Files:**
- Create: `/home/farid/open_source/sticky-notes/preload.js`

- [ ] **Step 8.1: Write preload.js**

Create `/home/farid/open_source/sticky-notes/preload.js` with:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stickyAPI', {
  load:       () => ipcRenderer.invoke('notes:load'),
  save:       (data) => ipcRenderer.invoke('notes:save', data),
  exportFile: (data) => ipcRenderer.invoke('notes:export', data),
  importFile: () => ipcRenderer.invoke('notes:import'),
  onMenuExport: (cb) => ipcRenderer.on('menu:export', cb),
  onMenuImport: (cb) => ipcRenderer.on('menu:import', cb),
});
```

- [ ] **Step 8.2: Syntax check**

Run: `node --check /home/farid/open_source/sticky-notes/preload.js`

Expected: exits with no output.

---

## Task 9: Refactor app.jsx — Part A: useStickyStore + Loading + top-level state

**Files:**
- Modify: `/home/farid/open_source/sticky-notes/app.jsx` (add hook after line 109, replace lines 176–180)

- [ ] **Step 9.1: Read the current state of app.jsx lines 100–210**

Before editing, re-read this range in the **working-directory copy** (not the bundle copy):
```bash
sed -n '100,210p' /home/farid/open_source/sticky-notes/app.jsx
```
This orients you to the exact surrounding code; line numbers below refer to the prototype as copied in Task 1.

- [ ] **Step 9.2: Add useStickyStore hook and SEED accessors right after usePersistedState**

Insert the following block at line 110 of `app.jsx` (immediately **after** the closing `}` of `usePersistedState` at line 109, **before** `function useTweakMode`):

```js
/* ---------- Persisted store (Electron-aware) ---------- */
const PERSIST_KEYS = ['tweaks', 'folders', 'notes', 'links', 'cwd', 'view', 'drawer'];

function useStickyStore() {
  const [store, setStore] = useState(null);
  const saveRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded = {};
      try {
        if (window.stickyAPI) {
          loaded = await window.stickyAPI.load();
        } else {
          loaded = JSON.parse(localStorage.getItem('stickies.all') ?? '{}');
        }
      } catch (err) {
        console.warn('[useStickyStore] load failed:', err);
        loaded = {};
      }
      if (cancelled) return;
      setStore({
        tweaks:  loaded.tweaks  ?? TWEAK_DEFAULTS,
        folders: loaded.folders ?? SEED.folders,
        notes:   loaded.notes   ?? SEED.notes,
        links:   loaded.links   ?? (SEED.links || []),
        cwd:     loaded.cwd     ?? 'root',
        view:    loaded.view    ?? { x: 0, y: 0, z: 1 },
        drawer:  typeof loaded.drawer === 'boolean' ? loaded.drawer : true,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const scheduleSave = useCallback((next) => {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      if (window.stickyAPI) {
        window.stickyAPI.save(next).catch(err => console.warn('[save]', err));
      } else {
        try { localStorage.setItem('stickies.all', JSON.stringify(next)); } catch {}
      }
    }, 500);
  }, []);

  const setKey = useCallback((key, value) => {
    setStore(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        [key]: typeof value === 'function' ? value(prev[key]) : value,
      };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  return { store, setKey };
}

function Loading() {
  return (
    <div style={{
      position:'fixed', inset:0,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'#14181d', color:'#8a9198',
      fontFamily:'Inter, system-ui, sans-serif', fontSize:14, letterSpacing:'.02em',
    }}>Loading…</div>
  );
}
```

- [ ] **Step 9.3: Replace the five top-level usePersistedState calls inside App()**

Find in `app.jsx` (search for the first occurrence of `function App()`):

```js
function App() {
  const [tweaks, setTweaks] = usePersistedState('stickies.tweaks.v3', TWEAK_DEFAULTS);
  const [folders, setFolders] = usePersistedState('stickies.folders.v3', SEED.folders);
  const [notes, setNotes]     = usePersistedState('stickies.notes.v3',   SEED.notes);
  const [links, setLinks]     = usePersistedState('stickies.links.v1',   SEED.links || []);
  const [currentFolder, setCurrentFolder] = usePersistedState('stickies.cwd.v3', 'root');
```

Replace with:

```js
function App() {
  const { store, setKey } = useStickyStore();
  if (!store) return <Loading/>;

  const tweaks   = store.tweaks;
  const folders  = store.folders;
  const notes    = store.notes;
  const links    = store.links;
  const currentFolder = store.cwd;

  const setTweaks  = (v) => setKey('tweaks',  v);
  const setFolders = (v) => setKey('folders', v);
  const setNotes   = (v) => setKey('notes',   v);
  const setLinks   = (v) => setKey('links',   v);
  const setCurrentFolder = (v) => setKey('cwd', v);
```

- [ ] **Step 9.4: Verify no syntax regression**

Run: `node --check /home/farid/open_source/sticky-notes/app.jsx`

Expected: **will fail** because `app.jsx` uses JSX (`<Loading/>`) and plain Node `--check` doesn't understand JSX. That's fine. Skip `node --check` on `app.jsx`. Instead confirm visually by reading the modified region:
```bash
sed -n '175,200p' /home/farid/open_source/sticky-notes/app.jsx
```
The five old `usePersistedState` calls should be gone; the `if (!store) return <Loading/>;` should appear.

---

## Task 10: Refactor app.jsx — Part B: hoist view state from Desktop

**Files:**
- Modify: `/home/farid/open_source/sticky-notes/app.jsx` (Desktop signature + App-side Desktop invocation)

- [ ] **Step 10.1: Remove the usePersistedState in Desktop component**

Find in `Desktop({...})`:

```js
  const [view, setView] = usePersistedState('stickies.view.v1', {x:0, y:0, z:1});
```

Delete that line entirely.

- [ ] **Step 10.2: Add `view` and `setView` to Desktop's destructured props**

Find the Desktop signature (around line 575):

```js
function Desktop({T, tweaks, currentFolder, folders, notes, allNotes, noteRefs, linkLines,
  links, addLink, removeLink, linksFor,
  updateNote, bringToFront, onDeleteNote, selectedId,
  jumpToNote, moveNoteToFolder, onCreateNote}) {
```

Replace with:

```js
function Desktop({T, tweaks, currentFolder, folders, notes, allNotes, noteRefs, linkLines,
  links, addLink, removeLink, linksFor,
  updateNote, bringToFront, onDeleteNote, selectedId,
  jumpToNote, moveNoteToFolder, onCreateNote,
  view, setView}) {
```

- [ ] **Step 10.3: Pass view/setView from App to Desktop**

Locate where `<Desktop ... />` is rendered inside `App()` (search for `<Desktop `). Add `view` and `setView` props:

For example, if the existing JSX is:
```jsx
<Desktop
  T={T}
  tweaks={tweaks}
  currentFolder={currentFolder}
  ...
  onCreateNote={createNote}
/>
```

Append `view={store.view}` and `setView={(v) => setKey('view', v)}` as props. The exact edit is: add these two lines inside the `<Desktop ... />` attribute list, just before the closing `/>`.

- [ ] **Step 10.4: Verify the replacement**

Run:
```bash
grep -n "stickies.view.v1" /home/farid/open_source/sticky-notes/app.jsx
```
Expected: **no output** (the key is gone).

Run:
```bash
grep -n "view={store.view}" /home/farid/open_source/sticky-notes/app.jsx
```
Expected: one match in the `<Desktop ... />` invocation.

---

## Task 11: Refactor app.jsx — Part C: hoist drawer state and delete dead NotesDrawer

**Files:**
- Modify: `/home/farid/open_source/sticky-notes/app.jsx` (FoldersDrawer signature + App-side invocation + delete NotesDrawer)

- [ ] **Step 11.1: Remove the usePersistedState in FoldersDrawer**

Find in `FoldersDrawer({...})` (around line 1207):

```js
  const [open, setOpen] = usePersistedState('stickies.drawer.v2', true);
```

Delete it.

- [ ] **Step 11.2: Add open/setOpen to FoldersDrawer props**

Find the FoldersDrawer signature (line 1203):

```js
function FoldersDrawer({T, tweaks, folders, notes, currentFolder, setCurrentFolder,
  onCreateFolder, onRenameFolder, renamingFolder, setRenamingFolder, onDeleteFolder,
  onDropNoteOnFolder, onCreateNote}) {
```

Replace with:

```js
function FoldersDrawer({T, tweaks, folders, notes, currentFolder, setCurrentFolder,
  onCreateFolder, onRenameFolder, renamingFolder, setRenamingFolder, onDeleteFolder,
  onDropNoteOnFolder, onCreateNote,
  open, setOpen}) {
```

- [ ] **Step 11.3: Pass drawer state from App to FoldersDrawer**

Find `<FoldersDrawer ... />` inside `App()`. Add `open={store.drawer}` and `setOpen={(v) => setKey('drawer', v)}` as props.

- [ ] **Step 11.4: Delete the entire NotesDrawer function**

Locate line 1353 onward:

```js
/* ==================================================================== */
/* NOTES DRAWER (right side — list of notes in current folder)           */
/* ==================================================================== */
function NotesDrawer({...}) {
  const [open, setOpen] = usePersistedState('stickies.drawer.v1', true);
  ...
}
```

Delete the banner comment and the entire `function NotesDrawer(...) { ... }` block, from the `/* =====` banner down to the function's closing `}`. Use a precise grep to find boundaries:

```bash
grep -n "function NotesDrawer\|NOTES DRAWER" /home/farid/open_source/sticky-notes/app.jsx
```

- [ ] **Step 11.5: Verify all localStorage / persisted-state migration is complete**

Run:
```bash
grep -n "usePersistedState\|stickies\." /home/farid/open_source/sticky-notes/app.jsx
```

Expected matches:
1. The `usePersistedState` **definition** at line ~103 — fine, harmless dead code (stays as browser fallback path via `useStickyStore`'s `localStorage` branch). You MAY delete it if you prefer; the plan does not require it.
2. Optionally a couple of `stickies.` references inside comments or the browser fallback. Acceptable.

What must be **absent:**
- No `usePersistedState('stickies....', ...)` *call sites* remaining.
- No reference to `NotesDrawer` anywhere.

Run to confirm no call sites remain:
```bash
grep -n "usePersistedState('" /home/farid/open_source/sticky-notes/app.jsx
```
Expected: **no output**.

Run:
```bash
grep -n "NotesDrawer" /home/farid/open_source/sticky-notes/app.jsx
```
Expected: **no output**.

---

## Task 12: Create the icon SVG

**Files:**
- Create: `/home/farid/open_source/sticky-notes/build/icon.svg`

- [ ] **Step 12.1: Create build directory**

Run: `mkdir -p /home/farid/open_source/sticky-notes/build`

- [ ] **Step 12.2: Write the SVG**

Create `/home/farid/open_source/sticky-notes/build/icon.svg` with:

```svg
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(70,90) rotate(-4 186 166)">
    <!-- sticky body -->
    <path d="M0 0 L300 0 L372 72 L372 332 L0 332 Z"
          fill="#FDE8A1"
          stroke="#3a2f12" stroke-opacity="0.15" stroke-width="3"/>
    <!-- folded corner (slightly darker triangle) -->
    <path d="M300 0 L300 72 L372 72 Z"
          fill="#F5D567"
          stroke="#3a2f12" stroke-opacity="0.2" stroke-width="2"/>
    <!-- three text lines -->
    <rect x="38" y="110" width="232" height="10" rx="3" fill="#3a2f12" fill-opacity="0.25"/>
    <rect x="38" y="160" width="258" height="10" rx="3" fill="#3a2f12" fill-opacity="0.25"/>
    <rect x="38" y="210" width="202" height="10" rx="3" fill="#3a2f12" fill-opacity="0.25"/>
  </g>
</svg>
```

Verify: `cat /home/farid/open_source/sticky-notes/build/icon.svg | head -4` prints the XML declaration and the opening `<svg ...>`.

---

## Task 13: Rasterize SVG → PNG via build-icons.mjs

**Files:**
- Create: `/home/farid/open_source/sticky-notes/build-icons.mjs`
- Create: `/home/farid/open_source/sticky-notes/build/icon.png`

- [ ] **Step 13.1: Write the raster script**

Create `/home/farid/open_source/sticky-notes/build-icons.mjs` with:

```js
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, 'build', 'icon.svg');
const pngPath = path.join(__dirname, 'build', 'icon.png');

const svg = fs.readFileSync(svgPath);
await sharp(svg, { density: 400 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(pngPath);

console.log(`wrote ${pngPath}`);
```

- [ ] **Step 13.2: Run the raster**

Run: `cd /home/farid/open_source/sticky-notes && npm run build:icons`

Expected output: `wrote /home/farid/open_source/sticky-notes/build/icon.png`

- [ ] **Step 13.3: Verify dimensions**

Run: `file /home/farid/open_source/sticky-notes/build/icon.png`

Expected: something like `PNG image data, 1024 x 1024, 8-bit/color RGBA, non-interlaced`.

---

## Task 14: Add electron-builder config to package.json

**Files:**
- Modify: `/home/farid/open_source/sticky-notes/package.json` (append `build` block)

- [ ] **Step 14.1: Add the `build` block**

Open `/home/farid/open_source/sticky-notes/package.json`. Right after the closing `}` of `devDependencies`, add a comma and append:

```json
  "build": {
    "appId": "com.local.sticky-notes",
    "productName": "Sticky Notes",
    "files": [
      "main.js",
      "preload.js",
      "storage.js",
      "Sticky Notes.html",
      "app.jsx",
      "vendor/**",
      "build/icon.png",
      "package.json"
    ],
    "linux": {
      "target": ["deb", "AppImage"],
      "category": "Utility",
      "icon": "build/icon.png",
      "synopsis": "Spatial sticky-notes canvas",
      "description": "Sticky Notes is a spatial canvas for organizing sticky notes into folders."
    },
    "directories": {
      "output": "dist"
    }
  }
```

The full `package.json` should now have: `name`, `version`, `description`, `main`, `private`, `scripts`, `devDependencies`, `build` — in that order.

- [ ] **Step 14.2: Validate JSON**

Run: `node -e 'console.log(Object.keys(require("/home/farid/open_source/sticky-notes/package.json")))'`

Expected: `[ 'name', 'version', 'description', 'main', 'private', 'scripts', 'devDependencies', 'build' ]`

---

## Task 15: Smoke test — launch the app from source

**Files:**
- Uses: all files from Tasks 1–14.

- [ ] **Step 15.1: Delete any prior notes.json (clean first-launch state)**

Run: `rm -f ~/.config/sticky-notes/notes.json ~/.config/sticky-notes/window.json`

(If the directory doesn't exist yet, the command is a no-op.)

- [ ] **Step 15.2: Launch the app in the background**

Run:
```bash
cd /home/farid/open_source/sticky-notes && npm start > /tmp/sticky-start.log 2>&1 &
ELECTRON_PID=$!
echo "ELECTRON_PID=$ELECTRON_PID"
```

Wait 5 seconds for the app to initialize.

- [ ] **Step 15.3: Verify the process is still running**

Run: `ps -p $ELECTRON_PID -o pid=,stat=,command= | head -n 3`

Expected: output shows the Electron process still alive. If blank, the app crashed — check `/tmp/sticky-start.log` for the error.

- [ ] **Step 15.4: Create some state in the app (so we know saves work)**

Because we're headless-but-with-display, interacting with the UI from the CLI is awkward. Instead, simulate: the app just launched with seed data, it will debounce-save within ~500 ms even without user action, because `useStickyStore` hydrates and the useEffect setting `store` triggers no save... actually the seed state only *saves* after a mutation.

So we must verify something softer: the app **launched** and the IPC **load** call didn't throw. Check that `notes.json` does *not* yet exist (we only save after changes):

Run: `ls -la ~/.config/sticky-notes/ 2>/dev/null || echo "dir not yet created"`

Expected either: no directory (load returned `{}`, renderer uses seed, no mutation has fired a save yet), or a `window.json` if the user resized. Either indicates the main process reached the point of bounds-save. Good enough.

- [ ] **Step 15.5: Check the log for errors**

Run: `cat /tmp/sticky-start.log`

Look for:
- ✗ Uncaught exceptions, stack traces, `Cannot find module`.
- ✓ Typical Electron startup messages like `[<timestamp>] electron ...`.
- ✓ Possibly React warnings about development mode — acceptable, they only appear if we accidentally shipped the dev build (we didn't — vendored `.production.min.js`).

If there are errors, debug them before proceeding. Common issues:
- "Cannot find module './storage.js'" in main → verify `storage.js` exists and main.js has `require('./storage.js')`.
- "vendor/react... net::ERR_FILE_NOT_FOUND" → Task 4 replacement didn't apply.
- "Uncaught ReferenceError: useStickyStore is not defined" → Task 9 insertion missed.
- "SyntaxError: Cannot use import statement outside a module" in storage.js → you wrote it as ESM; Step 6.1 requires CJS.

- [ ] **Step 15.6: Kill the app**

Run:
```bash
kill $ELECTRON_PID 2>/dev/null
wait $ELECTRON_PID 2>/dev/null
```

- [ ] **Step 15.7: Relaunch and check state round-trips**

This time, we'll rely on the user doing a quick manual check. Tell the user:

> "Run `cd /home/farid/open_source/sticky-notes && npm start`. Confirm: (1) a window opens showing the sticky-notes canvas with 10 demo notes, (2) drag one note to a new position, (3) close the window. Then run `cat ~/.config/sticky-notes/notes.json | head -60` — the JSON should contain the moved note's new x/y."

Wait for user confirmation before moving on.

---

## Task 16: Build the `.deb` package

**Files:**
- Produces: `/home/farid/open_source/sticky-notes/dist/sticky-notes_1.0.0_amd64.deb`
- Produces: `/home/farid/open_source/sticky-notes/dist/Sticky Notes-1.0.0.AppImage`

- [ ] **Step 16.1: Run electron-builder**

Run (from `/home/farid/open_source/sticky-notes/`):
```bash
npm run build
```

Expected:
- electron-builder downloads a Linux Electron binary if not already cached (~150 MB, one-time).
- Compiles into `dist/linux-unpacked/` then packages into `.deb` and `.AppImage`.
- Total time: 1–5 minutes depending on network/disk.

Typical success final lines:
```
• building        target=deb arch=x64 file=dist/sticky-notes_1.0.0_amd64.deb
• building        target=AppImage arch=x64 file=dist/Sticky Notes-1.0.0.AppImage
```

- [ ] **Step 16.2: Verify artifacts exist**

Run: `ls -la /home/farid/open_source/sticky-notes/dist/`

Expected files (sizes approximate):
- `sticky-notes_1.0.0_amd64.deb` (~70–100 MB)
- `Sticky Notes-1.0.0.AppImage` (~90–110 MB)
- `linux-unpacked/` (directory with the raw app)
- `builder-debug.yml`, `builder-effective-config.yaml` (diagnostics)

- [ ] **Step 16.3: Test the AppImage (no install required)**

Run:
```bash
chmod +x "/home/farid/open_source/sticky-notes/dist/Sticky Notes-1.0.0.AppImage"
"/home/farid/open_source/sticky-notes/dist/Sticky Notes-1.0.0.AppImage" > /tmp/sticky-appimage.log 2>&1 &
APPIMAGE_PID=$!
sleep 5
ps -p $APPIMAGE_PID -o pid=,stat=,command= | head -n 3
cat /tmp/sticky-appimage.log
kill $APPIMAGE_PID 2>/dev/null
```

Expected: process stays alive for ≥5 s, no errors in log. If it fails, likely FUSE is missing: `sudo apt install libfuse2` (user step; tell user).

---

## Task 17: Manual install and final sanity check (user-driven)

This task requires sudo — **do not attempt to run `sudo` from the agent**. Present the steps for the user.

- [ ] **Step 17.1: Present install instructions to the user**

Tell the user:

> ```bash
> sudo dpkg -i /home/farid/open_source/sticky-notes/dist/sticky-notes_1.0.0_amd64.deb
> ```
>
> After install:
> 1. Open the Ubuntu application menu → search "Sticky Notes" → click to launch.
> 2. Verify the sticky icon appears in the menu and on the taskbar.
> 3. The app window opens at 1920×1080 (or your saved size).
> 4. All notes from `~/.config/sticky-notes/notes.json` are restored.
>
> To uninstall later: `sudo apt remove sticky-notes`.

- [ ] **Step 17.2: Await user confirmation**

Wait for the user to report: ✅ installed and launches from menu, OR an error to debug.

---

## Self-Review Checklist

_(Populated by the plan author — do not remove.)_

**1. Spec coverage.** Every section of the spec maps to at least one task:

| Spec section | Covered by |
|---|---|
| §4 Architecture | Task 7 (main), 8 (preload), 9 (hook) |
| §5 Files to create | Tasks 1, 2, 6, 7, 8, 12, 13 |
| §6 Files to modify | Tasks 4, 9, 10, 11 |
| §7 Data model on disk | Task 7 (paths), §9 (hook hydrate) |
| §8 IPC contract | Task 7 (handlers), 8 (exposure) |
| §9 Storage semantics (atomic, debounce) | Task 5/6 (atomic), Task 9 (debounce) |
| §10 useStickyStore hook | Task 9 |
| §11 Vendored deps | Task 3 |
| §12 Icon pipeline | Tasks 12, 13 |
| §13 Cross-platform build | Task 14 (Linux only this round) |
| §14 Testing | Tasks 5, 6, 15, 16 |
| §15 Implementation order | All tasks, same order |

**Mac build (spec §13)** is deferred to a follow-up per user instruction. Documented; not gapped.

**2. Placeholder scan.** No `TBD`, `TODO`, "implement later", "appropriate error handling", or uncoded step where code is needed. Each step either runs a specific command or shows the exact code to write.

**3. Type consistency.** `store` has seven keys (`tweaks, folders, notes, links, cwd, view, drawer`), consistent across Task 9/10/11. IPC channel names (`notes:load/save/export/import`, `menu:export/import`) consistent between main.js (handlers) and preload.js (exposure). Hook function is `useStickyStore` (not `useStickyState`/`useStore`/similar) across all tasks. Setters follow the pattern `setKey('<key>', v)` across all three refactor sub-tasks.

---

**Plan complete.** When ready, execution has two modes: subagent-driven (fresh subagent per task, reviews between) or inline (execute tasks here with checkpoints).
