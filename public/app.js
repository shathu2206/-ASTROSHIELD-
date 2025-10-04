const mapContainer = document.getElementById("map");
const mapStatusEl = document.getElementById("map-status");
const centerCoordinatesEl = document.getElementById("center-coordinates");
const centerLabelEl = document.getElementById("center-label");
const centerEnvironmentEl = document.getElementById("center-environment");
const sizeComparisonEl = document.getElementById("size-comparison");

const form = document.getElementById("config-form");
const populationInput = document.getElementById("population");
const diameterInput = document.getElementById("diameter");
const velocityInput = document.getElementById("velocity");
const angleInput = document.getElementById("angle");
const densitySelect = document.getElementById("density");
const terrainSelect = document.getElementById("terrain");

const summaryText = document.getElementById("summary-text");
const populationSummary = document.getElementById("population-summary");
const asteroidSelect = document.getElementById("asteroid-select");
const asteroidMeta = document.getElementById("asteroid-meta");
const refreshAsteroidsBtn = document.getElementById("refresh-asteroids");
const locationForm = document.getElementById("location-form");
const locationInput = document.getElementById("location-query");
const resetButton = document.getElementById("reset-form");

const craterDiameterEl = document.getElementById("crater-diameter");
const craterDepthEl = document.getElementById("crater-depth");
const fireballEl = document.getElementById("fireball");
const shockwaveEl = document.getElementById("shockwave");
const windEl = document.getElementById("wind");
const richterEl = document.getElementById("richter");
const severeDamageEl = document.getElementById("severe-damage");
const brokenWindowsEl = document.getElementById("broken-windows");
const economicLossEl = document.getElementById("economic-loss");
const fireballFatalitiesEl = document.getElementById("fireball-fatalities");
const blastFatalitiesEl = document.getElementById("blast-fatalities");
const windFatalitiesEl = document.getElementById("wind-fatalities");
const seismicFatalitiesEl = document.getElementById("seismic-fatalities");
const resultsCard = document.querySelector(".results-card");
const tsunamiWaveSourceEl = document.getElementById("tsunami-wave-source");
const tsunamiWaveCoastEl = document.getElementById("tsunami-wave-coast");
const tsunamiRunupEl = document.getElementById("tsunami-runup");
const tsunamiArrivalEl = document.getElementById("tsunami-arrival");
const tsunamiReachEl = document.getElementById("tsunami-reach");
const tsunamiFatalitiesEl = document.getElementById("tsunami-fatalities");
const DEFAULT_SUMMARY_TEXT = summaryText?.textContent ?? "Select a location and run the simulation to see projected effects.";
const DEFAULT_POPULATION_TEXT = populationSummary?.textContent ?? "Drop a pin to load nearby population estimates.";
const DEFAULT_COORDINATE_TEXT = centerCoordinatesEl?.textContent ?? "No impact location selected";
const DEFAULT_COORDINATE_LABEL = centerLabelEl?.textContent ?? "";
const DEFAULT_ENVIRONMENT_TEXT = centerEnvironmentEl?.textContent ?? "Surface context unavailable.";
const DEFAULT_ASTEROID_META = asteroidMeta?.textContent ?? "Using manually configured parameters.";
const DEFAULT_MAP_VIEW = { center: [20, 0], zoom: 3 };
const RESULT_FIELDS = [
    craterDiameterEl,
    craterDepthEl,
    fireballEl,
    shockwaveEl,
    windEl,
    richterEl,
    severeDamageEl,
    brokenWindowsEl,
    economicLossEl,
    fireballFatalitiesEl,
    blastFatalitiesEl,
    windFatalitiesEl,
    seismicFatalitiesEl,
    tsunamiWaveSourceEl,
    tsunamiWaveCoastEl,
    tsunamiRunupEl,
    tsunamiArrivalEl,
    tsunamiReachEl,
    tsunamiFatalitiesEl
];


const FOOTPRINT_COLORS = {
    crater: "#ffb347",
    fireball: "#ff8a47",
    severe: "#ff4d6d",
    shockwave: "#00c2ff",
    wind: "#4d8bff",
    tremor: "#7b61ff",
    tsunami: "#69d8ff"
};

const FOOTPRINT_STYLE = {
    crater: { fillOpacity: 0.32, weight: 2.2 },
    fireball: { fillOpacity: 0.24, weight: 1.8 },
    severe: { fillOpacity: 0.18, weight: 1.3 },
    wind: { fillOpacity: 0.16, weight: 1 },
    shockwave: { fillOpacity: 0.12, weight: 0.9 },
    tremor: { fillOpacity: 0.1, weight: 0.7 },
    tsunami: { fillOpacity: 0.14, weight: 1.4 }
};

