# ViaBay: Bay Area Transit Companion

ViaBay is an all-in-one transit platform designed for the San Francisco Bay Area. It simplifies regional travel by consolidating real-time data from multiple transit agencies into a single, user-friendly interface.

## Key User Features

### 📍 Real-Time Vehicle Tracking

* **Interactive Map**: Watch buses and trains move across the Bay Area in real-time.
* **Nearby Search**: Instantly identify all transit vehicles within a 1.5-mile radius of your current location.
* **Live Vehicle Details**: Access deep insights for any vehicle, including its current occupancy level, congestion status, and a full stop-by-stop arrival schedule with "early/late" status indicators.

### 🗺️ Advanced Trip Planning

* **Multi-Stop Routes**: Create complex journeys with multiple waypoints across different transit agencies.
* **Route Summaries**: Receive precise estimates for total travel time and distance for your planned trips.
* **Integrated Geocoding**: Easily find destinations using a built-in address and landmark search.

### 🔔 Service Intelligence & Alerts

* **Live Notifications**: Stay informed with real-time alerts regarding delays, cancellations, or service changes.
* **Reminders**: Set custom alerts to remind you when it's time to leave for your next trip.

### 💳 Fare & Journey Management

* **Fare Predictions**: Explore and predict travel costs across major agencies like BART, Caltrain, and Muni.
* **Digital Transit Cards**: Manage and view information related to regional transit passes.
* **Agency Booking**: Quick access to booking and fare selection for students and regular commuters.

### ⚙️ Personalized Experience

* **Custom Preferences**: Save your preferred routes, home/work locations, and frequently used transit lines.
* **Display Modes**: Seamlessly switch between Light, Dark, and System-synced themes for the best viewing experience.

## Tech Stack

* **Framework**: [Astro](https://astro.build/) with SSR
* **Mapping**: Leaflet Maps for interactive mapping
* **Data**: 511.org API for Bay Area transit data
* **Styling**: SCSS for theme-aware styling
* **Deployment**: Vercel

## Pages

* `/tracker` - Live vehicle tracking map
* `/directions` - Route planning
* `/book` - Trip booking
* `/notifications` - Transit alerts
* `/settings` - App preferences

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

---

*Providing a clearer window into Bay Area transit.*
