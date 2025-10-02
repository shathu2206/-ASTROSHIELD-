# Asteroid Impact Lab

Interactive asteroid impact sandbox with live satellite map targeting, NASA near-earth object presets, and population-aware casualty estimates.

## Prerequisites

- Node.js 18 or newer (includes `npm` and native `fetch`).
- Optional: A NASA API key (https://api.nasa.gov/).

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file (optional) to add your NASA key:
   ```bash
   echo NASA_API_KEY=YOUR_NASA_KEY_HERE > .env
   ```

## Run locally

```bash
npm start
```

This launches an Express server on [http://localhost:3000](http://localhost:3000). The server serves the redesigned UI from `public/` and exposes API endpoints for simulation, population lookup, geocoding, and NASA NEO presets.

## Features

- Leaflet satellite map (Esri World Imagery) with on-map search, left-click pin placement, and hazard footprint overlays.
- Real-world asteroid diameter comparisons (city bus, iconic landmarks, regional spans) for quick intuition.
- Automatic population lookup via BigDataCloud reverse geocoding and Open-Meteo city statistics, with manual overrides when needed.
- On-click geology snapshot (elevation, surface type, nearby features, timezone) shown beside the dropped pin.
- Casualty breakdown by thermal, blast, wind, and seismic effects, now using ring-based population exposure to keep estimates realistic at high energy.
- Layered hazard footprint overlays now surface hover tooltips with zone-specific stats, including population exposure and economic impact.
- Location card highlights geology plus marine context (bathymetry, wave climate) pulled from OpenTopoData and Open-Meteo Marine.
- Tsunami module estimates wave heights, run-up, arrival times, and casualties for ocean impacts.
- Economic loss estimate plus near-Earth asteroid presets fetched live from NASA's public NEO catalog.

## Notes

- Esri World Imagery tiles power the satellite basemap; keep attribution visible and stay within their fair-use limits.
- Marine context relies on OpenTopoData (GEBCO 2020 bathymetry) and Open-Meteo Marine wave forecasts; both are anonymous but rate limited.
- Population requests rely on public APIs and may be rate limited. If the auto-population fails, provide a manual override in the "Nearby population" field.
- NASA's demo API key is rate-limited; supply your own key through `.env` for higher limits.
- All physics models are simplified heuristics intended for educational visualization, not precise scientific predictions.