const SIZE_REFERENCES = [
    { size: 12, label: "a city bus (~12 m long)" },
    { size: 25, label: "a blue whale (~25 m long)" },
    { size: 60, label: "a Boeing 747 wingspan (~60 m across)" },
    { size: 93, label: "the Statue of Liberty (93 m tall)" },
    { size: 135, label: "the London Eye (135 m tall)" },
    { size: 300, label: "the Eiffel Tower (300 m tall)" },
    { size: 443, label: "the Empire State Building (443 m to the tip)" },
    { size: 828, label: "the Burj Khalifa (828 m tall)" },
    { size: 1280, label: "the Golden Gate Bridge main span (1,280 m)" },
    { size: 3840, label: "the width of Manhattan Island (~3.8 km)" },
    { size: 8849, label: "Mount Everest (8,849 m tall)" },
    { size: 77000, label: "the width of Rhode Island (~77 km)" }
];

let latestGeology = null;
let map = null;
let impactMarker = null;
let footprintLayer = null;
let latestAsteroids = [];
let selectedLocation = null;
let populationAbortController = null;
let mapStatusTimer = null;


function formatCoordinate(lat, lng) {
    const degreeSymbol = "\u00B0";
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return "0.00000" + degreeSymbol + ", 0.00000" + degreeSymbol;
    }
    return lat.toFixed(5) + degreeSymbol + ", " + lng.toFixed(5) + degreeSymbol;
}


function updateMapStatus(message, { sticky = false } = {}) {
    if (!mapStatusEl) return;
    if (mapStatusTimer) {
        clearTimeout(mapStatusTimer);
        mapStatusTimer = null;
    }
    if (!message) {
        mapStatusEl.classList.add("hidden");
        return;
    }
    mapStatusEl.textContent = message;
    mapStatusEl.classList.remove("hidden");
    if (!sticky) {
        mapStatusTimer = setTimeout(() => {
            mapStatusEl.classList.add("hidden");
        }, 2600);
    }
}



function initMap() {
    if (!mapContainer) return;

    updateMapStatus("Loading satellite tiles...", { sticky: true });

    map = L.map(mapContainer, {
        center: [...DEFAULT_MAP_VIEW.center],
        zoom: DEFAULT_MAP_VIEW.zoom,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
        zoomControl: true
    });

    const imagery = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            attribution: "Tiles (c) Esri - Source: Esri, Maxar, Earthstar Geographics"
        }
    );
    imagery.addTo(map);

    const labels = L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            attribution: "Boundaries & labels (c) Esri"
        }
    );
    labels.addTo(map);

    footprintLayer = L.layerGroup().addTo(map);

    map.whenReady(() => {
        updateMapStatus("Left-click to drop an impact pin.");
        setTimeout(() => {
            map.invalidateSize();
        }, 200);
    });

    map.on("click", (event) => {
        if (!event || !event.latlng) return;
        placeImpactMarker(event.latlng.lat, event.latlng.lng, null);
    });

    window.addEventListener("resize", () => {
        if (map) {
            map.invalidateSize();
        }
    });
}

function placeImpactMarker(lat, lng, label) {
    if (!map) return;
    if (!impactMarker) {
        impactMarker = L.marker([lat, lng]).addTo(map);
    } else {
        impactMarker.setLatLng([lat, lng]);
    }

    const description = label || formatCoordinate(lat, lng);
    setImpactLocation(lat, lng, description);
    loadPopulation();
    loadGeology();

    updateFootprints([]);

    resetResultDisplay();
}

function setImpactLocation(lat, lng, description) {
    const coordinateLabel = formatCoordinate(lat, lng);
    if (centerCoordinatesEl) {
        centerCoordinatesEl.textContent = coordinateLabel;
    }

    selectedLocation = {
        lat,
        lng,
        description: description || coordinateLabel
    };

    applyGeologyToUI(null, { openPopup: false });
}

async function loadPopulation() {
    if (!selectedLocation) return;
    if (populationAbortController) {
        populationAbortController.abort();
    }
    const controller = new AbortController();
    populationAbortController = controller;

    if (populationSummary) {
        populationSummary.textContent = "Loading population data...";
    }

    try {
        const params = new URLSearchParams({
            lat: selectedLocation.lat,
            lng: selectedLocation.lng
        });
        const response = await fetch(`/api/population?${params.toString()}`, {
            signal: controller.signal
        });
        if (!response.ok) throw new Error("Population request failed");
        const data = await response.json();
        renderPopulation(data);
    } catch (error) {
        if (error.name === "AbortError") return;
        console.error(error);
        if (populationSummary) {
            populationSummary.textContent = "Failed to load population data for this pin.";
        }
    } finally {
        if (populationAbortController === controller) {
            populationAbortController = null;
        }
    }
}

