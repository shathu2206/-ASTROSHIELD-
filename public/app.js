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
const asteroidMeta = document.getElementById("asteroid-meta");
const asteroidResultsSummary = document.getElementById("asteroid-results-summary");
const asteroidResultsList = document.getElementById("asteroid-results");
const asteroidSearchForm = document.getElementById("asteroid-search-form");
const asteroidQueryInput = document.getElementById("asteroid-query");
const asteroidStartDateInput = document.getElementById("asteroid-start-date");
const asteroidEndDateInput = document.getElementById("asteroid-end-date");
const asteroidMinDiameterInput = document.getElementById("asteroid-min-diameter");
const asteroidMaxDiameterInput = document.getElementById("asteroid-max-diameter");
const asteroidCompositionSelect = document.getElementById("asteroid-composition");
const asteroidHazardCheckbox = document.getElementById("asteroid-hazard");
const asteroidLoadMoreBtn = document.getElementById("asteroid-load-more");
const asteroidResetBtn = document.getElementById("asteroid-reset");
const resultsCard = document.querySelector(".results-card");
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
const tsunamiWaveSourceEl = document.getElementById("tsunami-wave-source");
const tsunamiWaveCoastEl = document.getElementById("tsunami-wave-coast");
const tsunamiRunupEl = document.getElementById("tsunami-runup");
const tsunamiArrivalEl = document.getElementById("tsunami-arrival");
const tsunamiReachEl = document.getElementById("tsunami-reach");
const tsunamiFatalitiesEl = document.getElementById("tsunami-fatalities");

const DEFAULT_SUMMARY_TEXT =
    summaryText?.textContent ?? "Select a location and run the simulation to see projected effects.";
const DEFAULT_POPULATION_TEXT =
    populationSummary?.textContent ?? "Drop a pin to load nearby population estimates.";
const DEFAULT_COORDINATE_TEXT = centerCoordinatesEl?.textContent ?? "No impact location selected";
const DEFAULT_COORDINATE_LABEL = centerLabelEl?.textContent ?? "";
const DEFAULT_ENVIRONMENT_TEXT = centerEnvironmentEl?.textContent ?? "Surface context unavailable.";
const DEFAULT_ASTEROID_META =
    asteroidMeta?.textContent ??
    "Data courtesy of NASA's Near-Earth Object Program. Choose an asteroid to fill in the simulator automatically.";
const DEFAULT_MAP_VIEW = { center: [20, 0], zoom: 3 };
const DAY_IN_MS = 86_400_000;
const NEO_FEED_MAX_RANGE_DAYS = 7;

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
].filter(Boolean);

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

