# Asteroid Impact Lab
Interactive asteroid impact sandbox with live satellite map targeting, NASA small-body presets (asteroids and comets), and population-aware casualty estimates.
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
This launches an Express server on [http://localhost:3000](http://localhost:3000). The server serves the redesigned UI from `public/` and exposes API endpoints for simulation, population lookup, geocoding, and NASA hazard presets (NEOs, Sentry objects, and comets).
## Features
- Leaflet basemap powered by NASA Global Imagery Browse Services (GIBS) Blue Marble layers with search, left-click pin placement, and multi-hazard footprint overlays.
- Hybrid small-body catalog combining NASA's Near-Earth Object browse feed, JPL's Sentry impact monitoring list, and the Near-Earth Comets orbital dataset to surface hazardous asteroids and comets beyond standard NEOs.
- WebGL orbital sandbox using Three.js to render SBDB orbital elements in 3D, complete with live propagation to current true anomaly and catalog fallbacks for comets when SBDB lookups fail.
- Real-world asteroid diameter comparisons (city bus, iconic landmarks, regional spans) for quick intuition.
- Automatic population lookup via BigDataCloud reverse geocoding and Open-Meteo city statistics, with manual overrides when needed.
- On-click geology snapshot (elevation, surface type, nearby features, timezone) shown beside the dropped pin.
- Casualty breakdown by thermal, blast, wind, and seismic effects, now using ring-based population exposure to keep estimates realistic at high energy.
- Layered hazard footprint overlays now surface hover tooltips with zone-specific stats, including population exposure and economic impact.
- Location card highlights geology plus marine context (bathymetry, wave climate) pulled from OpenTopoData and Open-Meteo Marine.
- Tsunami module estimates wave heights, run-up, arrival times, and casualties for ocean impacts, while USGS NEIC analogs provide real earthquake comparisons for seismic yield.
- Economic loss estimate plus object-specific orbital fetches via NASA's Small-Body Database API.
## Data sources & reference materials
- [NASA GIBS map library usage guide](https://nasa-gibs.github.io/gibs-api-docs/map-library-usage/) — reference for configuring Blue Marble tiles and attribution that underpin the satellite basemap.
- [NASA PO.DAAC](https://podaac.jpl.nasa.gov/) — oceanography portal for augmenting tsunami and sea-state modelling with vetted NASA datasets.
- [USGS NEIC Earthquake Catalog](https://earthquake.usgs.gov/earthquakes/search/) — authoritative seismic archive used for the magnitude analogs surfaced in impact summaries.
- [USGS National Map Elevation Data](https://www.usgs.gov/programs/national-geospatial-program/national-map) — high-resolution DEMs suitable for refining local terrain, tsunami run-up, and crater topography.
- [USGS National Map Training Videos](https://www.usgs.gov/programs/national-geospatial-program/national-map-training) — onboarding material for teams integrating National Map assets into additional workflows.
- [NASA Near-Earth Comets orbital elements API](https://data.nasa.gov/dataset/near-earth-comets-orbital-elements-api) — Socrata dataset now powering comet presets and orbital fallbacks alongside asteroid feeds.
- [NASA Eyes on Asteroids](https://eyes.nasa.gov/apps/asteroids/) — interactive orrery inspiration for evolving the 3D visualization experience.
## Notes
- NASA GIBS imagery and reference layers power the satellite basemap; keep attribution visible and remain within their usage guidelines.
- Hazard presets depend on NASA's NEO feed, JPL's Sentry monitoring service, and the Near-Earth Comets dataset, with orbital elements hydrated from the Small-Body Database API when available.
- Population requests rely on public APIs and may be rate limited. If the auto-population fails, provide a manual override in the "Nearby population" field.
- Marine context still uses OpenTopoData (GEBCO 2020 bathymetry) and Open-Meteo Marine wave forecasts; both are anonymous but rate limited.
- Earthquake comparisons query the USGS NEIC FDSN service; connectivity issues will gracefully fall back to heuristic summaries.
- NASA's demo API key is rate-limited; supply your own key through `.env` for higher limits.
- 