function renderPopulation(data) {
    if (!populationSummary) return;
    if (data?.population) {
        const { population, source, meta } = data;
        const radius = population.radiusKm ? `${population.radiusKm.toFixed(0)} km` : "local area";
        const density = Number.isFinite(population.density) ? `${population.density.toFixed(0)} ppl/km^2` : "unknown density";
        const locationLabel = meta?.city ? `${meta.city}${meta.country ? ", " + meta.country : ""}` : meta?.country || null;
        const radiusKm = Number.isFinite(population.radiusKm) && population.radiusKm > 0 ? population.radiusKm : 30;
        const estimatedTotal = population.total || population.density * Math.PI * (radiusKm ** 2);
        const peopleText = formatPeople(estimatedTotal);
        const lines = [];
        if (locationLabel) {
            lines.push(`${locationLabel}: ~${peopleText} people within ${radius}`);
        } else {
            lines.push(`~${peopleText} people within ${radius}`);
        }
        lines.push(`Average density ${density}`);
        if (source) {
            lines.push(`<span class="source">Source: ${source}</span>`);
        }
        populationSummary.innerHTML = lines.join("<br>");
        if (populationInput && populationInput.dataset.locked !== "true") {
            populationInput.value = Math.round(population.total || estimatedTotal || 0);
        }
    } else {
        populationSummary.textContent = data?.message ?? "Population data unavailable for this region.";
    }
}

async function loadGeology() {
    if (!selectedLocation || !impactMarker) return;
    try {
        updateMapStatus("Fetching geology...", { sticky: true });
        const params = new URLSearchParams({
            lat: selectedLocation.lat,
            lng: selectedLocation.lng
        });
        const response = await fetch(`/api/geology?${params.toString()}`);
        if (!response.ok) throw new Error("Geology request failed");
        const geology = await response.json();
        applyGeologyToUI(geology, { openPopup: true });
        updateMapStatus("Impact pin updated");
    } catch (error) {
        console.error(error);
        updateMapStatus("Geology lookup failed", { sticky: true });
    }
}

function buildGeologyPopup(geology) {
    if (!geology) {
        return "<strong>Location selected</strong><br>No surface data available.";
    }
    const parts = [];
    if (geology.label) {
        parts.push(`<strong>${escapeHtml(geology.label)}</strong>`);
    }
    if (geology.country || geology.region) {
        const locationLine = [geology.region, geology.country].filter(Boolean).map(escapeHtml).join(", ");
        if (locationLine) {
            parts.push(locationLine);
        }
    }
    if (Number.isFinite(geology.elevationMeters)) {
        parts.push(`Elevation: ${Math.round(geology.elevationMeters)} m`);
    }
    if (geology.surfaceType) {
        parts.push(`Surface: ${escapeHtml(geology.surfaceType)}`);
    }
    if (geology.landcover) {
        parts.push(`Land cover: ${escapeHtml(geology.landcover)}`);
    }
    if (geology.naturalFeature) {
        parts.push(`Nearby feature: ${escapeHtml(geology.naturalFeature)}`);
    }
    if (geology.waterBody) {
        parts.push(`Water body: ${escapeHtml(geology.waterBody)}`);
    }
    const ocean = geology.ocean;
    if (ocean) {
        if (Number.isFinite(ocean.depthMeters)) {
            const depthLabel = ocean.depthMeters > 0
                ? `${Math.round(ocean.depthMeters)} m below mean sea level`
                : `${Math.abs(Math.round(ocean.depthMeters))} m above mean sea level`;
            parts.push(`Depth: ${escapeHtml(depthLabel)}`);
        }
        if (Number.isFinite(ocean.waveHeightMeters)) {
            parts.push(`Significant wave height: ${ocean.waveHeightMeters.toFixed(1)} m`);
        }
        if (Number.isFinite(ocean.surfaceTemperatureC)) {
            parts.push(`Sea surface temperature: ${ocean.surfaceTemperatureC.toFixed(1)} deg C`);
        }
        if (Number.isFinite(ocean.wavePeriodSeconds)) {
            parts.push(`Wave period: ${ocean.wavePeriodSeconds.toFixed(0)} s`);
        }
        if (ocean.source) {
            parts.push(`<span class="source">Marine data: ${escapeHtml(ocean.source)}</span>`);
        }
    }
    if (geology.timezone) {
        parts.push(`Time zone: ${escapeHtml(geology.timezone)}`);
    }
    if (geology.highlights?.length) {
        parts.push(`<em>${geology.highlights.map(escapeHtml).join(" | ")}</em>`);
    }
    return parts.join("<br>");
}

