# NASA & USGS Data Streams for Asteroid Impact Lab
Integrating authoritative NASA and USGS datasets elevates the fidelity of impact simulations and grounds the experience in real Earth system context. The resources below align with the Impactor-2025 challenge brief and can plug directly into the existing architecture.
## Basemap & Environmental Context
- **NASA Global Imagery Browse Services (GIBS)**  
  Layer NASA's daily Blue Marble or ASTER terrain WMTS tiles in the Leaflet basemap switcher. These layers provide globally consistent, frequently refreshed imagery that improves terrain recognition during scenario planning.  
  Documentation: https://nasa-gibs.github.io/gibs-api-docs/map-library-usage/
- **NASA/JPL PO.DAAC Earth Science Data**  
  Access ocean surface currents, wave state, and altimetry collections to refine tsunami propagation and coastal impact calculations. These datasets can feed the existing tsunami module or drive future machine-learning surrogates for wave height prediction.  
  Portal: https://podaac.jpl.nasa.gov/
## Seismic & Crustal Response
- **USGS NEIC Earthquake Catalog**  
  Query historical earthquakes that match the modelled impact energy to calibrate the Richter conversion and to visualize probable shaking intensities. Integrate API filters (magnitude, depth, location) to benchmark seismic fatality heuristics.  
  Catalog: https://earthquake.usgs.gov/earthquakes/search/
- **USGS National Map Elevation (DEMs)**  
  Pull high-resolution DEM tiles (1/3 arc-second or finer) to support crater morphology estimates, tsunami inundation mapping, and atmospheric plume rendering. DEMs are available in GeoTIFF and can be pre-processed into map tiles or elevation rasters for the simulation back end.  
  Data hub: https://www.usgs.gov/programs/national-geospatial-program/national-map
- **USGS National Map Training**  
  Use the training catalog to accelerate onboarding for analysts who need to work with The National Map services, ensuring consistent preprocessing pipelines for elevation and hydrography products.  
  Training: https://www.usgs.gov/programs/national-geospatial-program/national-map-training
## Orbital Mechanics & Visualization
 **NASA Small-Body Orbital Elements API**  
  Prototype orbital propagators against comet datasets that share Keplerian element structures with asteroids. This improves trajectory prediction features and supports what-if deflection timelines.  
  API: https://data.nasa.gov/dataset/near-earth-comets-orbital-elements-api
  Reference NASA's 3D orrery for UX inspiration and to validate orbital geometry used in any Three.js or Cesium-based visualization layers. Studying their camera paths and labeling strategies helps keep complex orbital dynamics approachable.  
  Experience: https://eyes.nasa.gov/apps/asteroids/
## Integration Tips
- Cache frequently used datasets locally (e.g., DEM tiles or orbital catalogs) to reduce latency and API throttling.
- Expose configuration toggles so users can switch between heuristic defaults and data-enriched modes, similar to the new basemap selector.
- Document attribution and usage constraints from each provider directly in the UI to maintain compliance and transparency.
- Consider background workers or scheduled ETL scripts to ingest large raster datasets (DEM, bathymetry) and convert them into lighter-weight formats consumable by the browser.
These integrations will make the Asteroid Impact Lab more scientifically grounded, improve storytelling for policymakers, and create pathways for advanced mitigation strategy modeling.