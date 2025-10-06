# Asteroid Impact Lab

Interactive asteroid impact sandbox with live satellite map targeting, asteroid presets, and population-aware casualty estimates.

## Prerequisites

- Node.js 18 or newer (includes `npm` and native `fetch`).
- NASA API key (https://api.nasa.gov/) for higher rate limits (configured in `docs/config.js`).

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. The NASA NeoWs key `etK3avvTPegVKnQGTsWoaUG0QDYJJYfu3Ns7Hi3p` is already bundled with the app, so no `.env` setup is required.
## Run locally

```bash
npm start
```

Always start the Node.js server instead of double-clicking `docs/index.html` or using "Open with Live Server". The frontend expects `/api/*` routes for population, geology, simulation, and asteroid data. If you skip `npm start`, those calls fail with `ERR_CONNECTION_REFUSED` and the UI shows "Data not loaded" status messages.

When `npm start` is running you can browse to http://localhost:3000. The Express server now serves the static site from `docs/` (the same directory GitHub Pages uses) and exposes API endpoints for the simulation, population lookup, geocoding, and NASA NEO datasets. NASA requests are proxied through the server so your API key stays on the backend.

## GitHub Pages / static hosting

GitHub Pages looks for content inside `docs/`, so the production-ready HTML, CSS, and JavaScript live there. When the site is served from a static host such as `https://<user>.github.io/<repo>/` the browser calls public APIs (NASA NeoWs, BigDataCloud, Open-Meteo, OpenTopoData, maps.co) directly. If any provider is offline or rate limited the client automatically falls back to `docs/data/asteroids-fallback.json` and heuristic estimators, so the interface continues to work even without the Node.js proxy.

Running `npm start` locally restores the Express proxy, which keeps your NASA API key private, offers better error messages, and avoids browser CORS limitations. Both hosting modes share the same `docs/` assets, so fixes in that folder immediately apply to GitHub Pages and to the local server.

### Environment variables

- `PORT` – optional override for the Express server (defaults to `3000`). The NASA NeoWs key is bundled as `etK3avvTPegVKnQGTsWoaUG0QDYJJYfu3Ns7Hi3p`, so no environment configuration is needed for NASA access.

If you're working inside VS Code:

1. Open the built-in terminal (`` Ctrl+` ``) and run `npm install` once, then `npm start`.
2. Leave that terminal running so the backend keeps proxying requests while you develop.
3. Visit http://localhost:3000 in your browser. The page can fetch external data as long as your machine has internet access. Without connectivity you'll see the offline fallback dataset only.

### NASA NeoWs proxy endpoints

The Express server provides a small proxy for the [NASA NeoWs API](https://api.nasa.gov/):

- `GET /api/neo-feed?start=YYYY-MM-DD&end=YYYY-MM-DD` – fetches the NASA feed for a 7-day window.
- `GET /api/neo-lookup/:id` – looks up a specific NEO by its NASA identifier.
- `GET /api/neo-fallback` – returns the offline sample data bundled with the project.

Frontend requests should use these routes instead of calling NASA directly; they keep the API key server-side and provide consistent error handling.

### Troubleshooting the NASA feed

- Confirm your development machine (or Codespace) can reach the public internet. If `http://localhost:3000` cannot open outbound HTTPS connections the server will switch to the offline asteroid catalog.
- When the app shows a "Mission Control" warning banner it is serving cached asteroid data and includes the specific error returned by NASA to help you diagnose connectivity or authentication issues.

## Features
- Leaflet satellite map (Esri World Imagery) with on-map search, left-click pin placement, and hazard footprint overlays.
- Real-world asteroid diameter comparisons (city bus, iconic landmarks, regional spans) for quick intuition.
- Automatic population lookup via BigDataCloud reverse geocoding and Open-Meteo city statistics, with manual overrides when needed.
- On-click geology snapshot (elevation, surface type, nearby features, timezone) shown beside the dropped pin.
- Casualty breakdown by thermal, blast, wind, and seismic effects, now using ring-based population exposure to keep estimates realistic at high energy.
- Layered hazard footprint overlays now surface hover tooltips with zone-specific stats, including population exposure and economic impact.
- Location card highlights geology plus marine context (bathymetry, wave climate) pulled from OpenTopoData and Open-Meteo Marine.
- Tsunami module estimates wave heights, run-up, arrival times, and casualties for ocean impacts.
This repository uses public APIs (NASA, Open-Meteo, OpenTopoData, BigDataCloud) where noted; check each provider's docs and rate limits before heavy use.

## External APIs & data sources
The application only relies on publicly documented services—no stubbed or fabricated endpoints. Most endpoints are free and unauthenticated; NASA's Near-Earth Object catalog is the lone service that benefits from a personal API key.
| Feature | Service | Base endpoint | Auth | Notes |
| --- | --- | --- | --- | --- |
| Basemap & labels | Esri World Imagery / World Boundaries | `https://server.arcgisonline.com/.../World_Imagery`<br>`https://services.arcgisonline.com/.../World_Boundaries_and_Places` | None | Attribution is rendered in-app; usage is subject to Esri fair-use limits. |
| Pin reverse geocode & locality context | BigDataCloud | `https://api.bigdatacloud.net/data/reverse-geocode-client` | None | Provides bounding boxes, administrative areas, and natural features. |
| City population lookup | Open-Meteo Geocoding | `https://geocoding-api.open-meteo.com/v1/search` | None | Used to map the reverse-geocoded place name to an estimated population. |
| Elevation & land cover | Open-Meteo Elevation / Landcover | `https://api.open-meteo.com/v1/elevation`<br>`https://api.open-meteo.com/v1/landcover` | None | Supplies meters-above-sea-level values and dominant surface cover classes. |
| Bathymetry | OpenTopoData (GEBCO 2020) | `https://api.opentopodata.org/v1/gebco2020` | None | Returns seafloor depth / terrain elevation around the impact point. |
| Marine conditions | Open-Meteo Marine | `https://marine-api.open-meteo.com/v1/marine` | None | Provides wave height, period, and sea-surface temperature for tsunami context. |
| Geocoding search bar | maps.co (OpenStreetMap search) | `https://geocode.maps.co/search` | None | Powers the location search box in the UI. |
| Asteroid presets | NASA Near-Earth Object Web Service | `https://api.nasa.gov/neo/rest/v1/neo/browse` | API key recommended | A NASA key dramatically raises rate limits; request one at [api.nasa.gov](https://api.nasa.gov/). |
When NASA's key is omitted the server now falls back to the bundled key `etK3avvTPegVKnQGTsWoaUG0QDYJJYfu3Ns7Hi3p`, eliminating reliance on the public `DEMO_KEY`. Other services above are currently anonymous; still, keep total requests modest and cache results in production deployments.


## Notes
- Esri World Imagery tiles power the satellite basemap; keep attribution visible and stay within their fair-use limits.
- Marine context relies on OpenTopoData (GEBCO 2020 bathymetry) and Open-Meteo Marine wave forecasts; both are anonymous but rate limited.
- Population requests rely on public APIs and may be rate limited. If the auto-population fails, provide a manual override in the "Nearby population" field.
- NASA's demo API key is no longer used; the repository ships with the dedicated key `etK3avvTPegVKnQGTsWoaUG0QDYJJYfu3Ns7Hi3p` baked into both the server proxy and the static build.
- All physics models are simplified heuristics intended for educational visualization, not precise scientific predictions.


## Model Equations & Sources

- **Great-circle distance (haversine)** (`server.js`:50-57) - calculates map extents with `d = 2R * asin(sqrt(sin^2((lat2 - lat1)/2) + cos(lat1) * cos(lat2) * sin^2((lon2 - lon1)/2)))`. Source: [Movable Type Scripts](https://www.movable-type.co.uk/scripts/latlong.html).
- **Equivalent population radius and density** (`server.js`:87-89) - derives `radius_km = sqrt(area_km2 / pi)` and `density = population / area`. Source: [Wolfram MathWorld](https://mathworld.wolfram.com/Circle.html).
- **Impactor volume, mass, and kinetic energy** (`server.js`:278-296) - treats the body as a sphere with `V = (pi/6) * diameter^3`, `mass = density * V`, converts velocity to m/s, and evaluates `E = 0.5 * mass * velocity^2`, then `E_mt = E / 4.184e15`. Sources: [Wolfram MathWorld](https://mathworld.wolfram.com/Sphere.html), [Physics Info](https://physics.info/kinetic/).
- **Crater scaling laws** (`server.js`:287-295) - applies pi-scaling relationships `D_transient = 1.161 * (velocity * sin(angle))^0.44 * (density / target_density)^0.333 * diameter^0.78`, uses complexity factors 1.16 and 1.28, and sets depth `0.19 * D_final`. Source: Collins, Melosh and Marcus (2005) and Melosh (1989) via the Earth Impact Effects Program.
- **Blast and seismic heuristics** (`server.js`:296-305) - converts energy to megatons and estimates hazard radii with power law fits (fireball radius scales with `E_mt^0.4`, shockwave radius with `E_mt^0.33`, wind speed with `E_mt^0.28`), and approximates Richter magnitude as `log10(E_eff) - 4.8`. References: Glasstone and Dolan (1977), Gutenberg and Richter (1956), Earth Impact Effects Program notes.
- **Casualty ring model** (`server.js`:321-363) - computes exposed population with `area_km2 = pi * (radius/1000)^2`, scales by local density, and applies fatality factors `{0.98, 0.8, 0.5, 0.15}` for thermal, blast, wind, and seismic effects. Custom heuristic with no external citation.
- **Economic loss estimate** (`server.js`:369-373) - evaluates `loss = fatalities * 4_200_000 * max(density/100, 0.2) * log1p(12 * severe_radius_km)`. Custom heuristic with no external citation.
- **Tsunami amplitude and attenuation** (`server.js`:512-533) - uses impact-tsunami scaling `H_source = min(6 * E_mt^0.28 / depth_factor, 800 * crater_radius_km)` and coastal attenuation `H_coast = H_source * (crater_radius_km / distance_km)^1.1`, then run-up `1.35 * H_coast` and inundation reach heuristics. Based on Ward and Asphaug (2000) with custom extensions.
- **Shallow-water wave speed** (`server.js`:523-525) - computes arrival time via `c = sqrt(g * depth)` from linear wave theory. Source: Dean and Dalrymple (1991).
- **UI unit conversions** (`docs/app.js`) - formats distances (meters to kilometers), velocities (m/s to mph with factor 2.23694), currency, and heights using standard SI conversions. Source: [NIST Guide to the SI](https://physics.nist.gov/cuu/Units/index.html).
- **Log-scale size comparison** (`docs/app.js`) - ranks familiar object analogs by minimizing `abs(log(diameter / reference_size))`. Custom UX heuristic without external citation.

## External APIs & Data Sources

- **Esri ArcGIS World Imagery and Reference Layers** (`docs/app.js`) - satellite basemap and labels. Free basemap usage with attribution. [Docs](https://www.esri.com/en-us/arcgis/products/arcgis-online/resources/basemap).
- **BigDataCloud Reverse Geocode Client** (`server.js`:62-109) - locality metadata, bounding boxes, and ocean or lake flags. Free tier, no key. [Docs](https://www.bigdatacloud.com/docs/api/free-reverse-geocode-to-city-api).
- **Open-Meteo Geocoding API** (`server.js`:79-85) - resolves locality population counts. Free and keyless. [Docs](https://open-meteo.com/en/docs/geocoding-api).
- **Open-Meteo Elevation and Landcover APIs** (`server.js`:214-236) - supplies terrain elevation and dominant landcover. Free and keyless. [Docs](https://open-meteo.com/en/docs).
- **Open-Meteo Marine API** (`server.js`:176-195) - wave height, period, and sea surface temperature for ocean impacts. Free with rate limits. [Docs](https://open-meteo.com/en/docs/marine-api).
- **OpenTopoData GEBCO 2020** (`server.js`:162-170) - bathymetry and elevation context. Free community service. [Docs](https://www.opentopodata.org/).
- **Geocode.maps.co (Nominatim)** (`server.js`:574-583) - search bar geocoding results. Free, subject to fair-use limits. [Site](https://geocode.maps.co/).
- **NASA NeoWs (Near Earth Object Web Service)** (`server.js`:617-635) - asteroid preset catalog. Free with API key (defaults to `etK3avvTPegVKnQGTsWoaUG0QDYJJYfu3Ns7Hi3p`). [Docs](https://api.nasa.gov/).

> Maintenance note: update these sections whenever physics models, heuristics, or external data sources change so the README stays authoritative.