const COMPOSITION_DISPLAY = {
    stony: "Stony",
    iron: "Iron-rich",
    carbonaceous: "Carbonaceous",
    cometary: "Cometary",
    unknown: "Unknown"
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

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

let latestGeology = null;
let map = null;
let impactMarker = null;
let footprintLayer = null;
let latestAsteroids = [];
let selectedAsteroidId = null;
let defaultAsteroidDateRange = null;
const asteroidSearchState = {
    query: "",
    startDate: "",
    endDate: "",
    minDiameter: null,
    maxDiameter: null,
    composition: "",
    hazardousOnly: false,
    page: 0,
    pageSize: 25,
    hasMore: false,
    totalItems: 0,
    loading: false,
    source: null
};
let selectedLocation = null;
let populationAbortController = null;
let mapStatusTimer = null;

function stripTimeZoneLabel(text) {
    if (typeof text !== "string") {
        return text;
    }
    return text.replace(/\s*\|\s*time zone.*$/i, "").trim();
}

function formatCoordinate(lat, lng) {
    const degreeSymbol = "\u00B0";
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return `0.00000${degreeSymbol}, 0.00000${degreeSymbol}`;
    }
    return `${lat.toFixed(5)}${degreeSymbol}, ${lng.toFixed(5)}${degreeSymbol}`;
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

    const description = stripTimeZoneLabel(label) || formatCoordinate(lat, lng);
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
        description: stripTimeZoneLabel(description) || coordinateLabel
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
        const radiusLabel = population.radiusKm ? `${population.radiusKm.toFixed(0)} km` : "local area";
        const densityLabel = Number.isFinite(population.density)
            ? `${population.density.toFixed(0)} ppl/km^2`
            : "unknown density";
        const locationLabel = meta?.city ? `${meta.city}${meta.country ? ", " + meta.country : ""}` : meta?.country || null;
        const radiusKm = Number.isFinite(population.radiusKm) && population.radiusKm > 0 ? population.radiusKm : 30;
        const estimatedTotal = population.total || population.density * Math.PI * radiusKm ** 2;
        const peopleText = formatPeople(estimatedTotal);
        const lines = [];
        if (locationLabel) {
            lines.push(`${locationLabel}: ~${peopleText} people within ${radiusLabel}`);
        } else {
            lines.push(`~${peopleText} people within ${radiusLabel}`);
        }
        lines.push(`Average density ${densityLabel}`);
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

function shouldShowMarineContext(geology) {
    if (!geology) {
        return false;
    }

    const ocean = geology.ocean;
    const depth = Number(ocean?.depthMeters);
    const hasDepth = Number.isFinite(depth);
    const depthSuggestsLand = hasDepth && depth < 0;
    const selectedTerrain = terrainSelect?.value;

    if (selectedTerrain === "water") {
        // Assume marine context unless depth data indicates the location is above sea level.
        if (depthSuggestsLand) {
            return false;
        }
        return true;
    }

    if (!selectedTerrain && depthSuggestsLand) {
        return false;
    }

    const waterBody = geology.waterBody;
    if (typeof waterBody === "string" && /\b(ocean|sea)\b/i.test(waterBody)) {
        return true;
    }

    if (!ocean) {
        return false;
    }

    const elevation = Number(ocean.elevationMeters);
    if (Number.isFinite(elevation)) {
        return elevation <= 0;
    }

    if (hasDepth) {
        return depth >= 0;
    }

    return false;
}

function buildGeologyPopup(geology) {
    if (!geology) {
        return "<strong>Location selected</strong><br>No surface data available.";
    }
    const marineContext = shouldShowMarineContext(geology);
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
    if (!marineContext) {
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
    }
    const ocean = geology.ocean;
    if (marineContext) {
        if (geology.waterBody) {
            parts.push(`Water body: ${escapeHtml(geology.waterBody)}`);
        }
        if (ocean && Number.isFinite(ocean.depthMeters)) {
            const depthLabel = ocean.depthMeters > 0
                ? `${Math.round(ocean.depthMeters)} m below mean sea level`
                : `${Math.abs(Math.round(ocean.depthMeters))} m above mean sea level`;
            parts.push(`Depth: ${escapeHtml(depthLabel)}`);
        }
        if (Number.isFinite(ocean?.waveHeightMeters)) {
            parts.push(`Significant wave height: ${ocean.waveHeightMeters.toFixed(1)} m`);
        }
        if (Number.isFinite(ocean?.surfaceTemperatureC)) {
            parts.push(`Sea surface temperature: ${ocean.surfaceTemperatureC.toFixed(1)} °C`);
        }
        if (Number.isFinite(ocean?.wavePeriodSeconds)) {
            parts.push(`Wave period: ${ocean.wavePeriodSeconds.toFixed(0)} s`);
        }
    }
    return parts.join("<br>");
}

function applyGeologyToUI(geology, { openPopup = false } = {}) {
    latestGeology = geology || null;
    const fallbackLabel = selectedLocation?.description || DEFAULT_COORDINATE_LABEL;
    if (centerLabelEl) {
        const geologyLabel = stripTimeZoneLabel(geology?.label);
        centerLabelEl.textContent = geologyLabel || fallbackLabel;
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
        if (geology?.fallback) {
            segments.push("Surface data approximated");
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

    if (geology?.fallback?.reason) {
        updateMapStatus(`Location context approximated: ${geology.fallback.reason}`, { sticky: true });
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

    applyGeologyToUI(null, { openPopup: false });
    if (asteroidMeta) {
        asteroidMeta.textContent = DEFAULT_ASTEROID_META;
    }
    selectedAsteroidId = null;
    renderAsteroidResults();

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
    const safeInner = Number.isFinite(safeInnerRadius) && safeInnerRadius > 0 && safeInnerRadius < safeOuter
        ? safeInnerRadius
        : 0;
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
        footprintLayer.addLayer(polygon);
    });
}

async function runSimulation() {
    if (!selectedLocation) {
        if (summaryText) {
            summaryText.textContent = "Drop an impact pin before running the simulation.";
        }
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

    if (summaryText) {
        summaryText.textContent = "Running impact simulation...";
    }
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
    } catch (error) {
        console.error(error);
        if (summaryText) {
            summaryText.textContent = "Simulation failed. Check console for details.";
        }
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
    const impactedText = Number.isFinite(impactedPopulation) && impactedPopulation > 0
        ? formatPeople(impactedPopulation)
        : null;
    if (summaryText) {
        summaryText.textContent = impactedText
            ? `${summaryBase} Estimated impacted population: ~${impactedText} people.`
            : summaryBase;
    }

    if (craterDiameterEl) craterDiameterEl.textContent = formatDistance(impact?.craterDiameter ?? NaN);
    if (craterDepthEl) craterDepthEl.textContent = formatDistance(impact?.craterDepth ?? NaN);
    if (fireballEl) fireballEl.textContent = formatDistance(impact?.fireballRadius ?? NaN);

    if (shockwaveEl) shockwaveEl.textContent = formatDistance(impact?.shockwaveRadius ?? NaN);
    if (windEl) windEl.textContent = formatWind(impact?.peakWind ?? NaN);
    if (richterEl) richterEl.textContent = formatMagnitude(impact?.richterMagnitude ?? NaN);

    if (severeDamageEl) severeDamageEl.textContent = formatDistance(infrastructure?.severeDamageRadius ?? NaN);
    if (brokenWindowsEl) brokenWindowsEl.textContent = formatDistance(infrastructure?.windowDamageRadius ?? NaN);
    if (economicLossEl) economicLossEl.textContent = formatCurrency(infrastructure?.economicLoss ?? NaN);

    if (fireballFatalitiesEl) fireballFatalitiesEl.textContent = formatPeople(casualties?.fireball?.fatalities ?? NaN);
    if (blastFatalitiesEl) blastFatalitiesEl.textContent = formatPeople(casualties?.blast?.fatalities ?? NaN);
    if (windFatalitiesEl) windFatalitiesEl.textContent = formatPeople(casualties?.wind?.fatalities ?? NaN);
    if (seismicFatalitiesEl) seismicFatalitiesEl.textContent = formatPeople(casualties?.seismic?.fatalities ?? NaN);

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

function resetAsteroidResults() {
    latestAsteroids = [];
    if (asteroidResultsList) {
        asteroidResultsList.innerHTML = "";
    }
}

function updateAsteroidSummary(payload) {
    if (!asteroidResultsSummary) return;
    const totalItems = Number(payload?.totalItems ?? asteroidSearchState.totalItems ?? latestAsteroids.length);
    const rangeStart = payload?.filters?.startDate ?? asteroidSearchState.startDate ?? "";
    const rangeEnd = payload?.filters?.endDate ?? asteroidSearchState.endDate ?? "";
    const dateRangeLabel = rangeStart ? formatAsteroidDateRangeLabel(rangeStart, rangeEnd) : null;
    const usingDefaultRange = isUsingDefaultAsteroidRange();
    if (!latestAsteroids.length) {
        const hasFilters = Boolean(
            asteroidSearchState.query ||
                asteroidSearchState.minDiameter ||
                asteroidSearchState.maxDiameter ||
                asteroidSearchState.composition ||
                asteroidSearchState.hazardousOnly ||
                (!usingDefaultRange && (asteroidSearchState.startDate || asteroidSearchState.endDate))
        );
        asteroidResultsSummary.textContent = hasFilters
            ? "No asteroids matched your filters. Try widening the search window or clearing some filters."
            : "No asteroids available yet. Try again shortly or expand the date window.";
        return;
    }

    const shown = latestAsteroids.length;
    const countLabel =
        totalItems && shown < totalItems
            ? `Showing ${shown.toLocaleString()} of ${totalItems.toLocaleString()} near-Earth objects`
            : `Showing ${shown.toLocaleString()} near-Earth object${shown === 1 ? "" : "s"}`;

    const highlights = [countLabel];

    if (dateRangeLabel) {
        highlights.unshift(dateRangeLabel);
    }

    const filterHighlights = [];
    if (asteroidSearchState.query) {
        filterHighlights.push(`matching “${asteroidSearchState.query}”`);
    }
    if (asteroidSearchState.hazardousOnly) {
        filterHighlights.push("potentially hazardous only");
    }
    if (asteroidSearchState.minDiameter != null) {
        filterHighlights.push(`min ${Math.round(asteroidSearchState.minDiameter)} m`);
    }
    if (asteroidSearchState.maxDiameter != null) {
        filterHighlights.push(`max ${Math.round(asteroidSearchState.maxDiameter)} m`);
    }
    if (asteroidSearchState.composition) {
        filterHighlights.push(`composition ${getCompositionLabel(asteroidSearchState.composition)}`);
    }
    if (filterHighlights.length > 0) {
        const filterSummary = `Filters: ${filterHighlights.join(", ")}`;
        if (dateRangeLabel) {
            highlights.splice(1, 0, filterSummary);
        } else {
            highlights.unshift(filterSummary);
        }
    }

    const currentPage = Number.isFinite(Number(payload?.page)) ? Number(payload?.page) + 1 : asteroidSearchState.page;
    if (currentPage > 1 || asteroidSearchState.hasMore || payload?.hasMore) {
        highlights.push(`Page ${currentPage}`);
    }

    const sourceMessage =
        payload?.source === "fallback"
            ? "Offline sample data while NASA's feed is unavailable"
            : "Data from NASA's Near-Earth Object program";
    highlights.push(sourceMessage);

    asteroidResultsSummary.textContent = highlights.join(" • ");
}

function renderAsteroidResults() {
    if (!asteroidResultsList) return;
    asteroidResultsList.innerHTML = "";

    if (!latestAsteroids.length) {
        if (!asteroidSearchState.loading && asteroidSearchState.page > 0) {
            const empty = document.createElement("li");
            empty.className = "asteroid-result muted";
            empty.textContent = "No asteroids matched the current filters.";
            asteroidResultsList.appendChild(empty);
        }
        return;
    }

    const fragment = document.createDocumentFragment();

    latestAsteroids.forEach((asteroid) => {
        const item = document.createElement("li");
        item.className = "asteroid-result";
        if (selectedAsteroidId && asteroid.id === selectedAsteroidId) {
            item.classList.add("selected");
        }

        const title = document.createElement("div");
        title.className = "asteroid-result-title";
        const displayName = asteroid?.name ?? asteroid?.officialName ?? asteroid?.designation ?? "Unnamed object";
        title.textContent = displayName;
        item.appendChild(title);

        const officialLabel =
            asteroid?.officialName && asteroid.officialName !== displayName ? asteroid.officialName : null;
        const designationLabel =
            asteroid?.designation &&
            asteroid.designation !== displayName &&
            (!officialLabel || !officialLabel.includes(asteroid.designation))
                ? asteroid.designation
                : null;

        if (officialLabel || designationLabel) {
            const subtitle = document.createElement("div");
            subtitle.className = "asteroid-result-subtitle";
            const subtitleParts = [];
            if (officialLabel) subtitleParts.push(`Official: ${officialLabel}`);
            if (designationLabel) subtitleParts.push(`Designation ${designationLabel}`);
            subtitle.textContent = subtitleParts.join(" • ");
            item.appendChild(subtitle);
        }

        const meta = document.createElement("div");
        meta.className = "asteroid-result-meta";

        const sizeSpan = document.createElement("span");
        sizeSpan.className = "asteroid-pill";
        sizeSpan.textContent = `Size ${formatAsteroidDiameterRange(asteroid)}`;
        meta.appendChild(sizeSpan);

        const compositionSpan = document.createElement("span");
        compositionSpan.className = "asteroid-pill";
        compositionSpan.textContent = `Composition ${getCompositionLabel(asteroid.composition)}`;
        meta.appendChild(compositionSpan);

        if (asteroid.velocity) {
            const velocitySpan = document.createElement("span");
            velocitySpan.className = "asteroid-pill";
            velocitySpan.textContent = `Speed ${formatAsteroidVelocity(asteroid.velocity)}`;
            meta.appendChild(velocitySpan);
        }

        const distanceLabel = formatAsteroidMissDistance(asteroid);
        if (distanceLabel) {
            const distanceSpan = document.createElement("span");
            distanceSpan.className = "asteroid-pill";
            distanceSpan.textContent = `Distance ${distanceLabel}`;
            meta.appendChild(distanceSpan);
        }

        const hazardSpan = document.createElement("span");
        hazardSpan.className = `asteroid-badge ${asteroid.hazardous ? "asteroid-badge-risk" : "asteroid-badge-safe"}`;
        hazardSpan.textContent = asteroid.hazardous ? "Potential hazard" : "No known hazard";
        meta.appendChild(hazardSpan);

        item.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "asteroid-result-actions";

        const approachInfo = document.createElement("span");
        approachInfo.className = "asteroid-result-approach";
        approachInfo.textContent = formatAsteroidApproachSummary(asteroid);
        actions.appendChild(approachInfo);

        if (asteroid.nasaJplUrl) {
            const link = document.createElement("a");
            link.className = "asteroid-link";
            link.href = asteroid.nasaJplUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Mission details";
            actions.appendChild(link);
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "asteroid-use";
        button.textContent = "Load into simulator";
        button.addEventListener("click", () => {
            applyAsteroidPresetFromData(asteroid);
        });
        actions.appendChild(button);

        item.appendChild(actions);
        fragment.appendChild(item);
    });

    asteroidResultsList.appendChild(fragment);
}

function applyAsteroidPresetFromData(asteroid) {
    if (!asteroid) return;
    selectedAsteroidId = asteroid.id ?? asteroid.name ?? null;

    if (diameterInput && Number.isFinite(asteroid.diameter)) {
        diameterInput.value = Math.round(asteroid.diameter);
    }
    if (velocityInput && Number.isFinite(asteroid.velocity)) {
        velocityInput.value = Math.round(asteroid.velocity);
    }
    if (angleInput && Number.isFinite(asteroid.impactAngle)) {
        angleInput.value = Math.round(asteroid.impactAngle);
    }
    if (densitySelect && Number.isFinite(asteroid.density)) {
        const exactMatch = Array.from(densitySelect.options).find(
            (option) => Number(option.value) === Number(asteroid.density)
        );
        if (exactMatch) {
            densitySelect.value = exactMatch.value;
        } else if (asteroid.density >= 6000) {
            densitySelect.value = "8000";
        } else if (asteroid.density <= 800) {
            densitySelect.value = "500";
        } else if (asteroid.density <= 2000) {
            densitySelect.value = "1500";
        } else {
            densitySelect.value = "3000";
        }
    }

    const details = [
        formatAsteroidDiameterRange(asteroid),
        getCompositionLabel(asteroid.composition),
        asteroid.hazardous ? "potentially hazardous" : "not flagged as hazardous"
    ];
    const displayName = asteroid?.name ?? asteroid?.officialName ?? "Unnamed object";
    const subtitleParts = [];
    if (asteroid?.officialName && asteroid.officialName !== displayName) {
        subtitleParts.push(asteroid.officialName);
    }
    if (
        asteroid?.designation &&
        asteroid.designation !== displayName &&
        (!asteroid.officialName || !asteroid.officialName.includes(asteroid.designation))
    ) {
        subtitleParts.push(`Designation ${asteroid.designation}`);
    }
    const header = subtitleParts.length ? `${displayName} (${subtitleParts.join(" • ")})` : displayName;
    if (asteroidMeta) {
        asteroidMeta.textContent = `Loaded ${header} • ${details.join(" • ")}`;
    }

    updateSizeComparison();
    renderAsteroidResults();
}

function readAsteroidSearchForm() {
    asteroidSearchState.query = asteroidQueryInput?.value.trim() ?? "";
    asteroidSearchState.startDate = sanitizeDateInput(asteroidStartDateInput?.value ?? "");
    asteroidSearchState.endDate = sanitizeDateInput(asteroidEndDateInput?.value ?? "");
    asteroidSearchState.minDiameter = readNumberFromInput(asteroidMinDiameterInput);
    asteroidSearchState.maxDiameter = readNumberFromInput(asteroidMaxDiameterInput);
    asteroidSearchState.composition = asteroidCompositionSelect?.value ?? "";
    asteroidSearchState.hazardousOnly = Boolean(asteroidHazardCheckbox?.checked);
    asteroidSearchState.page = 0;
    asteroidSearchState.hasMore = false;
    asteroidSearchState.totalItems = 0;
}

function readNumberFromInput(input) {
    if (!input) return null;
    const value = Number(input.value);
    return Number.isFinite(value) && value > 0 ? value : null;
}

function sanitizeDateInput(value) {
    if (!value) return "";
    const trimmed = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function formatDateForInput(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return "";
    }
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${date.getUTCFullYear()}-${month}-${day}`;
}

function computeDefaultAsteroidDateRange() {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 6 * DAY_IN_MS);
    return {
        start: formatDateForInput(start),
        end: formatDateForInput(end)
    };
}

function enforceAsteroidDateBounds() {
    if (!asteroidStartDateInput || !asteroidEndDateInput) return;
    const startValue = sanitizeDateInput(asteroidStartDateInput.value);
    if (startValue) {
        asteroidEndDateInput.min = startValue;
        const startDate = new Date(`${startValue}T00:00:00Z`);
        if (!Number.isNaN(startDate.getTime())) {
            const maxDate = new Date(startDate.getTime() + (NEO_FEED_MAX_RANGE_DAYS - 1) * DAY_IN_MS);
            const maxValue = formatDateForInput(maxDate);
            if (maxValue) {
                asteroidEndDateInput.max = maxValue;
                if (asteroidEndDateInput.value && asteroidEndDateInput.value > maxValue) {
                    asteroidEndDateInput.value = maxValue;
                }
            }
        }
        if (asteroidEndDateInput.value && asteroidEndDateInput.value < startValue) {
            asteroidEndDateInput.value = startValue;
        }
    } else {
        asteroidEndDateInput.removeAttribute("min");
        asteroidEndDateInput.removeAttribute("max");
    }
}

function isUsingDefaultAsteroidRange() {
    if (!defaultAsteroidDateRange) {
        return false;
    }
    return (
        asteroidSearchState.startDate === defaultAsteroidDateRange.start &&
        asteroidSearchState.endDate === defaultAsteroidDateRange.end
    );
}

async function fetchOfflineAsteroidCatalog() {
    try {
        const response = await fetch("/api/asteroids/offline");
        if (!response.ok) {
            throw new Error(`Offline catalog request failed with status ${response.status}`);
        }
        const payload = await response.json();
        const asteroids = Array.isArray(payload?.asteroids) ? payload.asteroids : [];
        return {
            asteroids,
            summary: payload?.summary ?? "Loaded offline asteroid catalog.",
            totalItems: Number(payload?.totalItems ?? asteroids.length) || asteroids.length,
            source: payload?.source ?? "fallback"
        };
    } catch (offlineError) {
        console.error("Offline asteroid catalog unavailable.", offlineError);
        return null;
    }
}

async function fetchAsteroidCatalog({ append = false } = {}) {
    if (asteroidSearchState.loading) return;

    if (!append) {
        selectedAsteroidId = null;
        resetAsteroidResults();
        if (asteroidResultsSummary) {
            asteroidResultsSummary.textContent = "Searching NASA's Near-Earth Object catalog...";
        }
    } else if (asteroidLoadMoreBtn) {
        asteroidLoadMoreBtn.disabled = true;
        asteroidLoadMoreBtn.textContent = "Loading...";
    }

    asteroidSearchState.loading = true;

    const page = append ? asteroidSearchState.page : 0;
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(asteroidSearchState.pageSize));
    if (asteroidSearchState.query) params.set("q", asteroidSearchState.query);
    if (asteroidSearchState.startDate) params.set("startDate", asteroidSearchState.startDate);
    if (asteroidSearchState.endDate) params.set("endDate", asteroidSearchState.endDate);
    if (asteroidSearchState.minDiameter != null) params.set("minDiameter", String(asteroidSearchState.minDiameter));
    if (asteroidSearchState.maxDiameter != null) params.set("maxDiameter", String(asteroidSearchState.maxDiameter));
    if (asteroidSearchState.composition) params.set("composition", asteroidSearchState.composition);
    if (asteroidSearchState.hazardousOnly) params.set("hazardous", "true");

    try {
        const response = await fetch(`/api/asteroids/search?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to query asteroid catalog");
        const payload = await response.json();

        if (payload?.filters) {
            const normalizedStart = sanitizeDateInput(payload.filters.startDate);
            const normalizedEnd = sanitizeDateInput(payload.filters.endDate);
            if (normalizedStart) {
                asteroidSearchState.startDate = normalizedStart;
                if (!append && asteroidStartDateInput) {
                    asteroidStartDateInput.value = normalizedStart;
                }
            }
            if (normalizedEnd) {
                asteroidSearchState.endDate = normalizedEnd;
                if (!append && asteroidEndDateInput) {
                    asteroidEndDateInput.value = normalizedEnd;
                }
            }
        }

        const asteroids = Array.isArray(payload?.asteroids) ? payload.asteroids : [];
        latestAsteroids = append ? [...latestAsteroids, ...asteroids] : asteroids;

        asteroidSearchState.pageSize = Number(payload?.pageSize) || asteroidSearchState.pageSize;
        const currentPage = Number(payload?.page);
        if (Number.isFinite(currentPage)) {
            asteroidSearchState.page = currentPage + 1;
        } else {
            asteroidSearchState.page = append ? asteroidSearchState.page + 1 : 1;
        }
        asteroidSearchState.hasMore = Boolean(payload?.hasMore);
        asteroidSearchState.totalItems = Number(payload?.totalItems) || latestAsteroids.length;
        asteroidSearchState.source = payload?.source ?? "nasa";

        renderAsteroidResults();
        updateAsteroidSummary(payload);

        if (asteroidMeta) {
            const metaMessage =
                payload?.source === "fallback"
                    ? "NASA's live feed is unavailable right now, so we're showing the bundled asteroid presets."
                    : "Near-Earth object data courtesy of NASA's NeoWs program. Select a result to auto-fill the simulator.";
            asteroidMeta.textContent = metaMessage;
        }

        if (asteroidLoadMoreBtn) {
            asteroidLoadMoreBtn.textContent = "Load more objects";
            if (asteroidSearchState.hasMore) {
                asteroidLoadMoreBtn.hidden = false;
                asteroidLoadMoreBtn.disabled = false;
            } else {
                asteroidLoadMoreBtn.hidden = true;
                asteroidLoadMoreBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error(error);
        if (!append) {
            const offlineCatalog = await fetchOfflineAsteroidCatalog();
            if (offlineCatalog) {
                latestAsteroids = offlineCatalog.asteroids;
                asteroidSearchState.page = latestAsteroids.length ? 1 : 0;
                asteroidSearchState.hasMore = false;
                asteroidSearchState.totalItems = offlineCatalog.totalItems;
                asteroidSearchState.source = offlineCatalog.source;
                renderAsteroidResults();
                updateAsteroidSummary({
                    totalItems: offlineCatalog.totalItems,
                    source: offlineCatalog.source,
                    page: 0,
                    totalPages: 1,
                    hasMore: false,
                    filters: {
                        startDate: asteroidSearchState.startDate,
                        endDate: asteroidSearchState.endDate
                    }
                });
                if (asteroidMeta) {
                    asteroidMeta.textContent =
                        "NASA's live feed is unavailable right now, so we're showing the bundled asteroid presets.";
                }
                if (asteroidLoadMoreBtn) {
                    asteroidLoadMoreBtn.textContent = "Load more objects";
                    asteroidLoadMoreBtn.disabled = true;
                    asteroidLoadMoreBtn.hidden = true;
                }
                asteroidSearchState.loading = false;
                return;
            }

            latestAsteroids = [];
            renderAsteroidResults();
        }
        if (asteroidResultsSummary) {
            asteroidResultsSummary.textContent = "Failed to load asteroid catalog.";
        }
        if (asteroidMeta) {
            asteroidMeta.textContent = "Failed to load asteroid catalog.";
        }
        if (asteroidLoadMoreBtn) {
            asteroidLoadMoreBtn.textContent = "Load more objects";
            asteroidLoadMoreBtn.disabled = true;
        }
    } finally {
        asteroidSearchState.loading = false;
    }
}

function resetAsteroidSearch() {
    if (asteroidQueryInput) asteroidQueryInput.value = "";
    defaultAsteroidDateRange = computeDefaultAsteroidDateRange();
    if (asteroidStartDateInput) asteroidStartDateInput.value = defaultAsteroidDateRange.start;
    if (asteroidEndDateInput) asteroidEndDateInput.value = defaultAsteroidDateRange.end;
    if (asteroidMinDiameterInput) asteroidMinDiameterInput.value = "";
    if (asteroidMaxDiameterInput) asteroidMaxDiameterInput.value = "";
    if (asteroidCompositionSelect) asteroidCompositionSelect.value = "";
    if (asteroidHazardCheckbox) asteroidHazardCheckbox.checked = false;

    asteroidSearchState.query = "";
    asteroidSearchState.startDate = defaultAsteroidDateRange.start;
    asteroidSearchState.endDate = defaultAsteroidDateRange.end;
    asteroidSearchState.minDiameter = null;
    asteroidSearchState.maxDiameter = null;
    asteroidSearchState.composition = "";
    asteroidSearchState.hazardousOnly = false;
    asteroidSearchState.page = 0;
    asteroidSearchState.hasMore = false;
    asteroidSearchState.totalItems = 0;
    asteroidSearchState.source = null;

    selectedAsteroidId = null;
    resetAsteroidResults();
    enforceAsteroidDateBounds();
    if (asteroidResultsSummary) {
        asteroidResultsSummary.textContent =
            "Use the filters to explore upcoming near-Earth objects or press search to see the next seven days.";
    }
    if (asteroidMeta) {
        asteroidMeta.textContent = DEFAULT_ASTEROID_META;
    }
    if (asteroidLoadMoreBtn) {
        asteroidLoadMoreBtn.hidden = true;
        asteroidLoadMoreBtn.disabled = true;
        asteroidLoadMoreBtn.textContent = "Load more objects";
    }
}

function initializeAsteroidCatalog() {
    resetAsteroidSearch();
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
            const cleanedLabel = stripTimeZoneLabel(first.label);
            map.setView([first.lat, first.lng], Math.max(map.getZoom() || 3, 7), { animate: true });
            placeImpactMarker(first.lat, first.lng, cleanedLabel);
            updateMapStatus(`Impact pin dropped at ${cleanedLabel || first.label}`);
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
    const value = Number(meters);
    if (!Number.isFinite(value) || value <= 0) {
        return "--";
    }
    if (value < 1000) {
        return `${value.toFixed(0)} m`;
    }
    const km = value / 1000;
    if (km < 100) {
        return `${km.toFixed(1)} km`;
    }
    return `${km.toFixed(0)} km`;
}

function formatPeople(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return "Negligible";
    }
    const formatter = new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1
    });
    return formatter.format(Math.round(number));
}

function formatMagnitude(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return "N/A";
    }
    return number.toFixed(1);
}

function formatWind(ms) {
    const speed = Number(ms);
    if (!Number.isFinite(speed) || speed <= 0) {
        return "--";
    }
    const mph = speed * 2.23694;
    if (mph < 1000) {
        return `${mph.toFixed(0)} mph`;
    }
    return `${(mph / 1000).toFixed(2)}k mph`;
}

function formatCurrency(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return "--";
    }
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1
    });
    return formatter.format(number);
}

