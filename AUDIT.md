# ViaBay — Codebase Audit

**Audit date:** 2026-10-23
**Repository:** ViaBay (Bay Area transit companion)
**Stack:** Astro 5 (SSR, Vercel adapter), TypeScript, SCSS, Leaflet + Leaflet Routing Machine, 511.org API
**Scope:** All source under `src/`, build/config files, public assets, dependency tree, and documentation. `node_modules/` was not audited line-by-line.
**Method:** Manual source review, cross-referencing of client/server contracts, `npm audit`, and attempted `astro check` / `astro build`.

---

## 1. Executive summary

ViaBay is a small (~1,500 lines of hand-written source) but ambitious app. The core live-tracker concept is implemented and reasonably structured for a prototype: SSR API proxy, dynamic script loading, a Leaflet map, and a 511.org integration. However, the repository is **not production-ready** and has several issues that should be fixed before any public deployment:

1. **A live 511.org API key is hardcoded in source and committed to git history** (`src/pages/api/511.ts:5`, commit `973cb90`). It must be treated as compromised and rotated.
2. **The `/api/511` route is an unauthenticated, unvalidated, uncached proxy** to a paid/rate-limited upstream, allowing anyone to exhaust the key and interpolating an attacker-controlled `module` value into the upstream URL.
3. **Authentication is cosmetic.** A password is base64-encoded into `localStorage`, `checkAuthentication()` always returns true for non-empty input, and the route guard is commented out. The login flow is also an open redirect.
4. **User/third-party data is written to `innerHTML` unescaped** in the tracker, modal, and directions code, creating a DOM XSS surface.
5. **Only `/tracker` is actually built.** The other pages intentionally redirect to `/tracker` because they are not ready; that is fine, but the footer nav still linked to `/directions` and `/settings` (now removed), and the README advertises them as shipped.
6. **The build cannot be verified in this environment**: both `npx astro check` and `npx astro build` hung for 4–10+ minutes with no output. This needs investigation (likely the CloudStorage/Google Drive working directory, but it should be confirmed on a normal checkout/CI).
7. **29 npm vulnerabilities** (2 critical, 22 high) exist in the dependency tree, mostly in the Vite/dev toolchain.

**Overall grade: D / "prototype, do not ship."** The tracker UI is the only complete feature. Security, correctness, and documentation all need work before the README's claims are true.

---

## 2. Severity overview

| Severity | Count | Themes |
| --- | --- | --- |
| Critical | 4 | Secrets, open proxy, fake auth, XSS |
| High | 5 | Broken settings/notifications, geo API abuse, unverifiable build, vulnerable deps |
| Medium | 15 | Unbuilt pages exposed in nav, error leakage, caching/rate limits, CDN trust, dead globals, event bugs, accessibility |
| Low | 16 | Dead code, duplicate files, unused assets, no CI |

---

## 3. Critical findings

### C1. Hardcoded 511.org API key (committed)

**Location:** `src/pages/api/511.ts:5`

```ts
const apiKey = '7a7f827d-6d7d-451e-a9a6-bcc517c951b9'
```

- The key is present in the current tree and in git history (`git log -S` → commit `973cb90`).
- `dotenv` is imported in `astro.config.mjs` but never used for this value, so there is no environment-variable path at all.
- Because it is in a public repo, assume it is compromised.

**Action:** Rotate the key immediately at 511.org, remove it from history (e.g. `git filter-repo`), and read it from `import.meta.env` / `process.env`. Add `.env` to `.gitignore` (already present) and document the variable. A leaked key can burn the shared rate limit and, depending on the account, incur cost.

### C2. Unauthenticated, unvalidated upstream proxy (quota exhaustion + URL injection)

**Location:** `src/pages/api/511.ts:45-93`, URL built at `:18`

- Any anonymous client can call `/api/511?module=...&params=...` with arbitrary values.
- `moduleName` is interpolated directly into `https://api.511.org/transit/${moduleName}?...` with **no allowlist**. This permits path/query manipulation and lets callers reach any 511 endpoint the key can access.
- `params` is `JSON.parse`d and joined without validating shape. A non-array element (e.g. `[1]`) makes `p.join` throw and returns a 500 (see also M1). Parameter names/values can contain `&`/`=` and inject extra query parameters.
- There is no authentication, no per-IP rate limit, no module allowlist, and no request-size limit. A single script can drain the 511 quota and take the app offline.
- `Cache-Control: no-cache` (`:82`) plus no server-side cache means every client poll hits 511 directly.

