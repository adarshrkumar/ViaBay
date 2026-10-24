# ViaBay — Codebase Audit

**Audit date:** 2026-10-23
**Repository:** ViaBay (Bay Area transit companion)
**Stack:** Astro 5 (SSR, Vercel adapter), TypeScript, SCSS, Leaflet + Leaflet Routing Machine, 511.org API
**Scope:** All source under `src/`, build/config files, public assets, dependency tree, and documentation. `node_modules/` was not audited line-by-line.
**Method:** Manual source review, cross-referencing of client/server contracts, `npm audit`, and attempted `astro check` / `astro build`.

---

## 1. Executive summary

ViaBay is a small (~1,500 lines of hand-written source) but ambitious app. The core live-tracker concept is implemented and reasonably structured for a prototype: SSR API proxy, dynamic script loading, a Leaflet map, and a 511.org integration. However, the repository is **not production-ready**.

**Overall grade: D / "prototype, do not ship."** The tracker UI is the only complete feature.

---

## 2. Severity overview

| Severity | Count | Themes |
| --- | --- | --- |
| Critical | 0 | |
| High | 1 | Unverifiable build |
| Medium | 0 | |
| Low | 1 | Indirect script loading |

---

## 3. High findings

### H4. Build and type-check cannot be verified

- `npx astro check` timed out after **240 s** with no output.
- `npx astro build` ran for **>10 minutes** with a 0-byte log and had to be killed.
- Likely cause: the repository lives under `~/Library/CloudStorage/GoogleDrive-...`, and Vite/Astro file crawling over the virtual filesystem can stall. It could also be an unresolved plugin/remote fetch, but no error is emitted. This is unconfirmed.

**Action:** Clone to a local disk (not CloudStorage) and run `npm ci && npx astro check && npm run build`. Treat "build is green" as a prerequisite for every release. CI for this is tracked in #14.

---

## 4. Low / code-quality findings

| # | Finding | Location |
| --- | --- | --- |
| L15 | `Layout.astro` imports page scripts per SSR request via dynamic `import`; fine for caching but needlessly indirect versus static imports | `Layout.astro:11-14` |

---

## 5. Architecture assessment

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

## 6. Prioritized remediation plan

### Do first (blockers)

1. Verify `astro build` and `astro check` pass on a local-disk clone (H4).

---

## 7. Verification notes

- **`npx astro check`**: timed out at 240 s, no output.
- **`npx astro build`**: ran >10 minutes with an empty log; killed. Not evidence of a code failure — likely filesystem/CI environment — but it means build health is currently unproven.
- `node_modules/` was not exhaustively audited; dependency findings come from `npm audit`.

---

Note: this audit was performed by static review. Runtime behavior of live 511.org responses and the Vercel deployment was not exercised.
