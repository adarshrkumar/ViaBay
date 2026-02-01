# TransTrack

A Bay Area transit tracking web application with real-time vehicle locations and directions.

## Features

- **Live Vehicle Tracking**: Real-time positions of buses and trains on an interactive map
- **Directions**: Multi-stop route planning
- **Transit Information**: Integration with 511.org API for Bay Area transit data
- **Notifications**: Transit alerts and updates
- **Booking**: Trip booking functionality
- **Settings**: Theme customization (light/dark/system)

## Pages

- `/tracker` - Live vehicle tracking map
- `/directions` - Route planning
- `/book` - Trip booking
- `/notifications` - Transit alerts
- `/settings` - App preferences

## Tech Stack

- [Astro](https://astro.build/) with SSR
- Leaflet Maps for interactive mapping
- 511.org API for transit data
- SCSS for styling
- Deployed on Vercel

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