**Action:** Allowlist modules (`gtfsoperators`, `VehicleMonitoring`, `patterns`, …), validate each param against a per-module schema, add rate limiting (Vercel WAF/Upstash/KV), add a short server-side cache (10–30 s) with SWR, and return opaque 4xx/5xx errors without upstream bodies.

### C3. Authentication is cosmetic and the guard is disabled

**Location:** `src/scripts/authentication.astro`, `src/pages/login.astro`

- `checkAuthentication(u, p)` returns `true` whenever both strings are non-empty (`authentication.astro:15-18`) — any email/password "works".
- The password is stored as `btoa(password)` in `localStorage` (`:24`), which is reversible encoding, not encryption or hashing. Any XSS (see C4) reads it instantly.
- The actual route guard is commented out (`:11-13`), so every page is public.
- `setCredentials` redirects to an arbitrary `dest` query parameter (`:27`), and `login.astro:38` reads it straight from the URL → **open redirect** to any origin, useful for phishing.
- The login form is a `<div role="form">` with an `onclick` button; Enter does not submit and there is no `required` enforcement before calling `setCredentials`.

**Action:** Either remove the login UI (if auth is out of scope) or implement real server-side sessions (HttpOnly/Secure/SameSite cookies, hashed passwords, a real auth library). Restrict `dest` to same-origin relative paths.

### C4. DOM XSS via unescaped `innerHTML`

#### Affected files

- `src/scripts/tracker.astro:143-171` (nearby-vehicle list: `route`, `lineName`, `destination`)
- `src/scripts/tracker.astro:457-476` and `:549` (vehicle title, origin/destination, stop names)
- `src/scripts/directions.astro:139-143` (route summary)
- `src/scripts/modal.astro:6` (`showModal` writes arbitrary `content` to `.message`)
- `src/layouts/Layout.astro:78` (`set:html={headItems}` — prop is currently unused, but the escape hatch exists)

These values originate from the third-party 511 feed (route names, stop names, origins/destinations) and from `localStorage` notifications. A compromised/misbehaving upstream, or HTML in a stop name, executes script in the app origin. That is enough to steal the base64 "password" (C3) and manipulate the map/data.

**Action:** Build DOM nodes with `textContent`/`createElement`, or sanitize with DOMPurify before assigning `innerHTML`. Gate `set:html` behind trusted, server-controlled input only.

---

## 4. High findings

### H1. Settings logic cannot store or read more than one setting

**Location:** `src/scripts/settings.astro`

- `filterCheck` (`:59-61`) **ignores its input and always matches `name === 'theme'`**. Both `setSetting` and `applySettings` use it, so any setting name resolves to the theme item.
- `applySettings` (`:48-55`) does `settings.filter(filterCheck)[0].content` whenever `settings.length > 0`. If the stored array contains any non-theme setting (or is corrupted), `[0]` is `undefined` and this **throws**, breaking the rest of the script.
- `applySettings` (`:44-45`) calls `settingFunctions[s.name]` with no existence check — one unknown key in `localStorage` breaks the page.
- `applySettings()` is invoked twice (`:9` inside DOMContentLoaded and `:35` at parse time), and at `:35` the `<setting-option>` nodes do not exist yet.
- The `type`/`key` branches (`object`, `list`) are never exercised; the API is speculative.

**Action:** Key settings by name (`settings.find(s => s.name === name)`), guard unknown names, call `applySettings` once after DOM ready, and add a schema/migration for the localStorage blob.

### H2. Notifications feature is broken at every layer

**Locations:** `src/scripts/notifications.astro`, `src/scripts/notification-manager.astro`

- `JSON.parse(notificationList || '')` (`notifications.astro:6`) throws `SyntaxError` when the key is absent — the common case.
- The loop iterates the parsed array while calling `.shift()` on it (`:9-12`), which **skips every other entry**.
- Producer/consumer schemas disagree: `notification-manager` stores `{module, name, icon, content}` and an array of `"module|name"` strings; `notifications.astro` expects an array of objects and reads `.icon/.title/.content`.
- `localStorage.removeItem(\`NOTIFICATIONS://${name}\`)` uses the array element (an object) → key becomes `[object Object]`, so the per-notification item is never removed.
- `photo`/attachment info is accepted but never used; icons are assumed to exist as `/icons/{name}.svg` (some referenced icons do exist, but arbitrary names 404).
- The only consumer page (`/notifications`) redirects away (M15), so none of this is reachable today — but the broken code is still bundled.

