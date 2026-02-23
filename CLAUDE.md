# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TransTrack is a Bay Area transit tracking web application built with Astro. It provides real-time vehicle tracking, directions, and transit information using the 511.org API and Leaflet Maps.

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
```

## Architecture

### Framework & Structure

- **Astro 5.x** with **Vercel adapter** - SSR-enabled with server API routes
- **Pages**: `src/pages/*.astro` - File-based routing
- **API Routes**: `src/pages/api/*.ts` - Server-side endpoints (SSR, `prerender: false`)
- **Layout**: `src/layouts/Layout.astro` - Single shared layout component
- **Styling**: SCSS in `src/styles/` with `globals.scss` as the base
- **Client Scripts**: `.astro` script components in `src/scripts/` (inline scripts)
- **Deployment**: Configured for Vercel (`output: 'server'` in `astro.config.mjs`)

### Application Flow

1. **Landing/Login**: `/` redirects to `/tracker`, which redirects to `/landing`
2. **Main Routes**:
   - `/tracker` - Live vehicle tracking map
   - `/directions` - Multi-stop route planning
   - `/settings` - Theme and app settings
   - `/notifications`, `/book`, `/more` - Additional features

### Key Technical Components

**511.org API Integration** - Two-tier architecture:

- **Server-side** (`src/pages/api/511.ts`):
  - Vercel serverless API route with `prerender: false`
  - 9 API keys with automatic rotation and rate limit handling
  - Exponential backoff for 429 responses (1s → 32s max)
  - In-memory key usage tracking with retry logic
  - Handles double-encoded JSON responses
  - Returns standard JSON responses to client
- **Client-side** (`src/scripts/511Request.astro`):
  - `makeRequest(moduleName, params, callback)` - Fetches from `/api/511`
  - Sends params as JSON-encoded URL parameter
  - Endpoints used: `gtfsoperators`, `VehicleMonitoring`

**Map System** (Leaflet-based):

- **Leaflet** Maps integration (v1.9.4) with routing plugin
- CDN-loaded scripts in Layout.astro (unpkg.com)
- Real-time vehicle tracking with markers and popups
- Custom color coding per agency and route (SF Muni has special line colors)
- Leaflet Routing Machine for directions functionality

**Transit Fare Data** (`public/data/price.json`):

- Structured by agency ID with route-specific or zone-based pricing
- Format: `{agency: {id, name, routes: {route: price} OR zones: {zone: price}}}`

**Script Loading Pattern** (`src/layouts/Layout.astro`):

- **Main scripts** auto-loaded on every page: `cookies`, `index`, `authentication`, `511Request`, `notificationManager`, `settings`
- Loaded as `.astro` components from `src/scripts/` (not `public/scripts/`)
- All scripts use `is:inline` attribute to prevent Astro processing
- Page-specific scripts via `scripts` prop: `[{name: 'tracker', location: 'head'|undefined}]`

**Settings System** (`public/scripts/settings.js`):

- LocalStorage-based with key `'settings'`
- Current features: theme switching (system/light/dark)
- Pattern: `setSetting(name, value, type, key)` + `applySettings()`

### State Management

- **No framework**: Pure JavaScript with DOM manipulation
- **Client-side only**: No server rendering for dynamic content
- **LocalStorage**: Settings persistence
- **Global variables**: Agency data, map instances, vehicle pins

### Styling

- SCSS with theme support via `data-theme` attribute
- CSS custom properties for dynamic values (header/footer height)
- Page-specific styles in `src/styles/pages/`
- Component-agnostic: primarily class-based styling

## Important Patterns

### Adding a New Page

1. Create `src/pages/pagename.astro`
2. Import Layout and define props (title, classItems, scripts)
3. Add page-specific styles to `src/styles/pages/pagename.scss`
4. Create client script at `public/scripts/pagename.js` if needed
5. Add navigation link to Layout.astro footer nav

### API Key Management

- 511.org API keys are in `511Request.js` with rotation logic
- Bing Maps key is in `Layout.astro:74` and `tracker.js:2`
- Keys are currently committed (not production-safe)

### Working with the Map

- Map instance stored in global `map` variable
- `Microsoft.Maps` namespace from Bing Maps SDK
- `GetMap()` callback function initializes map
- Directions via `Microsoft.Maps.loadModule('Microsoft.Maps.Directions')`

### Theme/Settings Changes

- Modify `settingFunctions` object in `settings.js`
- Theme applied via `document.documentElement.setAttribute('data-theme', value)`
- Settings stored as array: `[{name: 'theme', content: 'dark'}]`

## Dependencies

- **astro** ^3.6.4 - Core framework
- **sass** ^1.69.5 - SCSS compilation
- **prettier-plugin-astro** ^0.12.0 - Code formatting

External APIs:

- 511.org Transit API (Bay Area transit data)
- Bing Maps API (mapping and directions)