function applyGeologyToUI(geology, { openPopup = false } = {}) {
    latestGeology = geology || null;
    const fallbackLabel = selectedLocation?.description || DEFAULT_COORDINATE_LABEL;
    if (centerLabelEl) {
        centerLabelEl.textContent = geology?.label || fallbackLabel;
    }

    if (centerEnvironmentEl) {
        const segments = [];
               const isOceanTarget = terrainSelect?.value === "water";
        if (isOceanTarget) {
            const depth = Number(geology?.ocean?.depthMeters);
            if (Number.isFinite(depth)) {
                segments.push(`Depth: ${depth.toFixed(0)} m`);
            }
            const waveHeight = Number(geology?.ocean?.waveHeightMeters);
            if (Number.isFinite(waveHeight) && waveHeight > 0.1) {
                segments.push(`Significant wave height: ${waveHeight.toFixed(1)} m`);
            }
        } else {
            if (geology?.surfaceType) {
                segments.push(geology.surfaceType);
            }
            if (geology?.landcover) {
                segments.push(`Land cover: ${geology.landcover}`);
            }
            const elevation = Number(geology?.elevationMeters);
            if (Number.isFinite(elevation)) {
                segments.push(`Elevation: ${Math.round(elevation)} m`);
            }
        }
        centerEnvironmentEl.textContent = segments.length ? segments.join(" | ") : DEFAULT_ENVIRONMENT_TEXT;
        centerEnvironmentEl.classList.toggle("muted", segments.length === 0);
    }

    if (!impactMarker) {
        return;
    }

    if (!geology) {
        impactMarker.unbindPopup();
        return;
    }

    const popupHtml = buildGeologyPopup(geology);
    impactMarker.bindPopup(popupHtml, { closeButton: true, autoClose: false });
    if (openPopup) {
        impactMarker.openPopup();
    }
}

function escapeHtml(value) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };
    return (value ?? "").toString().replace(/[&<>"']/g, (char) => map[char] || char);
}


function clearResultReadouts() {
    RESULT_FIELDS.forEach((field) => {
        if (field) {
            field.textContent = "--";
        }
    });
}

function hideResultsCard() {
    if (resultsCard) {
        resultsCard.classList.add("results-card--pending");
    }
}
function showResultsCard() {
    if (resultsCard) {
        resultsCard.classList.remove("results-card--pending");
    }
}
function resetResultDisplay() {
    hideResultsCard();
    clearResultReadouts();
    if (summaryText) {
        summaryText.textContent = DEFAULT_SUMMARY_TEXT;
    }
}

function resetSimulation() {
    if (populationAbortController) {
        populationAbortController.abort();
        populationAbortController = null;
    }

    form?.reset();
    if (populationInput) {
        delete populationInput.dataset.locked;
    }
    updateSizeComparison();

       resetResultDisplay();

    selectedLocation = null;

    if (impactMarker && map) {
        map.removeLayer(impactMarker);
        impactMarker = null;
    }
    clearFootprints();

    if (map) {
        map.setView([...DEFAULT_MAP_VIEW.center], DEFAULT_MAP_VIEW.zoom);
    }

    if (centerCoordinatesEl) centerCoordinatesEl.textContent = DEFAULT_COORDINATE_TEXT;
    if (centerLabelEl) centerLabelEl.textContent = DEFAULT_COORDINATE_LABEL;
    if (locationInput) locationInput.value = "";

    if (populationSummary) populationSummary.textContent = DEFAULT_POPULATION_TEXT;
    

    if (asteroidSelect) {
        asteroidSelect.value = "custom";
    }
    applyGeologyToUI(null, { openPopup: false });
    if (asteroidMeta) {
        asteroidMeta.textContent = DEFAULT_ASTEROID_META;
    }

    updateMapStatus("Inputs reset. Drop a new impact pin.");
}

function clearFootprints() {
    if (!footprintLayer) return;
    footprintLayer.clearLayers();
}

function formatFootprintStatValue(stat) {
    if (!stat) return "--";
    const kind = stat.kind || "number";
    const value = stat.value;
    switch (kind) {
        case "distance":
            return formatDistance(value);
        case "height":
            return formatHeight(value);
        case "people":
            return formatPeople(value);
        case "currency":
            return formatCurrency(value);
        case "wind":
            return formatWind(value);
        case "magnitude":
            return formatMagnitude(value);
        case "energy":
            return formatEnergy(value);
        case "time":
            return formatDurationMinutes(value);
        default:
            if (!Number.isFinite(value)) {
                return "--";
            }
            return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });

    }
}