**Action:** Pick one schema, parse defensively (`try/catch`, default `[]`), iterate with `for...of` without mutating, and remove by the exact key used at write time.

### H3. Directions stop management corrupts option indices

**Location:** `src/scripts/directions.astro`

- New stops are wired with `stop.addEventListener('keypress', e => stopChange(e, stopsAmt - 1))` (`:163-165`). With the initial two stops, `stopsAmt = 2`, so the third stop passes index `1` — the **previous** stop's index. Autocomplete results attach to the wrong row.
- After removal (`onCloseClick`, `:199-202`), `reorderStops` only updates placeholders (`:204-208`); the `onchange`/`keypress` closures still hold old indices. Any stop removed from the middle permanently desynchronizes the form.
- Removal traverses `.parentNode.parentNode.parentNode` (`:200`) with no guard; if markup changes, this removes the wrong element.
- Geocoding is triggered on every `onchange`/`keypress` (`:163`, `:211`, `:226`) with no debounce, no request cancellation, and no Nomatim `email`/`User-Agent` identification — this violates the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and will get the app blocked under load.
- Routing uses the default Leaflet Routing Machine router (public OSRM demo server) — no `router` configured, no SLA, and a usage policy that forbids production traffic.

**Action:** Re-key stops by stable IDs, read indices from the DOM at event time, debounce + abort geocodes (≥1 s), set an identifying `email`/UA, and self-host/route via a paid or self-hosted OSRM instance.

### H4. Build and type-check cannot be verified

- `npx astro check` timed out after **240 s** with no output.
- `npx astro build` ran for **>10 minutes** with a 0-byte log and had to be killed.
- Likely cause: the repository lives under `~/Library/CloudStorage/GoogleDrive-...`, and Vite/Astro file crawling over the virtual filesystem can stall. It could also be an unresolved plugin/remote fetch, but no error is emitted. This is unconfirmed.

**Action:** Clone to a local disk (not CloudStorage) and run `npm ci && npx astro check && npm run build` in CI. Treat "build is green" as a prerequisite for every release. The repo currently has **no CI workflow**, so nobody would notice.

### H5. Vulnerable dependencies

`npm audit --omit=dev` reports **29 vulnerabilities: 2 critical, 22 high, 4 moderate, 1 low**. Highlights:

- Vite dev-server arbitrary file read / cross-origin script execution (`GHSA-p9ff-h696-f583`, `GHSA-9jrq-w75r-8gcw`, others)
- `launch-editor` Windows command-execution class issues
- `yaml` stack-overflow DoS (`GHSA-48c2-rrv3-qjmp`)

