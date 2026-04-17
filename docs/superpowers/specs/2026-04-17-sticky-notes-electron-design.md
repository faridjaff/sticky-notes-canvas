# Sticky Notes — Electron Packaging: Design

**Date:** 2026-04-17
**Author:** Claude (brainstormed with @farid)
**Status:** Approved — ready for implementation plan

---

## 1. Goal

Wrap the existing Sticky Notes HTML/React prototype as a **native Ubuntu desktop application** (primary) and **macOS application** (secondary) using Electron. Data persists to a real file on disk instead of browser `localStorage`. The app must work **fully offline** after install.

## 2. Context

The prototype (`Sticky Notes.html` + `app.jsx`) was produced in Claude Design. The handoff bundle ships it alongside a `README.md` containing an Electron packaging plan. The app is a spatial sticky-notes canvas with folders (right-side drawer), drag/resize, zoom/pan, wiki-style links, markdown rendering, and visual tweaks (paper / flat / terminal themes). Designed and iterated over one session; see `chats/chat1.md` for intent.

The working directory `/home/farid/open_source/sticky-notes/` is empty aside from this `docs/` tree. The prototype files live in `/tmp/design-pkg/test-high-fidelity/project/` and will be copied in as step 1 of implementation.

## 3. Non-goals

- No auto-update mechanism (user reinstalls the `.deb`/`.dmg` when updating).
- No system tray, global shortcuts, or multi-window support.
- No cloud sync. Disk file + manual Export/Import only.
- No mobile targets.
- No redesign of the existing app UI — this is pure packaging. Bugs we find in the prototype UI are out of scope unless they block launch.

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Electron main process (main.js)                        │
│                                                         │
│   ┌──────────────┐    ┌────────────────────────────┐    │
│   │ BrowserWindow│    │ storage.js (pure module)   │    │
│   │ 1920×1080    │◄──►│  load(path) → object       │    │
│   │ min 800×600  │    │  save(path, object) atomic │    │
│   └──────┬───────┘    └────────────────────────────┘    │
│          │                                              │
│          ▼            IPC (invoke/handle)               │
└──────────┼──────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│  Renderer process                                       │
│                                                         │
│   preload.js  ─►  window.stickyAPI                      │
│                   ├─ load()       async                 │
│                   ├─ save(data)   async                 │
│                   ├─ exportFile(data) async             │
│                   └─ importFile() async                 │
│                                                         │
│   Sticky Notes.html  ─► vendor/react.min.js             │
│                        vendor/react-dom.min.js          │
│                        vendor/babel.min.js              │
│                        app.jsx  (type=text/babel)       │
│                                                         │
│   app.jsx                                               │
│     └─ useStickyStore()                                 │
│         ├─ mount: render <Loading/> until load resolves │
│         ├─ hydrate state from loaded blob               │
│         └─ every change: debounced save (500ms)         │
└─────────────────────────────────────────────────────────┘
```

## 5. Files to create

| Path | Purpose |
|------|---------|
| `package.json` | deps + scripts + electron-builder config |
| `main.js` | Electron main process entry |
| `preload.js` | Context-isolated IPC bridge |
| `storage.js` | Pure load/save module (testable in isolation) |
| `build-icons.mjs` | One-shot script: SVG → PNG via `sharp` |
| `build/icon.svg` | 512×512 source icon |
| `build/icon.png` | 1024×1024 raster (electron-builder derives all other formats) |
| `vendor/react.production.min.js` | Pinned React 18.3.1 |
| `vendor/react-dom.production.min.js` | Pinned ReactDOM 18.3.1 |
| `vendor/babel.min.js` | Pinned `@babel/standalone` 7.29.0 |
| `tests/storage.test.mjs` | Unit tests for storage.js (node --test) |
| `.gitignore` | `node_modules/`, `dist/`, `out/` |

## 6. Files to modify

| Path | Change |
|------|--------|
| `Sticky Notes.html` | Replace three `unpkg.com` `<script>` tags with `./vendor/*.js` equivalents. Keep everything else. |
| `app.jsx` | Replace the 7 live `usePersistedState(...)` calls with a single `useStickyStore()` hook that owns the consolidated state. Delete the 8th call site (`stickies.drawer.v1`) entirely — confirmed dead code, the old `NotesDrawer` was removed in the design session. Leave `useTweakMode`'s `window.parent.postMessage` as-is; it's a no-op in Electron (no parent frame) and removing it would drift from the browser-fallback path. |

## 7. Data model on disk

File: `~/.config/sticky-notes/notes.json` (via `app.getPath('userData')`; on macOS this resolves to `~/Library/Application Support/sticky-notes/notes.json`).

Shape:
```json
{
  "tweaks":  { "theme": "paper", "font": "Inter", "density": "cozy", "showLinks": true },
  "folders": { "root": {...}, "workflow": {...}, ... },
  "notes":   [ { "id": "n1", "folder": "home", ... }, ... ],
  "links":   [ { "id": "l1", "from": "n1", "to": "n2" }, ... ],
  "cwd":     "root",
  "view":    { "x": 0, "y": 0, "z": 1 },
  "drawer":  true
}
```

Missing file → renderer receives `{}` and hydrates from `SEED` in `app.jsx` (the 10 demo notes + 6 folders + 3 links). Corrupt JSON → same fallback, plus a console warn.

## 8. IPC contract

All channels use `ipcRenderer.invoke` / `ipcMain.handle` (async, promise-based).

| Channel | Request | Response |
|---------|---------|----------|
| `notes:load` | (none) | `{...fullState}` or `{}` |
| `notes:save` | `fullState` object | `{ ok: true }` or `{ ok: false, error }` |
| `notes:export` | `fullState` object | `{ ok: true, path }` or `{ ok: false, canceled \|\| error }` |
| `notes:import` | (none) | `{ ok: true, data }` or `{ ok: false, canceled \|\| error }` |

Main also listens to `before-quit` to flush any pending debounced save synchronously before the window closes.

## 9. Storage semantics

**Atomic write** (prevents corruption if power loss / crash mid-save):
1. `fs.writeFileSync(path + '.tmp', JSON.stringify(data, null, 2))`
2. `fs.renameSync(path + '.tmp', path)`

**Debounce:** renderer dispatches `save(fullState)` at most once per 500 ms. Last-write-wins. On `before-quit`, any outstanding save is flushed.

**First launch:** file doesn't exist → main returns `{}`. Renderer's `useStickyStore` treats empty as "use seed defaults" — user sees the 10 demo notes.

**Backup:** user copies `~/.config/sticky-notes/notes.json` anywhere. Restore by copying back. Manual File → Export/Import wraps this with a native dialog.

## 10. Renderer hook: `useStickyStore`

```js
const KEYS = ['tweaks', 'folders', 'notes', 'links', 'cwd', 'view', 'drawer'];

function useStickyStore() {
  const [store, setStore] = useState(null);  // null = loading

  useEffect(() => {
    (async () => {
      const loaded = window.stickyAPI
        ? await window.stickyAPI.load()
        : JSON.parse(localStorage.getItem('stickies.all') ?? '{}');
      setStore({
        tweaks:  loaded.tweaks  ?? TWEAK_DEFAULTS,
        folders: loaded.folders ?? SEED.folders,
        notes:   loaded.notes   ?? SEED.notes,
        links:   loaded.links   ?? SEED.links,
        cwd:     loaded.cwd     ?? 'root',
        view:    loaded.view    ?? { x: 0, y: 0, z: 1 },
        drawer:  loaded.drawer  ?? true,
      });
    })();
  }, []);

  const saveRef = useRef(null);
  const scheduleSave = useCallback((next) => {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      if (window.stickyAPI) window.stickyAPI.save(next);
      else localStorage.setItem('stickies.all', JSON.stringify(next));
    }, 500);
  }, []);

  const update = useCallback((key, value) => {
    setStore((prev) => {
      const next = { ...prev, [key]: typeof value === 'function' ? value(prev[key]) : value };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  return { store, update };
}
```

Call sites in `app.jsx`:
```js
const { store, update } = useStickyStore();
if (!store) return <Loading />;
const { tweaks, folders, notes, links, cwd, view, drawer } = store;
const setTweaks  = (v) => update('tweaks',  v);
const setFolders = (v) => update('folders', v);
// ... etc
```

`<Loading />` is a centered, themed "Loading…" div (~20 ms of visible flash on cold start). Match the app's dark chrome so there's no color flash.

## 11. Vendored dependencies

Versions pinned to match the current `Sticky Notes.html` CDN references:
- `react@18.3.1`
- `react-dom@18.3.1`
- `@babel/standalone@7.29.0`

Strategy: commit vendored files under `vendor/` directly (small, ~1.4 MB total, avoids a `postinstall` hop). Source them once from unpkg at setup time, no regular dependency on unpkg after that.

## 12. Icon pipeline

- `build/icon.svg` (512×512) — yellow sticky (`#FDE8A1`), 4° rotation, folded corner (triangle notch top-right), three horizontal gray lines for text, flat (no gradients). Minimal, matches `__bundler_thumbnail` style from the prototype.
- `build-icons.mjs` — uses `sharp` to rasterize `icon.svg` → `build/icon.png` at 1024×1024. `sharp` is a devDependency.
- `electron-builder` handles all downstream formats:
  - Linux: auto-derives `.desktop` icon sizes from `icon.png`.
  - Mac: auto-generates `.icns` from the same `icon.png` (requires ≥512×512; 1024 is recommended).

## 13. Cross-platform build config

`package.json` → `build` block:
```json
"build": {
  "appId": "com.local.sticky-notes",
  "productName": "Sticky Notes",
  "files": ["main.js", "preload.js", "storage.js", "Sticky Notes.html",
            "app.jsx", "vendor/**", "build/icon.png"],
  "linux": { "target": ["deb", "AppImage"], "category": "Utility",
             "icon": "build/icon.png" },
  "mac":   { "target": ["dmg", "zip"], "category": "public.app-category.productivity",
             "icon": "build/icon.png" }
}
```

Scripts:
- `npm start` — `electron .`
- `npm test` — `node --test tests/`
- `npm run build:icons` — `node build-icons.mjs`
- `npm run build` — `electron-builder` (current platform)
- `npm run build:linux` — `electron-builder --linux`
- `npm run build:mac` — `electron-builder --mac` (macOS only)

Cross-build caveat: `.dmg` can only be produced on macOS. Linux artifacts can be built on either platform, but since this is a Linux-primary app, we build Linux on Ubuntu and Mac on Mac.

## 14. Testing

**Unit tests (`tests/storage.test.mjs`, run via `node --test`):**
1. `save()` then `load()` round-trips an object identically.
2. `load()` on a non-existent path returns `{}` (not throws).
3. `load()` on a file containing invalid JSON returns `{}` and logs a warning.
4. `save()` writes to `path + '.tmp'` first, then renames — verified by stubbing `fs.renameSync` and asserting the tmp file exists at the moment of rename.
5. If `save()` is interrupted between write and rename (simulated by throwing in the stubbed rename), the original file is unchanged.

**Manual smoke test (part of implementation, not automated):**
1. `npm start` — app launches, shows loading flash, displays seed notes.
2. Drag a note, pin it, create a new note, switch folders.
3. Close app, wait 1s (ensure debounced save fires).
4. Verify `~/.config/sticky-notes/notes.json` exists and contains the changes.
5. Relaunch — all state restored.
6. Corrupt the JSON file, relaunch — app shows seed data, no crash.
7. File → Export → saves a JSON file.
8. Delete `notes.json`, File → Import the exported file — state restored.

**Build verification:**
1. `npm run build` — `.deb` appears in `dist/`.
2. `sudo dpkg -i dist/sticky-notes_1.0.0_amd64.deb` — installs.
3. Sticky Notes appears in the Ubuntu application menu.
4. Launch from menu — works identically to `npm start`.

**No tests for:** `main.js` / `preload.js` (Electron internals, not worth the spectron/Playwright setup for this scope) or `app.jsx` UI logic (already validated by the design session).

## 15. Implementation order

1. Copy prototype files into working dir (`Sticky Notes.html`, `app.jsx`, standalone HTML for reference only).
2. `package.json` skeleton + install Electron/electron-builder/sharp.
3. Download and commit vendored React/ReactDOM/Babel into `vendor/`.
4. Modify `Sticky Notes.html` to point at vendored scripts.
5. Write `storage.js` and `tests/storage.test.mjs` — TDD: tests first, then implementation until green.
6. Write `main.js` (window, menu, IPC handlers wired to `storage.js`).
7. Write `preload.js` (contextBridge).
8. Refactor `app.jsx` — introduce `useStickyStore`, replace all `usePersistedState` call sites, remove the dead v1 drawer key. Add `<Loading/>` placeholder.
9. Write `build/icon.svg` + `build-icons.mjs`, run it to produce `build/icon.png`.
10. `npm start` smoke test (full manual checklist above).
11. `npm run build` → verify `.deb` is produced.
12. `sudo dpkg -i` → launch from menu → final sanity check.

## 16. Risks & open questions

- **Babel-standalone transpile time on launch** (~200 ms for a 1500-line file). Acceptable for v1. If it becomes annoying we can add a precompile step later (switch to path C from the brainstorm).
- **electron-builder first-run download size** — it fetches Electron's Linux binaries (~150 MB). One-time; cached in `~/.cache/electron`. Heads-up only.
- **`notes.json` size over time** — each note is small; even 1000 notes is well under 1 MB. Debounced whole-file writes stay cheap. No pagination needed.
- **Concurrent edits from multiple app instances** — not a concern: the README specifies single-window. If user opens two copies pointing at the same file, last-write-wins. Acceptable.
- **macOS code signing** — unsigned `.dmg` triggers Gatekeeper warning (right-click → Open bypasses it). Free. Paid path (Apple Developer $99/yr + notarization) is out of scope but documented in the README as a follow-up.

---

**Next:** once approved, transition to the `superpowers:writing-plans` skill to produce the detailed step-by-step implementation plan.