function buildFootprintTooltip(footprint) {
    const rawTitle = footprint?.title ?? footprint?.label ?? footprint?.type ?? "Impact zone";
    const rawSubtitle = footprint?.label && footprint.label !== rawTitle ? footprint.label : null;
    const rawDescription = footprint?.description ?? "";
    const stats = Array.isArray(footprint?.stats) ? footprint.stats.filter((item) => item && item.label) : [];
    const statsHtml = stats
        .map((stat) => {
            const label = escapeHtml(stat.label);
            const value = escapeHtml(formatFootprintStatValue(stat));
            return `<li><span class="stat-label">${label}</span><span class="stat-value">${value}</span></li>`;
        })
        .join("");
    const subtitle = rawSubtitle ? `<span class="tooltip-subtitle">${escapeHtml(rawSubtitle)}</span>` : "";
    const description = rawDescription ? `<p class="tooltip-description">${escapeHtml(rawDescription)}</p>` : "";
    const statsList = statsHtml ? `<ul class="tooltip-stats">${statsHtml}</ul>` : "";
    return `<div class="footprint-tooltip__inner"><div class="tooltip-heading"><span class="tooltip-title">${escapeHtml(rawTitle)}</span>${subtitle}</div>${description}${statsList}</div>`;
}

function createFootprintPolygon(center, outerRadius, innerRadius, styleOptions = {}) {
    const [rawLat, rawLng] = center || [];
    const safeLat = Number(rawLat);
    const safeLng = Number(rawLng);
    const safeOuter = Number(outerRadius);
    if (!Number.isFinite(safeOuter) || safeOuter <= 0 || !Number.isFinite(safeLat) || !Number.isFinite(safeLng)) {
        return null;
    }
    const safeInnerRadius = Number(innerRadius);
    const safeInner = Number.isFinite(safeInnerRadius) && safeInnerRadius > 0 && safeInnerRadius < safeOuter ? safeInnerRadius : 0;
    try {
        const outerCircle = L.circle([safeLat, safeLng], { radius: safeOuter });
        const outerCoords = outerCircle
            .toGeoJSON()
            ?.geometry?.coordinates?.[0]
            ?.map(([coordLng, coordLat]) => [coordLat, coordLng]);
        if (!outerCoords || !outerCoords.length) {
            return null;
        }
        const rings = [outerCoords];
        if (safeInner > 0) {
            const innerCircle = L.circle([safeLat, safeLng], { radius: safeInner });
            const innerCoords = innerCircle
                .toGeoJSON()
                ?.geometry?.coordinates?.[0]
                ?.map(([coordLng, coordLat]) => [coordLat, coordLng]);
            if (innerCoords && innerCoords.length) {
                rings.push(innerCoords.reverse());
            }
        }
        return L.polygon(rings, {
            color: styleOptions.color,
            weight: styleOptions.weight,
            fillColor: styleOptions.fillColor,
            fillOpacity: styleOptions.fillOpacity,
            interactive: true,
            stroke: true
        });
    } catch (error) {
        console.error("Failed to build footprint polygon", error);
        return L.circle([safeLat, safeLng], {
            radius: safeOuter,
            color: styleOptions.color,
            weight: styleOptions.weight,
            fillColor: styleOptions.fillColor,
            fillOpacity: styleOptions.fillOpacity
        });
    }
}