Most are in the build/dev toolchain (Vite, Astro's transitive deps), so production exposure is limited, but they matter for developer machines and CI. `npm audit fix` is available; a major Astro upgrade may be required for all.

**Action:** Run `npm audit fix`, then assess breaking updates; pin and monitor with Dependabot/Renovate.

---

## 5. Medium findings

### M1. API route leaks upstream error bodies and crashes on malformed params

`src/pages/api/511.ts:26-27, 74-92`

- The 511 response body (first 200 chars) is returned to the client inside a 500. Upstream errors can reveal internal details.
- `params` is typed `string[][]` but `JSON.parse` accepts anything; `p.join` throws on a non-array, producing an unhandled 500 rather than a 400.
- No cap on `params` length or total URL length.

### M2. No caching / thundering herd against 511

Every tracker load calls `gtfsoperators`, then **one `VehicleMonitoring` request per agency** (`tracker.astro:185-194, 408`), every 60 s. With ~20+ operators that is 20+ upstream requests per client per minute. The client backoff only reacts to 429 (`511-request.astro:25-33`), retries indefinitely with a growing delay, and never surfaces failure to the user. Server-side caching and request coalescing are needed; a single "all vehicles" strategy (if the API supports it) would be far better.

### M3. Client-side rate-limit backoff can deadlock the UI

`src/scripts/511-request.astro`

- `requestDelay` is module-global and grows to 32 s, but the retry calls `makeRequest` recursively; there is no attempt cap and no jitter. Every queued request sleeps behind the same delay.
- Errors are swallowed (`:53-55`); the map silently shows stale/no vehicles.

### M4. Malformed markup in `<head>` and dead props

`src/layouts/Layout.astro`

- `headItems` is typed as `[]` (an empty tuple) yet rendered as a `<div>` inside `<head>` (`:19, 46-51, 78`). Both the type and the element are wrong; a `<div>` in `<head>` is invalid and may be relocated by browsers.
- `classItemsArray.length < 0` and `headItemsArray.length < 0` (`:38, :47`) can never be true — dead code.
- `classItemsArray.unshift(...)` mutates the caller's `Astro.props` array.
- `sTitle={sTitle}` on `<body>` (`:88`) emits a meaningless `stitle="ViaBay"` attribute; the adjacent `@ts-ignore` hides the type error.
- `canonicalUrl` (`:58-62`) includes the query string, so `?foo=1` produces a duplicate canonical URL. Canonicalization should strip query strings and normalize trailing slash.
- `<h1>` renders the raw `title` prop; combined with the client-side suffix-stripping in `index.astro:2-14`, this duplicates title logic in two places.

### M5. Duplicate/overwritten global functions and dead globals

- `assertError` is defined in `index.astro:67` and again in `directions.astro:9`; each overwrites `window.assertError`, so behavior depends on load order (both are loaded on the tracker? only index; directions is dead).
- `window.onMapLoad` is declared in `env.d.ts` and called by `directions.astro:60`, but **never assigned anywhere** — dead branch.
- `window.positionInterval` is assigned `null` at `tracker.astro:3` before `GetMap()` ever sets the local variable; `window.positionInterval` therefore stays `null` forever. The real interval leaks on navigation and is never cleared.
- `window.allPins`, `window.directionsElement`, `window.directionsManager`, `window.findUsingValueofKey`, `window.showRoutePath` are unused or stubs (`showRoutePath` is an explicit TODO at `:563-567`).

### M6. Ghost vehicle markers

`src/scripts/tracker.astro:224-239, 306-330`
Pins are filtered into `goodPins` and the `pins` map is rebuilt, but markers that disappeared from the feed are **never removed from the map**. Vehicles that finish their run remain rendered until reload. `aObj.vehicles.pins` also leaks `VehicleMarker` objects referencing the map.

### M7. Fragile assumptions about API payloads

- `res.forEach` (`tracker.astro:187`), `vehicleData.forEach` (`:226, :241`), and `journeyPatterns.filter` (`:499`) assume arrays/objects that are not guaranteed. A single malformed upstream response throws inside a callback and aborts the whole update with no user feedback.
- `vehicleActivity.VehicleLocation` is assumed present before `vehicleLatLng` (`:246-247`).
- Colors overflow is handled by subtracting `colors.length` once (`:189`); with more agencies than colors it can go negative.

### M8. API key/URL logging noise

`src/pages/api/511.ts:11, 19, 22, 46-48, 66, 87` logs on every request, including query parameters. The key is redacted, but full request URLs and params are not. This is noisy and leaks caller input into logs.

### M9. Custom select is not keyboard accessible and has a logic bug

`src/scripts/select.astro`

- `while (!e.className.includes('select')) e = e.parentNode as HTMLElement` (`:9`) has no null guard: a click inside a `.select` lacking a `.select` ancestor throws; elsewhere it can loop on `undefined`.
- `if (!!(e.target)?.getAttribute('disabled') === false)` (`:16`) is always truthy for both `null` (enabled) and `''` (disabled), so the disabled placeholder is selectable and triggers the fare-panel logic.
- `<select-option>`/`<select-options>` are non-semantic custom elements with click handlers only — no `role`, `tabindex`, arrow-key support, or `aria-expanded`. The real `<select>` in settings is separate and fine.

### M10. Modal accessibility and injection

`src/scripts/modal.astro`

- Uses native `<dialog>`/`showModal()` (good) but wraps content in a non-standard `<content>` element (`Layout.astro:120`) and always renders an "OK" button even for informational messages.
- No focus restoration, and `innerHTML` injection is C4.
- Click-outside detection via `getBoundingClientRect` is correct but untested for scroll/zoom.

### M11. Missing security headers and platform config

No `vercel.json` / `headers` configuration, no CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. Given the number of inline handlers (`onclick="login()"`, `openSelection(this)`), a strict CSP will require refactoring.

### M12. Cookies are not hardened and unused

`src/scripts/cookies.astro`
`setCookie` writes `name=value;expires=...;path=/` with no `Secure`, `SameSite`, or encoding. It is never called anywhere, so the safest action is deletion.

### M13. Third-party assets loaded without integrity

`src/layouts/Layout.astro:71-75, 84-85`

- Google Fonts and `leaflet-routing-machine` CSS/JS have no SRI. Leaflet core does have SRI (good), but the routing plugin does not.
- Both the map tiles (OpenStreetMap in tracker, Wikimedia in directions) are used under their public usage policies; Wikimedia explicitly warns against production use without permission. There is no tile-provider abstraction or fallback.
- `@vercel/analytics` is fine.

### M14. Settings "system" theme is not represented in CSS

`setTheme` writes `data-theme="system"` (`settings.astro:23`), but `globals.scss` defines only `[data-theme="light"]` / `[data-theme="dark"]`. "System" works only because the attribute matches neither and the `prefers-color-scheme` media queries apply. That is accidental; add an explicit `[data-theme="system"]` contract or remove the attribute for system mode.

### M15. Unfinished pages are redirected (by design) — keep them unlinked

`/tracker` is the only built feature. `index`, `directions`, `settings`, `book`, `more`, and `notifications` are placeholders that unconditionally redirect to `/tracker` in frontmatter (`index.astro:4`, `directions.astro:10`, `settings.astro:11`, `book.astro:8`, `more.astro:9`, `notifications.astro:13`). Redirecting is the correct guard for features that are not ready: an unbuilt page must not be reachable from within the app.

The defect was that the footer nav still linked to `/directions` and `/settings` (`Layout.astro:101,113`), so users could click into unfinished screens and be bounced back. Those two links are now commented out alongside `book`/`notifications`/`more`, so no unbuilt page is reachable from within the app.

Remaining cleanup:

- The README still advertises directions, booking, notifications, transit cards, fare prediction, reminders, and preferred routes as available features.
- The redirected pages and their page-specific SCSS still build, even though their bodies never render.
- `/login` has no redirect, but nothing links to it; decide whether it stays.

**Action:** Keep unbuilt routes unlinked until they ship, update the README to separate "planned" from "available", and delete or gate the dead page bodies/styles.

---

## 6. Low / code-quality findings

| # | Finding | Location |
| --- | --- | --- |
| L1 | Overriding Leaflet internals (`.leaflet-map-pane { width/height: fit-content }`) can break panning/layout | `src/styles/pages/tracker.scss:60-65` |
| L2 | `width: fit-content` applied after `-webkit-fill-available` in several places, likely collapsing containers | `tracker.scss:135-137`, `directions.scss:7-9, 210-212` |
| L3 | `sass` and `sass-embedded` both installed; pick one implementation. Build-only packages (`@astrojs/check`, `typescript`, `sass`, `sass-embedded`, `@types/*`) belong in `devDependencies` | `package.json` |
| L4 | `dotenv` added but only used to load an unused env file; the key is hardcoded | `astro.config.mjs:3`, `package.json` |
| L5 | `SECURITY.md` is the stock GitHub template with irrelevant versions (5.1.x/5.0.x/4.0.x) and no contact | `SECURITY.md` |
| L6 | README advertises unimplemented features: booking, notifications, transit cards, fare prediction, reminders, preferred routes; and lists routes that redirect | `README.md` |
| L7 | Large unused assets: `gMaps.png` (~690 KB), `ViaBay_logo-full.jpg` (~440 KB) | `public/assets/` |
| L8 | `public/ef3-placeholder-image.svg` appears unused | `public/` |
| L9 | Commit messages are all `u`; history is uninformative | `git log` |
| L10 | `showRoutePath` shipped as a TODO stub; `findUsingValueofKey` unused | `tracker.astro:563-574` |
| L11 | `any` used for the 511 payload and settings content; `env.d.ts` declares several globals that are never actually set | `511.ts:10`, `settings.astro:27-28`, `env.d.ts` |
| L12 | `[onclick]` global cursor rule and inline handlers make the UI hard to test and CSP-hostile | `globals.scss:97-99` |
| L13 | `assertError` uses blocking `alert()` for user-facing errors | `index.astro:70`, `directions.astro:11` |
| L14 | `alt`/`aria-label` missing on all nav icon links and the login logo; nav links have no accessible name | `Layout.astro:98-115`, `login.astro:8` |
| L15 | `Layout.astro` imports page scripts per SSR request via dynamic `import`; fine for caching but needlessly indirect versus static imports | `Layout.astro:11-14` |
| L16 | The tracker's "nearby vehicles" feature has no loading/error state and always reports a hard-coded 1.5-mile radius | `tracker.astro:99-181` |

---

## 7. Accessibility snapshot

The UI is visually considered (design tokens, focus-within states, reduced-motion handling) but semantically weak:

- Nav is `<nav hidden>` until JS removes `hidden`; with JS disabled, navigation disappears entirely.
- Icon-only links have no `alt`, `aria-label`, or visible text → screen readers announce nothing useful.
- Custom select (`<select-option>`) is mouse-only; no keyboard/focus/ARIA support.
- Login is a `div[role=form]`, not a `<form>`; no Enter-to-submit, no visible validation errors, no error announcement.
- `<dialog>` usage is good, but content is injected via `innerHTML` and the only action is "OK".
- Live vehicle updates and notification counts have no `aria-live` region.
- Placeholder-only inputs in directions rely on color contrast (`rgba(255,255,255,0.7)` on an accent background); verify WCAG AA.
- `<html lang="en">` and viewport meta are present (good).

---

## 8. Architecture assessment

### Strengths

- Clear separation: SSR API proxy ↔ client request helper ↔ feature scripts.
- Vercel adapter and SSR configured correctly for server routes.
- Sensible SCSS token system (`variables.scss` → CSS custom properties) and theme support.
- Single shared layout, consistent per-page style/script convention.
- The 511 double-encoded-JSON handling (`511.ts:30-40`) is a real-world detail handled correctly.
- Haversine nearby-vehicle logic and marker reuse/caching show good intent.

### Weaknesses

- Global mutable `window` namespace instead of ES modules; `env.d.ts` is a hand-maintained contract that already lies (dead globals).
- Business logic lives in large inline scripts (`tracker.astro` 575 lines, `directions.astro` 272) with no unit-testable seams.
- Duplicate concepts: two notification systems, two `assertError`s, two map initializers, two tile providers.
- Server and client contracts (`params` JSON shape, notification schema) are implicit and untested — they already disagree.
- No error boundary: a thrown callback aborts the update loop with no retry or UI state.
- Page-level redirects leave dead code and dead styles in the bundle.

---

## 9. Prioritized remediation plan

### Do first (blockers)

1. Rotate the 511 key; purge it from git history; load from env (C1).
2. Lock down `/api/511`: allowlist modules, validate params, add auth/rate limiting and server-side caching (C2).
3. Escape or sanitize every `innerHTML` sink; build nodes with `textContent` (C4).
4. Remove or implement real auth; fix the `dest` open redirect (C3).
5. Keep unbuilt routes unlinked until they ship, and align the README/feature claims (M15).
6. Verify `astro build` and `astro check` pass on a local-disk clone; add CI (H4).

### Next

1. Rewrite settings key lookup and make `applySettings` defensive (H1).
2. Fix notifications schema/iteration (H2) or delete the feature.
3. Fix directions stop indexing + debounce/abort geocoding + set a Nominatim UA (H3).
4. `npm audit fix` and plan the Astro/Vite upgrade (H5).
5. Stop leaking upstream error bodies (M1); add payload validation (M7).
6. Remove ghost markers and clear intervals on teardown (M5, M6).

### Then

1. Replace custom select with a native/accessible control; add ARIA labels to nav (M9, §7).
2. Clean up layout props/canonical/body attribute and dead code (M4, L1–L2).
3. Fix docs: README feature list, SECURITY.md, remove unused assets/data (L5–L8).
4. Add assertions to the placeholder browser tests, wire `npm run check` and the Playwright suite into CI.

---

## 10. Verification notes

- **`npm audit --omit=dev`**: 29 vulnerabilities (1 low, 4 moderate, 22 high, 2 critical).
- **`npx astro check`**: timed out at 240 s, no output.
- **`npx astro build`**: ran >10 minutes with an empty log; killed. Not evidence of a code failure — likely filesystem/CI environment — but it means build health is currently unproven.
- **Git**: key present in `HEAD` and in history (`973cb90`). No `.env` files tracked.
- **Asset check**: icon files are non-empty (an early `wc -l` artifact); `price.json`, `gMaps.png`, and `ViaBay_logo-full.jpg` are unreferenced.
- `node_modules/` was not exhaustively audited; dependency findings come from `npm audit`.

---

Note: this audit was performed by static review. Runtime behavior of live 511.org responses and the Vercel deployment was not exercised.
