# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ViaBay is a Bay Area transit tracking web application built with Astro. It provides real-time vehicle tracking, directions, and transit information using the 511.org API and Leaflet Maps.

## Common Commands

All commands run from the root of the project:

```bash
# Install dependencies
npm install

# Start local dev server at localhost:4321
npm run dev

# Build production site to ./dist/
npm run build

# Preview production build locally
npm run preview

# Type-check all Astro and TypeScript files
npx astro check
```

## Architecture

### Framework & Structure

- **Astro 5.x** with **Vercel adapter** - SSR-enabled with server API routes
- **Pages**: `src/pages/*.astro` - File-based routing
- **API Routes**: `src/pages/api/*.ts` - Server-side endpoints (`prerender: false`)
- **Layout**: `src/layouts/Layout.astro` - Single shared layout component
- **Styling**: SCSS in `src/styles/` with `globals.scss` as the base
- **Client Scripts**: `src/scripts/*.astro` - All `<script is:inline>` components
- **Type declarations**: `src/env.d.ts` - Global `Window` interface augmentations
- **Deployment**: Configured for Vercel (`output: 'server'` in `astro.config.mjs`)

### Application Flow

1. **Landing/Login**: `/` redirects to `/tracker`, which redirects to `/landing`

2. **Main Routes**:

   - `/tracker` - Live vehicle tracking map (dev-only; redirects to `/landing` in production)
   - `/directions` - Multi-stop route planning
   - `/settings` - Theme and app settings
   - `/notifications`, `/book`, `/more` - Additional features

### Key Technical Components

**511.org API Integration** - Two-tier architecture:

- **Server-side** (`src/pages/api/511.ts`):
  - Single API key; handles double-encoded JSON responses
  - Returns standard JSON to client
- **Client-side** (`src/scripts/511-request.astro`):
  - `makeRequest(moduleName, params, callback)` - Fetches from `/api/511`
  - Exponential backoff for 429 rate-limit responses (1s → 32s max)

**Map System** (Leaflet-based):

- Leaflet 1.9.4 + Leaflet Routing Machine loaded from CDN in `Layout.astro`
- Nominatim (OpenStreetMap) for geocoding in directions
- Real-time vehicle tracking with custom `L.divIcon` markers, color-coded per agency/route
- SF Muni lines have custom colors defined in `customColors` in `src/scripts/tracker.astro`

**Script Loading Pattern** (`src/layouts/Layout.astro`):

- **Main scripts** dynamically imported and rendered on every page: `cookies`, `index`, `authentication`, `511-request`, `notification-manager`, `settings`
- **Page-specific scripts** are imported statically at the top of each page `.astro` file and rendered as `<ComponentName />` after the `<Layout>` block (see `tracker.astro` / `directions.astro`)
- All scripts use `<script is:inline>` — Astro does not process or bundle them
- `modal.astro` and `select.astro` are additionally imported directly in Layout

**Global Functions / Window Augmentation**:

- Functions meant to be called across scripts are assigned to `window` immediately after their definition (e.g. `window.makeRequest = makeRequest`)
- All `window.*` properties are declared in `src/env.d.ts` under `interface Window`

**Settings System** (`src/scripts/settings.astro`):

- LocalStorage-based with key `'settings'`
- Current features: theme switching (system/light/dark)
- Pattern: `setSetting(name, value, type, key)` + `applySettings()`

### State Management

- **No framework**: Pure JavaScript with DOM manipulation
- **LocalStorage**: Settings and auth persistence
- **Global variables**: Agency data, map instance, vehicle pins — shared via `window.*`

### Styling

- SCSS with theme support via `data-theme` attribute on `<html>`
- CSS custom properties for dynamic values (`--h-height`, `--f-height`)
- Page-specific styles in `src/styles/pages/`

## Important Patterns

### Adding a New Page

1. Create `src/pages/pagename.astro`
2. Import `Layout` and any page-specific script component from `src/scripts/`
3. Add page-specific styles to `src/styles/pages/pagename.scss`
4. Create the client script at `src/scripts/pagename.astro` using `<script is:inline>`
5. Assign any functions that need to be globally accessible to `window` and declare them in `src/env.d.ts`
6. Add navigation link to the `<footer>` nav in `Layout.astro`

### TypeScript

- Strict mode (`noImplicitAny`) is enabled
- `src/env.d.ts` extends the global `Window` interface for all `window.*` assignments
- `tsconfig.json` sets `lib: ["ES2022", "DOM", "DOM.Iterable"]`
- Run `npx astro check` to validate

### Working with the Map

- Map instance in global `map` variable (also on `window.map` via Leaflet)
- `GetMap()` initialises the Leaflet map and calls `onMapLoad()` once ready
- `positionInterval` refreshes vehicle data every 60 seconds

### Theme/Settings Changes

- Modify `settingFunctions` object in `src/scripts/settings.astro`
- Theme applied via `document.documentElement.setAttribute('data-theme', value)`
- Settings stored as array: `[{name: 'theme', content: 'dark'}]`

## Dependencies

- **astro** ^5.x — Core framework
- **@astrojs/vercel** — Vercel SSR adapter
- **sass** — SCSS compilation
- **typescript** / **@astrojs/check** — Type checking
- **leaflet** + **leaflet-routing-machine** — Mapping (also loaded via CDN in Layout)

External APIs:

- 511.org Transit API (Bay Area transit data)
- Nominatim / OpenStreetMap (geocoding for directions)