function updateFootprints(footprints = [], location) {
    clearFootprints();
    if (!footprintLayer || !location) return;

   const orderedFootprints = [...footprints]
        .map((footprint) => {
            const radius = Number(footprint?.radiusMeters);
            if (!Number.isFinite(radius) || radius <= 0) {
                return null;
            }
            return { ...footprint, radiusMeters: radius };
        })
        .filter(Boolean)
        .sort((a, b) => b.radiusMeters - a.radiusMeters);

       orderedFootprints.forEach((footprint, index) => {
        const nextFootprint = orderedFootprints[index + 1];
        const innerRadius = nextFootprint?.radiusMeters ?? 0;
        const color = FOOTPRINT_COLORS[footprint.type] ?? "#ffffff";
        const style = FOOTPRINT_STYLE[footprint.type] ?? {};
        const defaultWeight = style.weight ?? 1;
        const defaultFill = style.fillOpacity ?? 0.15;
        const polygon = createFootprintPolygon([location.lat, location.lng], footprint.radiusMeters, innerRadius, {
            color,
            weight: defaultWeight,
            fillColor: color,
            fillOpacity: defaultFill
        });
        if (!polygon) {
            return;
        }
        const tooltipHtml = buildFootprintTooltip(footprint);
        if (tooltipHtml) {
            polygon.bindTooltip(tooltipHtml, {
                permanent: false,
                direction: "top",
                sticky: true,
                opacity: 1,
                className: "footprint-tooltip",
                offset: [0, -6],
                interactive: true
            });
        }
        polygon.on("mouseover", () => {
            polygon.setStyle({
                weight: defaultWeight + 1,
                fillOpacity: Math.min(defaultFill + 0.08, 0.6)
            });
        });
        polygon.on("mouseout", () => {
            polygon.setStyle({
                weight: defaultWeight,
                fillOpacity: defaultFill
            });
        });
   footprintLayer.addLayer(polygon);    });
}