function formatHeight(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return "--";
    }
    if (number < 100) {
        return `${number.toFixed(1)} m`;
    }
    if (number < 1000) {
        return `${number.toFixed(0)} m`;
    }
    return `${(number / 1000).toFixed(2)} km`;
}

function formatDurationMinutes(minutes) {
    const number = Number(minutes);
    if (!Number.isFinite(number) || number <= 0) {
        return "--";
    }
    if (number < 120) {
        return `${number.toFixed(0)} min`;
    }
    const hours = Math.floor(number / 60);
    const remaining = number - hours * 60;
    if (remaining < 5) {
        return `${hours} h`;
    }
    return `${hours} h ${Math.round(remaining)} min`;
}

function formatEnergy(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return "--";
    }
    const megatons = number / 4.184e15;
    if (megatons >= 0.1) {
        const digits = megatons >= 10 ? 0 : 2;
        return `${megatons.toFixed(digits)} Mt TNT`;
    }
    const kilotons = megatons * 1000;
    return `${kilotons.toFixed(kilotons >= 10 ? 0 : 1)} kt TNT`;
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

function getCompositionLabel(key) {
    return COMPOSITION_DISPLAY[key] ?? COMPOSITION_DISPLAY.unknown;
}

function formatAsteroidDiameterRange(asteroid) {
    if (!asteroid) return "Unknown size";
    const { diameterMin, diameterMax, diameter } = asteroid;
    const min = Number(diameterMin);
    const max = Number(diameterMax);
    if (Number.isFinite(min) && Number.isFinite(max)) {
        if (Math.abs(max - min) < 1) {
            return `${Math.round((min + max) / 2)} m`;
        }
        return `${Math.round(min)}–${Math.round(max)} m`;
    }
    if (Number.isFinite(diameter)) {
        return `${Math.round(diameter)} m`;
    }
    return "Unknown size";
}

