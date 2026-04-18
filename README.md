# Sticky Notes

A spatial sticky-notes desktop app for **Linux** and **macOS**, also runnable in any **browser**. Each folder is its own canvas; notes drag, link, multi-select, zoom, and pan freely.

Built with Electron + React. Notes persist to a local JSON file (Electron) or the browser's `localStorage` (web). No account, no server, no telemetry.

---

## Install

### Pre-built downloads (recommended)

Grab the latest from [**Releases**](https://github.com/faridjaff/sticky-notes/releases/latest) and pick the file for your platform:

| Platform | File | How to install |
|---|---|---|
| **Ubuntu / Debian** | `sticky-notes_<ver>_amd64.deb` | `sudo dpkg -i sticky-notes_<ver>_amd64.deb` |
| **Linux (portable)** | `Sticky Notes-<ver>.AppImage` | `chmod +x` and double-click — no install needed |
| **macOS — Apple Silicon (M-series)** | `Sticky Notes-<ver>-arm64.dmg` | mount → drag to `/Applications` |
| **macOS — Intel** | `Sticky Notes-<ver>.dmg` | mount → drag to `/Applications` |

#### macOS Gatekeeper note

The Mac builds aren't code-signed (no Apple Developer cert). On first launch macOS may say *"Sticky Notes is damaged and can't be opened"*. The app isn't damaged — Gatekeeper just blocks unsigned downloads. To clear the quarantine flag once:

```bash
xattr -cr /Applications/Sticky\ Notes.app
```

If your Mac is managed by an organization (corporate MDM) and that command is blocked, **build from source** instead — locally-built apps don't get the quarantine flag.

### Web (no install)

Hosted version: <https://faridjaff.github.io/sticky-notes/>. Each visitor's notes live in their own browser's `localStorage` — separate from any other browser, separate from the desktop app. Survives refresh; cleared if you wipe site data.

---

## Build from source

### Prerequisites

- **Node.js 20+** and **npm**
- **macOS only:** Xcode Command Line Tools — `xcode-select --install`
- **Linux only:** nothing extra; `electron-builder` fetches `fpm` (for `.deb` packaging) on first build

### Clone and install

```bash
git clone git@github.com:faridjaff/sticky-notes.git
cd sticky-notes
npm install
```

### Run in dev mode (no install needed)

```bash
npm start
```

Electron launches the app directly from source. Quit with Cmd/Ctrl+Q.

### Build installable artifacts

```bash
# Linux: produces .deb + .AppImage in dist/
npm run build:linux

# macOS: produces .dmg + .zip for both arm64 and x64 in dist/
npm run build:mac
```

Then install whichever file fits your machine (see the table above).

---

## Where your notes live

| | Path |
|---|---|
| Linux | `~/.config/sticky-notes/notes.json` |
| macOS | `~/Library/Application Support/sticky-notes/notes.json` |
| Browser | `localStorage` key `stickies.all` |

The JSON format is identical across all three — export from one, import into another. Use **Backup ▾ → Export Notes…** in the top chrome to download a portable JSON; **Import Notes…** to load one back.

---

## Keyboard shortcuts

| | |
|---|---|
| `Ctrl/Cmd+,` | Open Preferences (themes, font, density, tilt) |
| `Ctrl/Cmd+Shift+E` | Export notes (Electron only) |
| `Ctrl/Cmd+O` | Import notes (Electron only) |
| `Ctrl/Cmd+F` | Focus search box |
| `N` | Create a new note |
| `Delete` / `Backspace` | Delete the selected note(s) |
| `Esc` | Clear selection |
| `Space + drag` | Pan the canvas |
| Wheel / scroll | Zoom canvas (no modifier needed) |
| `Ctrl/Cmd + click` | Toggle a note in/out of multi-selection |

---

## License

[MIT](LICENSE) — © 2026 faridjaff.