async function runSimulation() {
    if (!selectedLocation) {
        summaryText.textContent = "Drop an impact pin before running the simulation.";
        return;
    }

    const body = {
        location: selectedLocation,
        diameter: Number(diameterInput?.value ?? NaN),
        velocity: Number(velocityInput?.value ?? NaN),
        angle: Number(angleInput?.value ?? NaN),
        density: Number(densitySelect?.value ?? NaN),
        terrain: terrainSelect?.value,
        populationOverride: Number(populationInput?.value ?? NaN)
    };

     hideResultsCard();
    clearResultReadouts();

    summaryText.textContent = "Running impact simulation...";
    try {
        const response = await fetch("/api/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error("Simulation request failed");
        const data = await response.json();
        renderResults(data);
        updateMapStatus("Simulation updated");
                hideResultsCard();

    } catch (error) {
        console.error(error);
        summaryText.textContent = "Simulation failed. Check console for details.";
        updateMapStatus("Simulation failed.", { sticky: true });
    }
}

function renderResults(data) {
    const {
        summary,
        impact,
        casualties,
        infrastructure,
        footprints = [],
        location,
        geology,
        tsunami
    } = data ?? {};

    applyGeologyToUI(geology ?? latestGeology, { openPopup: false });

    const summaryBase = summary ?? "Impact summary unavailable.";
    const impactedPopulation = data?.population?.population?.total;
    const impactedText = Number.isFinite(impactedPopulation) && impactedPopulation > 0 ? formatPeople(impactedPopulation) : null;
    summaryText.textContent = impactedText
        ? `${summaryBase} Estimated impacted population: ~${impactedText} people.`
        : summaryBase;

    craterDiameterEl.textContent = formatDistance(impact?.craterDiameter ?? NaN);
    craterDepthEl.textContent = formatDistance(impact?.craterDepth ?? NaN);
    fireballEl.textContent = formatDistance(impact?.fireballRadius ?? NaN);

    shockwaveEl.textContent = formatDistance(impact?.shockwaveRadius ?? NaN);
    windEl.textContent = formatWind(impact?.peakWind ?? NaN);
    richterEl.textContent = formatMagnitude(impact?.richterMagnitude ?? NaN);

    severeDamageEl.textContent = formatDistance(infrastructure?.severeDamageRadius ?? NaN);
    brokenWindowsEl.textContent = formatDistance(infrastructure?.windowDamageRadius ?? NaN);
    economicLossEl.textContent = formatCurrency(infrastructure?.economicLoss ?? NaN);

    fireballFatalitiesEl.textContent = formatPeople(casualties?.fireball?.fatalities ?? NaN);
    blastFatalitiesEl.textContent = formatPeople(casualties?.blast?.fatalities ?? NaN);
    windFatalitiesEl.textContent = formatPeople(casualties?.wind?.fatalities ?? NaN);
    seismicFatalitiesEl.textContent = formatPeople(casualties?.seismic?.fatalities ?? NaN);

    const setTsunamiText = (el, value) => {
        if (!el) return;
        el.textContent = value;
    };

    if (tsunami) {
        setTsunamiText(tsunamiWaveSourceEl, formatHeight(tsunami.sourceWaveHeight ?? NaN));
        setTsunamiText(tsunamiWaveCoastEl, formatHeight(tsunami.coastalWaveHeight ?? NaN));
        setTsunamiText(tsunamiRunupEl, formatHeight(tsunami.runupHeight ?? NaN));
        setTsunamiText(tsunamiArrivalEl, formatDurationMinutes(tsunami.arrivalTimeMinutes ?? NaN));
        const reachMeters = Number.isFinite(tsunami.inundationDistanceKm) ? tsunami.inundationDistanceKm * 1000 : NaN;
        setTsunamiText(tsunamiReachEl, formatDistance(reachMeters));
        setTsunamiText(tsunamiFatalitiesEl, formatPeople(tsunami.fatalities ?? NaN));
    } else {
        setTsunamiText(tsunamiWaveSourceEl, "--");
        setTsunamiText(tsunamiWaveCoastEl, "--");
        setTsunamiText(tsunamiRunupEl, "--");
        setTsunamiText(tsunamiArrivalEl, "--");
        setTsunamiText(tsunamiReachEl, "--");
        setTsunamiText(tsunamiFatalitiesEl, "--");
    }

    const footprintLocation = location?.lat != null && location?.lng != null ? location : selectedLocation;
    if (footprintLocation) {
        updateFootprints(footprints, footprintLocation);
    } else {
        updateFootprints([]);
    }
        showResultsCard();
}

async function fetchAsteroids() {
    if (!refreshAsteroidsBtn) return;
    refreshAsteroidsBtn.disabled = true;
    refreshAsteroidsBtn.textContent = "Loading...";
    try {
        const response = await fetch("/api/asteroids");
        if (!response.ok) throw new Error("Failed to load asteroids");
        const payload = await response.json();
        latestAsteroids = payload.asteroids ?? [];
        if (asteroidSelect) {
            asteroidSelect.innerHTML = '<option value="custom">Custom asteroid</option>';
            latestAsteroids.forEach((asteroid, index) => {
                const option = document.createElement("option");
                option.value = index;
                option.textContent = `${asteroid.name} (${asteroid.diameter.toFixed(0)} m)`;
                asteroidSelect.appendChild(option);
            });
        }
        if (asteroidMeta) {
            asteroidMeta.textContent = payload.summary ?? "Loaded asteroid sample from catalog.";
        }
    } catch (error) {
        console.error(error);
        if (asteroidMeta) {
            asteroidMeta.textContent = "Failed to load asteroid catalog.";
        }
    } finally {
        refreshAsteroidsBtn.disabled = false;
    refreshAsteroidsBtn.textContent = "Fetch Asteroids";
    }
}

function applyAsteroidPreset(index) {
    if (index === "custom" || index === null || index === undefined) {
        if (asteroidMeta) {
            asteroidMeta.textContent = "Using manually configured parameters.";
        }
        return;
    }
    const asteroid = latestAsteroids[Number(index)];
    if (!asteroid) return;
    if (diameterInput) diameterInput.value = Math.round(asteroid.diameter);
    if (velocityInput) velocityInput.value = Math.round(asteroid.velocity);
    if (angleInput) angleInput.value = Math.round(asteroid.impactAngle ?? 45);
    if (densitySelect) {
        const match = Array.from(densitySelect.options).find((option) => Number(option.value) === asteroid.density);
        if (match) {
            densitySelect.value = match.value;
        } else {
            const closest = asteroid.density >= 6000 ? "8000" : asteroid.density <= 800 ? "500" : asteroid.density <= 2000 ? "1500" : "3000";
            densitySelect.value = closest;
        }
    }
    if (asteroidMeta) {
        asteroidMeta.textContent = `Loaded ${asteroid.name}: ${asteroid.designation} | H=${asteroid.absoluteMagnitude}`;
    }
    updateSizeComparison();
}

async function geocode(query) {
    if (!query) return;
    try {
        updateMapStatus("Geocoding...");
        const response = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Geocode request failed");
        const data = await response.json();
        if (data?.results?.length) {
            const first = data.results[0];
            map.setView([first.lat, first.lng], Math.max(map.getZoom() || 3, 7), { animate: true });
            placeImpactMarker(first.lat, first.lng, first.label);
            updateMapStatus(`Impact pin dropped at ${first.label}`);
        } else {
            updateMapStatus("No matches found.");
            alert("No matches found for that query.");
        }
    } catch (error) {
        console.error(error);
        updateMapStatus("Geocoding failed.", { sticky: true });
    }
}

function formatDistance(meters) {
    if (!isFinite(meters) || meters <= 0) {
        return "--";
    }
    if (meters < 1000) {
        return `${meters.toFixed(0)} m`;
    }
    const km = meters / 1000;
    if (km < 100) {
        return `${km.toFixed(1)} km`;
    }
    return `${km.toFixed(0)} km`;
}

function formatPeople(value) {
    if (!isFinite(value) || value <= 0) {
        return "Negligible";
    }
    const formatter = new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1
    });
    return formatter.format(Math.round(value));
}

