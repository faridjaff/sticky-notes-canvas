# Web-hosted demo with per-browser local storage

**Captured:** 2026-04-17
**Status:** Noted — not planned, not scheduled.

## What the user said

> "Maybe I wanna demo this to other people. So I'm thinking maybe there should be a way to host this thing on a website. They can use it but their data goes to their browser memory — if they refresh it stays. But if they open another browser it's not there so it's basically local to the browser that they are using. And I don't get that data, but it's on their browser. Does that make sense? Is our project structured to support that?"

## The idea in one line

Publish the standalone browser version of Sticky Notes at a public URL (e.g. `stickynotes.faridjafri.com` or a GitHub Pages site). Each visitor's notes persist in **their own browser's `localStorage`**, survive refresh, do not sync across browsers or devices, and are never visible to the project owner.

## Is the current architecture already set up for this?

**Yes.** The `useStickyStore` hook added in this packaging refactor (see `docs/superpowers/specs/2026-04-17-sticky-notes-electron-design.md` §10) already has a dual path:

```js
if (window.stickyAPI) {
  loaded = await window.stickyAPI.load();     // Electron path
} else {
  loaded = JSON.parse(localStorage.getItem('stickies.all') ?? '{}');
}
```

When the HTML is served from a web host — no Electron, no `window.stickyAPI` — the fallback automatically kicks in and uses `localStorage`. No code change needed to the app itself.

## What would need to happen when we actually ship this

1. **Pick a host.** Options:
   - GitHub Pages (free, custom domain via CNAME).
   - Netlify / Vercel / Cloudflare Pages (drag-drop or git-auto-deploy).
   - Self-hosted nginx on a VPS.
2. **Decide what to publish.** Two options:
   - (a) The already-existing `Sticky Notes (standalone).html` — single-file, self-contained, easiest to host. **Downside:** it's a separate artifact that might drift from the Electron source.
   - (b) The live `Sticky Notes.html` + `app.jsx` + `vendor/`. Closer to source of truth; host just needs to serve static files. Needs CORS-friendly font CDN or vendored fonts.
3. **Confirm localStorage key.** The fallback writes one blob to `stickies.all`. Matches the design. No migration needed.
4. **Add a one-line "Export JSON" button in the top chrome** so demo users can save their work before closing, without needing browser devtools. (Already planned in the IPC design for Electron; the browser version could reuse the same JSON format — trigger a download instead of a native dialog.)
5. **Optional: a small banner** on the hosted version explaining "your notes stay in your browser — clearing site data erases them."
6. **Analytics?** Probably not. The pitch is "your data stays with you." Don't add Google Analytics / tracking; it undercuts the message. A server-side access log is fine.

## Constraints the user cares about

- **No data collection.** Visitor notes never leave their browser.
- **Resilience to refresh.** `localStorage` persists across refresh and tab close in the same browser.
- **Browser isolation.** Different browsers / devices / incognito = different datasets. Not a sync feature; a demo isolation feature.

## Rough effort estimate

- If going with standalone single-file: **30–60 minutes** end-to-end (regenerate the standalone, push to GitHub Pages, test).
- If going with multi-file + custom domain: **1–2 hours** (routing, CORS for font loading, DNS).

## When to revisit

User will say something like "let's demo this" or "let's host this" or "remember the web-hosted idea". When that happens, open this file — it's all here.