function formatAsteroidVelocity(velocity) {
    const value = Number(velocity);
    if (!Number.isFinite(value) || value <= 0) {
        return "--";
    }
    return `${value.toFixed(1)} km/s`;
}

function formatAsteroidMissDistance(asteroid) {
    if (!asteroid) return null;
    const km = toFiniteNumber(asteroid?.approachMissDistanceKm);
    const lunar = toFiniteNumber(asteroid?.approachMissDistanceLunar);
    let distanceText = null;

    if (km != null) {
        if (km >= 1_000_000) {
            const millions = km / 1_000_000;
            const digits = millions >= 10 ? 0 : 1;
            distanceText = `${millions.toFixed(digits)} million km`;
        } else if (km >= 1_000) {
            distanceText = `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
        } else {
            distanceText = `${Math.round(km)} km`;
        }
    }

    if (lunar != null) {
        const digits = lunar >= 10 ? 0 : 1;
        const lunarLabel = `${lunar.toFixed(digits)} lunar distance${Math.abs(lunar - 1) < 1e-6 ? "" : "s"}`;
        distanceText = distanceText ? `${distanceText} (${lunarLabel})` : lunarLabel;
    }

    return distanceText;
}

function formatAsteroidDateRangeLabel(start, end) {
    if (!start) {
        return null;
    }
    try {
        const formatter = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
        const startDate = new Date(`${start}T00:00:00Z`);
        const startLabel = Number.isNaN(startDate.getTime()) ? start : formatter.format(startDate);
        if (!end || end === start) {
            return `Approach window: ${startLabel}`;
        }
        const endDate = new Date(`${end}T00:00:00Z`);
        const endLabel = Number.isNaN(endDate.getTime()) ? end : formatter.format(endDate);
        return `Approach window: ${startLabel} – ${endLabel}`;
    } catch (error) {
        if (end && end !== start) {
            return `Approach window: ${start} – ${end}`;
        }
        return `Approach window: ${start}`;
    }
}

function formatApproachDate(date) {
    if (!date) {
        return "No recent approach";
    }
    try {
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) {
            return date;
        }
        return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (error) {
        return date;
    }
}

function formatAsteroidApproachSummary(asteroid) {
    if (!asteroid) {
        return "Approach data unavailable";
    }
    const approachDate = asteroid?.approachDate ?? asteroid?.approachDateIso ?? null;
    const dateLabel = approachDate ? formatApproachDate(approachDate) : null;
    const approachTime = approachDate ? Date.parse(approachDate) : Number.NaN;
    const now = Date.now();
    let prefix = "Close approach";
    if (!approachDate || dateLabel === "No recent approach") {
        prefix = "Close-approach timing unavailable";
    } else if (!Number.isNaN(approachTime)) {
        prefix = approachTime >= now ? "Next close approach" : "Recent close approach";
    }

    const distanceLabel = formatAsteroidMissDistance(asteroid);
    const orbitLabel = asteroid?.orbitClass ? `Orbit: ${asteroid.orbitClass}` : null;

    const parts = [];
    if (approachDate && dateLabel && dateLabel !== "No recent approach") {
        parts.push(`${prefix}: ${dateLabel}`);
    } else {
        parts.push(prefix);
    }
    if (distanceLabel) {
        parts.push(`Distance: ${distanceLabel}`);
    }
    if (orbitLabel) {
        parts.push(orbitLabel);
    }

    return parts.join(" • ") || "Approach data unavailable";
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
    return diameterLabel
        ? `approx. ${diameterLabel} across - ${descriptor}.`
        : `approx. ${descriptor}.`;
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

if (terrainSelect) {
    terrainSelect.addEventListener("change", () => {
        applyGeologyToUI(latestGeology, { openPopup: false });
    });
}

if (asteroidSearchForm) {
    asteroidSearchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        readAsteroidSearchForm();
        fetchAsteroidCatalog({ append: false });
    });
}

if (asteroidResetBtn) {
    asteroidResetBtn.addEventListener("click", () => {
        resetAsteroidSearch();
    });
}

if (asteroidLoadMoreBtn) {
    asteroidLoadMoreBtn.addEventListener("click", () => {
        fetchAsteroidCatalog({ append: true });
    });
}

if (asteroidStartDateInput) {
    asteroidStartDateInput.addEventListener("change", () => {
        enforceAsteroidDateBounds();
    });
}

if (asteroidEndDateInput) {
    asteroidEndDateInput.addEventListener("change", () => {
        enforceAsteroidDateBounds();
    });
}

if (locationForm) {
    locationForm.addEventListener("submit", (event) => {
        event.preventDefault();
        geocode(locationInput.value.trim());
    });
}

initMap();
initializeAsteroidCatalog();
updateSizeComparison();
resetResultDisplay();