function formatMagnitude(value) {
    if (!isFinite(value) || value <= 0) {
        return "N/A";
    }
    return value.toFixed(1);
}

function formatWind(ms) {
    if (!isFinite(ms) || ms <= 0) {
        return "--";
    }
    const mph = ms * 2.23694;
    if (mph < 1000) {
        return `${mph.toFixed(0)} mph`;
    }
    return `${(mph / 1000).toFixed(2)}k mph`;
}

function formatCurrency(value) {
    if (!isFinite(value) || value <= 0) {
        return "--";
    }
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1
         });
    return formatter.format(value);
}

function formatHeight(value) {
    if (!isFinite(value) || value <= 0) {
        return "--";
    }
    if (value < 100) {
        return `${value.toFixed(1)} m`;
    }
    if (value < 1000) {
        return `${value.toFixed(0)} m`;
    }
    return `${(value / 1000).toFixed(2)} km`;
}

function formatDurationMinutes(minutes) {
    if (!isFinite(minutes) || minutes <= 0) {
        return "--";
    }
    if (minutes < 120) {
        return `${minutes.toFixed(0)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remaining = minutes - hours * 60;
    if (remaining < 5) {
        return `${hours} h`;
    }
    return `${hours} h ${Math.round(remaining)} min`;
}



function formatEnergy(value) {
    if (!isFinite(value) || value <= 0) {
        return "--";
    }
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(digits)} Mt TNT`;
}


function formatDiameterLabel(diameter) {
    if (!Number.isFinite(diameter) || diameter <= 0) {
        return null;
    }
    if (diameter >= 1000) {
        const km = diameter / 1000;
        const digits = km >= 10 ? 0 : 1;
        return `${km.toFixed(digits)} km`;
    }
    return `${Math.round(diameter)} m`;
}

function describeAsteroidSize(diameter) {
    if (!Number.isFinite(diameter) || diameter <= 0) {
        return "Set a positive diameter to compare with familiar objects.";
    }
    const comparison = SIZE_REFERENCES.reduce(
        (closest, reference) => {
            const score = Math.abs(Math.log(diameter / reference.size));
            return score < closest.score ? { score, reference } : closest;
        },
        { score: Infinity, reference: SIZE_REFERENCES[0] }
    );
    const reference = comparison.reference;
    const ratio = diameter / reference.size;
    const roundedRatio = ratio >= 10 ? Math.round(ratio) : Number(ratio.toFixed(1));
    let descriptor;
    if (ratio < 0.75) {
        descriptor = `slightly smaller than ${reference.label}`;
    } else if (ratio <= 1.35) {
        descriptor = `about the size of ${reference.label}`;
    } else if (ratio <= 3) {
        descriptor = `${ratio.toFixed(1)}x larger than ${reference.label}`;
    } else {
        descriptor = `${roundedRatio}x larger than ${reference.label}`;
    }
    const diameterLabel = formatDiameterLabel(diameter);
    return diameterLabel ? `approx. ${diameterLabel} across - ${descriptor}.` : `approx. ${descriptor}.`;
}

function updateSizeComparison() {
    if (!sizeComparisonEl || !diameterInput) return;
    const diameter = Number(diameterInput.value);
    sizeComparisonEl.textContent = describeAsteroidSize(diameter);
}

if (form) {
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        runSimulation();
    });
}
if (resetButton) {
    resetButton.addEventListener("click", () => {
        resetSimulation();
    });
}


if (populationInput) {
    populationInput.addEventListener("change", (event) => {
        event.target.dataset.locked = "true";
    });
}

if (diameterInput) {
    diameterInput.addEventListener("input", () => {
        updateSizeComparison();
    });
}

if (asteroidSelect) {
    asteroidSelect.addEventListener("change", (event) => {
        applyAsteroidPreset(event.target.value);
    });
}

if (terrainSelect) {
    terrainSelect.addEventListener("change", () => {
        applyGeologyToUI(latestGeology, { openPopup: false });
    });
}

if (refreshAsteroidsBtn) {
    refreshAsteroidsBtn.addEventListener("click", () => {
        fetchAsteroids();
    });
}

if (locationForm) {
    locationForm.addEventListener("submit", (event) => {
        event.preventDefault();
        geocode(locationInput.value.trim());
    });
}

initMap();
fetchAsteroids();
updateSizeComparison();
    resetResultDisplay();



























