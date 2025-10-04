import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";
const DEFAULT_USER_AGENT = "AsteroidImpactLab/1.0 (+https://example.com/contact)";

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const TERRAIN = {
    land: { label: "continental crust", density: 2600, dampening: 1 },
    water: { label: "open ocean", density: 1020, dampening: 0.78 },
    ice: { label: "polar ice", density: 930, dampening: 0.62 }
};

const CASUALTY_FATALITY_FACTORS = {
    fireball: 0.98,
    blast: 0.8,
    wind: 0.5,
    seismic: 0.15
};

const ECONOMIC_LOSS_PER_FATALITY = 4_200_000;

function combineAbortSignals(signals) {
    const validSignals = signals.filter(Boolean);
    if (validSignals.length === 0) {
        return undefined;
    }
    if (validSignals.length === 1) {
        return validSignals[0];
    }
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
        return AbortSignal.any(validSignals);
    }

    const relay = new AbortController();
    const subscriptions = [];
    const cleanup = () => {
        for (const { signal, handler } of subscriptions) {
            signal.removeEventListener("abort", handler);
        }
        subscriptions.length = 0;
    };

    for (const signal of validSignals) {
        if (signal.aborted) {
            relay.abort(signal.reason);
            cleanup();
            return relay.signal;
        }
        const handler = () => {
            relay.abort(signal.reason);
            cleanup();
        };
        signal.addEventListener("abort", handler, { once: true });
        subscriptions.push({ signal, handler });
    }

    relay.signal.addEventListener("abort", cleanup, { once: true });
    return relay.signal;
}

async function fetchJson(url, options = {}) {
    const { headers = {}, timeoutMs = 10_000, signal, ...rest } = options;
    const controller = new AbortController();
    const combinedSignal = combineAbortSignals([controller.signal, signal]);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": DEFAULT_USER_AGENT,
                Accept: "application/json",
                ...headers
            },
            signal: combinedSignal,
            ...rest
        });
        if (!response.ok) {
            const message = await response.text();
            throw new Error(`Request failed (${response.status}): ${message}`);
        }
        return response.json();
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error(`Request timed out after ${timeoutMs} ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}


function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function haversineDistance([lat1, lon1], [lat2, lon2]) {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function resolvePopulation(lat, lng) {
    try {
        const reverseUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
        const reverse = await fetchJson(reverseUrl);
        const cityName = reverse.city || reverse.locality || reverse.principalSubdivision || reverse.countryName;

        const bounds = reverse.boundingbox;
        let areaKm2 = null;
        if (Array.isArray(bounds) && bounds.length === 4) {
            const [south, north, west, east] = bounds.map(Number);
            const height = haversineDistance([south, west], [north, west]);
            const width = haversineDistance([south, west], [south, east]);
            if (isFinite(height) && isFinite(width)) {
                areaKm2 = height * width;
            }
        }

        let population = null;
        if (cityName) {
            const searchUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
            const search = await fetchJson(searchUrl);
            const candidate = search?.results?.[0];
            if (candidate?.population) {
                population = Number(candidate.population);
            }
        }

        const estimatedArea = areaKm2 && areaKm2 > 1 ? areaKm2 : 2500;
        const radiusKm = Math.sqrt(estimatedArea / Math.PI);
        const density = population ? population / estimatedArea : 50;

        return {
            population: {
                total: population ?? 0,
                density,
                radiusKm
            },
            source: population ? `Open-Meteo and BigDataCloud (${cityName})` : "BigDataCloud approximation",
            meta: {
                city: cityName,
                country: reverse.countryName,
                subdivision: reverse.principalSubdivision
            }
        };
    } catch (error) {
        return {
            population: { total: 0, density: 10, radiusKm: 30 },
            source: "Heuristic fallback",
            error: error.message
        };
    }
}

function inferSurfaceType({ reverse, elevation, landcover }) {
    if (reverse?.isOcean) {
        return reverse.ocean ? `Open ocean (${reverse.ocean})` : "Open ocean";
    }
    if (reverse?.isLake) {
        return reverse.lake ? `Lacustrine environment (${reverse.lake})` : "Lacustrine environment";
    }
    const natural = reverse?.localityInfo?.natural ?? [];
    const informative = reverse?.localityInfo?.informative ?? [];
    const descriptors = [...natural, ...informative]
        .map((item) => (item?.description || item?.name || "").toLowerCase());

    if (descriptors.some((text) => text.includes("desert"))) {
        return "Arid desert terrain";
    }
    if (descriptors.some((text) => text.includes("forest"))) {
        return "Forested terrain";
    }
    if (descriptors.some((text) => text.includes("tundra"))) {
        return "Polar tundra";
    }
    if (descriptors.some((text) => text.includes("mountain"))) {
        return "Mountainous terrain";
    }
    if (descriptors.some((text) => text.includes("urban"))) {
        return "Urbanized landscape";
    }
    if (landcover) {
        return landcover;
    }
    if (typeof elevation === "number" && elevation < -5) {
        return "Below sea level basin";
    }
    if (typeof elevation === "number" && elevation > 3600) {
        return "High alpine environment";
    }
    return "Continental landmass";
}

async function resolveOceanContext(lat, lng) {
    const context = {
        depthMeters: null,
        elevationMeters: null,
        waveHeightMeters: null,
        wavePeriodSeconds: null,
        surfaceTemperatureC: null,
        source: []
    };

    try {
        const bathymetry = await fetchJson(`https://api.opentopodata.org/v1/gebco2020?locations=${lat},${lng}`);
        const result = bathymetry?.results?.[0];
        const elevation = Number(result?.elevation);
        if (Number.isFinite(elevation)) {
            context.elevationMeters = elevation;
            context.depthMeters = elevation < 0 ? Math.abs(elevation) : 0;
            context.source.push("GEBCO 2020 via OpenTopoData");
        }
    } catch (error) {
        // ignore bathymetry failures
    }

    try {
        const marine = await fetchJson(
            `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,sea_surface_temperature,wave_period&length=1&timezone=UTC`
        );
        const hourly = marine?.hourly;
        if (hourly) {
            const waveHeight = Array.isArray(hourly.wave_height) ? Number(hourly.wave_height[0]) : Number(hourly.wave_height);
            const wavePeriod = Array.isArray(hourly.wave_period) ? Number(hourly.wave_period[0]) : Number(hourly.wave_period);
            const temperature = Array.isArray(hourly.sea_surface_temperature)
                ? Number(hourly.sea_surface_temperature[0])
                : Number(hourly.sea_surface_temperature);
            if (Number.isFinite(waveHeight)) {
                context.waveHeightMeters = waveHeight;
            }
            if (Number.isFinite(wavePeriod)) {
                context.wavePeriodSeconds = wavePeriod;
            }
            if (Number.isFinite(temperature)) {
                context.surfaceTemperatureC = temperature;
            }
            context.source.push("Open-Meteo Marine");
        }
    } catch (error) {
        // ignore marine failures
    }

    context.source = context.source.length ? context.source.join("; ") : null;
    return context;
}

function buildFallbackReverse(lat, lng, error) {
    const latHemisphere = lat >= 0 ? "N" : "S";
    const lngHemisphere = lng >= 0 ? "E" : "W";
    const coordinateLabel = `${Math.abs(lat).toFixed(2)}°${latHemisphere}, ${Math.abs(lng).toFixed(2)}°${lngHemisphere}`;
    return {
        city: null,
        locality: null,
        principalSubdivision: null,
        countryName: "Unknown location",
        continent: null,
        localityInfo: { natural: [], informative: [] },
        timezone: null,
        description: coordinateLabel,
        fallback: true,
        fallbackReason: error || "Geocoding service unavailable"
    };
}

async function resolveGeology(lat, lng) {
    const reverseUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    let reverse = buildFallbackReverse(lat, lng);
    try {
        const result = await fetchJson(reverseUrl, { timeoutMs: 6000 });
        if (result && typeof result === "object") {
            reverse = { ...reverse, ...result, fallback: false };
            delete reverse.fallbackReason;
        }
    } catch (error) {
        reverse = buildFallbackReverse(lat, lng, error.message);
    }

    let elevation = null;
    try {
        const elevationData = await fetchJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
        if (Array.isArray(elevationData?.elevation)) {
            elevation = Number(elevationData.elevation[0]);
        } else if (typeof elevationData?.elevation === "number") {
            elevation = Number(elevationData.elevation);
        }
    } catch (error) {
        // ignore elevation failures
    }

    let landcoverLabel = null;
    try {
        const landcoverData = await fetchJson(`https://api.open-meteo.com/v1/landcover?latitude=${lat}&longitude=${lng}`);
        if (Array.isArray(landcoverData?.landcover) && landcoverData.landcover.length > 0) {
            const dominant = landcoverData.landcover.reduce((best, current) => {
                const currentFraction = Number(current?.fraction ?? current?.share ?? current?.value ?? 0);
                const bestFraction = Number(best?.fraction ?? best?.share ?? best?.value ?? 0);
                return currentFraction > bestFraction ? current : best;
            });
            landcoverLabel = dominant?.label || dominant?.class_name || dominant?.name || null;
        }
    } catch (error) {
        // ignore landcover failures
    }

    const labels = [reverse.city, reverse.locality, reverse.principalSubdivision, reverse.countryName].filter(Boolean);
    const label = labels[0] || reverse.description || "Selected location";
    const natural = reverse?.localityInfo?.natural ?? [];
    const informative = reverse?.localityInfo?.informative ?? [];
    const highlights = informative.slice(0, 3).map((item) => item?.description || item?.name).filter(Boolean);
    if (!highlights.length && natural.length) {
        highlights.push(natural[0]?.description || natural[0]?.name);
    }

    let ocean = null;
    try {
        ocean = await resolveOceanContext(lat, lng);
    } catch (error) {
        ocean = null;
    }

    const geology = {
        label,
        country: reverse.countryName || "Unknown location",
        region: reverse.principalSubdivision || null,
        continent: reverse.continent || null,
        elevationMeters: elevation,
        surfaceType: inferSurfaceType({ reverse, elevation, landcover: landcoverLabel, lat }),
        landcover: landcoverLabel,
        naturalFeature: natural[0]?.name || null,
        waterBody: reverse.isOcean ? reverse.ocean || "Open ocean" : reverse.isLake ? reverse.lake || "Lake" : null,
        timezone: reverse.timezone || null,
        highlights: highlights.filter(Boolean),
        ocean
    };
}

function computeImpact({ diameter, velocity, angleDeg, density, terrainKey }) {
    const terrain = TERRAIN[terrainKey] ?? TERRAIN.land;
    const targetDensity = terrain.density;
    const dampening = terrain.dampening;

    const volume = (Math.PI / 6) * diameter ** 3;
    const mass = volume * density;
    const velocityMS = velocity * 1000;
    const angleRad = (angleDeg * Math.PI) / 180;
    const sinAngle = Math.max(Math.sin(angleRad), 0.1);

    const kineticEnergy = 0.5 * mass * velocityMS ** 2;
    const effectiveEnergy = kineticEnergy * sinAngle * dampening;

    const velocityComponent = (velocityMS * sinAngle) ** 0.44;
    const densityRatio = (density / targetDensity) ** 0.333;
    const sizeComponent = diameter ** 0.78;

    const transientCraterDiameter = 1.161 * velocityComponent * densityRatio * sizeComponent;
    const complexityFactor = transientCraterDiameter > 3500 ? 1.28 : 1.16;
    const finalCraterDiameter = transientCraterDiameter * complexityFactor;
    const craterDepth = finalCraterDiameter * 0.19;

    const energyMt = effectiveEnergy / 4.184e15;

    const fireballRadius = Math.pow(energyMt, 0.4) * 1300;
    const shockwaveRadius = Math.pow(energyMt, 0.33) * 4000;
    const severeDamageRadius = Math.max(shockwaveRadius * 0.35, finalCraterDiameter * 0.4);
    const windDamageRadius = Math.max(shockwaveRadius * 0.58, severeDamageRadius * 1.1);
    const windowDamageRadius = Math.max(shockwaveRadius * 1.25, windDamageRadius * 1.1);
    const peakWind = (energyMt ** 0.28) * 120;
    const richterMagnitude = Math.log10(effectiveEnergy) - 4.8;

    return {
        finalCraterDiameter,
        craterDepth,
        fireballRadius,
        shockwaveRadius,
        severeDamageRadius,
        windDamageRadius,
        windowDamageRadius,
        peakWind,
        richterMagnitude,
        energyMt
    };
}

function estimateCasualties(impact, populationInfo, populationOverride) {
    const areaFromRadius = (radius) => {
        const value = Number(radius);
        return Number.isFinite(value) && value > 0 ? Math.PI * (value / 1000) ** 2 : 0;
    };

    const populationDensity = Math.max(populationInfo.density || 50, 1);
    const overridePopulation = Number(populationOverride) || 0;
    const knownPopulation = Math.max(populationInfo.total || 0, 0);
    const explicitPopulation = overridePopulation > 0 ? overridePopulation : knownPopulation;
    const hasExplicitPopulation = explicitPopulation > 0;

    const hazardSpecs = [
        { key: "fireball", radius: impact.fireballRadius, factor: CASUALTY_FATALITY_FACTORS.fireball },
        { key: "blast", radius: impact.severeDamageRadius, factor: CASUALTY_FATALITY_FACTORS.blast },
        { key: "wind", radius: impact.windDamageRadius, factor: CASUALTY_FATALITY_FACTORS.wind },
        { key: "seismic", radius: impact.shockwaveRadius, factor: CASUALTY_FATALITY_FACTORS.seismic }
    ];

    const maxRadius = hazardSpecs.reduce((max, spec) => {
        const radius = Number(spec.radius) || 0;
        return radius > max ? radius : max;
    }, 0);
    const maxArea = areaFromRadius(maxRadius);

    let effectiveDensity = populationDensity;
    if (hasExplicitPopulation && maxArea > 0) {
        effectiveDensity = Math.max(effectiveDensity, explicitPopulation / maxArea);
    }

    const casualties = {};

    hazardSpecs.forEach((spec) => {
        const areaKm2 = areaFromRadius(spec.radius);
        if (areaKm2 <= 0) {
            casualties[spec.key] = { exposed: 0, fatalities: 0 };
            return;
        }
        let exposed = areaKm2 * effectiveDensity;
        if (hasExplicitPopulation) {
            exposed = Math.min(exposed, explicitPopulation);
        }
        const fatalities = exposed * spec.factor;
        casualties[spec.key] = { exposed, fatalities };
    });

    return casualties;
}

function estimateEconomicLoss(casualties, populationInfo, impact) {
    const totalFatalities = Object.values(casualties).reduce((sum, entry) => sum + (entry?.fatalities || 0), 0);
    const densityFactor = Math.max(populationInfo.density / 100, 0.2);
    const infrastructureFactor = (impact.severeDamageRadius / 1000) * 12;
    return totalFatalities * ECONOMIC_LOSS_PER_FATALITY * densityFactor * Math.log1p(infrastructureFactor);
}

function buildFootprints(impact, casualties, infrastructure, tsunami) {
    const toNumber = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };
    const labelWithRadius = (title, radiusMeters) => {
        const radius = toNumber(radiusMeters);
        if (!radius || radius <= 0) return title;
        const km = radius / 1000;
        const digits = km >= 100 ? 0 : km >= 10 ? 1 : 2;
        return `${title} (${km.toFixed(digits)} km)`;
    };
    const stat = (label, value, kind) => {
        const numeric = toNumber(value);
        if (numeric === null) return null;
        return { label, value: numeric, kind };
    };

    const craterDiameter = toNumber(impact?.finalCraterDiameter);
    const craterDepth = toNumber(impact?.craterDepth);
    const craterRadius = craterDiameter && craterDiameter > 0 ? craterDiameter / 2 : null;
    const fireballRadius = toNumber(impact?.fireballRadius);
    const severeRadius = toNumber(impact?.severeDamageRadius);
    const windRadius = toNumber(impact?.windDamageRadius);
    const shockwaveRadius = toNumber(impact?.shockwaveRadius);
    const windowRadius = toNumber(infrastructure?.windowDamageRadius);
    const economicLoss = toNumber(infrastructure?.economicLoss);
    const peakWind = toNumber(impact?.peakWind);
    const richter = toNumber(impact?.richterMagnitude);
    const energyMt = toNumber(impact?.energyMt);
    const fireballFatalities = toNumber(casualties?.fireball?.fatalities);
    const blastFatalities = toNumber(casualties?.blast?.fatalities);
    const windFatalities = toNumber(casualties?.wind?.fatalities);
    const seismicFatalities = toNumber(casualties?.seismic?.fatalities);
    const fireballExposed = toNumber(casualties?.fireball?.exposed);
    const blastExposed = toNumber(casualties?.blast?.exposed);
    const windExposed = toNumber(casualties?.wind?.exposed);
    const seismicExposed = toNumber(casualties?.seismic?.exposed);

    const footprints = [
        {
            type: "crater",
            title: "Crater rim",
            description: "Surface excavation and ejecta blanket",
            label: labelWithRadius("Crater rim", craterRadius),
            radiusMeters: craterRadius ?? 0,
            stats: [stat("Diameter", craterDiameter, "distance"), stat("Depth", craterDepth, "distance")]
        },
        {
            type: "fireball",
            title: "Thermal pulse",
            description: "Extreme heating and vaporization zone",
            label: labelWithRadius("Thermal pulse", fireballRadius),
            radiusMeters: fireballRadius ?? 0,
            stats: [
                stat("Radius", fireballRadius, "distance"),
                stat("Population exposed", fireballExposed, "people"),
                stat("Estimated casualties", fireballFatalities, "people"),
                stat("Impact energy", energyMt, "energy")
            ]
        },
        {
            type: "severe",
            title: "Severe blast",
            description: "High overpressure; structural collapse likely",
            label: labelWithRadius("Severe blast damage", severeRadius),
            radiusMeters: severeRadius ?? 0,
            stats: [
                stat("Radius", severeRadius, "distance"),
                stat("Population exposed", blastExposed, "people"),
                stat("Estimated casualties", blastFatalities, "people")
            ]
        },
        {
            type: "wind",
            title: "Extreme winds",
            description: "Supersonic winds and airborne debris field",
            label: labelWithRadius("Extreme wind field", windRadius),
            radiusMeters: windRadius ?? 0,
            stats: [
                stat("Radius", windRadius, "distance"),
                stat("Peak wind", peakWind, "wind"),
                stat("Population exposed", windExposed, "people"),
                stat("Estimated casualties", windFatalities, "people")
            ]
        },
        {
            type: "shockwave",
            title: "Shockwave front",
            description: "Acoustic wave and widespread damage",
            label: labelWithRadius("Shockwave front", shockwaveRadius),
            radiusMeters: shockwaveRadius ?? 0,
            stats: [
                stat("Radius", shockwaveRadius, "distance"),
                stat("Window damage radius", windowRadius, "distance"),
                stat("Population exposed", seismicExposed, "people"),
                stat("Estimated casualties", seismicFatalities, "people"),
                stat("Estimated economic loss", economicLoss, "currency"),
                stat("Seismic magnitude", richter, "magnitude"),
                stat("Impact energy", energyMt, "energy")
            ]
        }
    ];

    if (tsunami) {
        const inundationRadiusMeters = toNumber(tsunami.inundationDistanceKm ? tsunami.inundationDistanceKm * 1000 : null);
        footprints.push({
            type: "tsunami",
            title: "Tsunami inundation",
            description: "Wave run-up and coastal flooding extent",
            label: labelWithRadius("Tsunami impact", inundationRadiusMeters),
            radiusMeters: inundationRadiusMeters ?? 0,
            stats: [
                stat("Source wave height", tsunami.sourceWaveHeight, "height"),
                stat("Coastal wave height", tsunami.coastalWaveHeight, "height"),
                stat("Run-up height", tsunami.runupHeight, "height"),
                stat("Arrival time", tsunami.arrivalTimeMinutes, "time"),
                stat("Inundation reach", inundationRadiusMeters, "distance"),
                stat("Population exposed", tsunami.exposedPopulation, "people"),
                stat("Estimated casualties", tsunami.fatalities, "people")
            ]
        });
    }

    return footprints.map((footprint) => ({
        ...footprint,
        stats: footprint.stats.filter(Boolean)
    }));
}

function computeTsunamiImpact({ impact, oceanContext, populationInfo, explicitPopulation }) {
    const depthMeters = Number(oceanContext?.depthMeters);
    if (!Number.isFinite(depthMeters) || depthMeters <= 5) {
        return null;
    }

    const craterRadiusKm = (impact.finalCraterDiameter / 2) / 1000;
    const depthKm = depthMeters / 1000;
    const energyMt = Math.max(impact.energyMt, 1);
    const energyFactor = Math.pow(energyMt, 0.28);
    const depthFactor = Math.max(Math.sqrt(depthKm + 0.05), 0.35);
    const sourceWaveHeight = Math.min(energyFactor * 6 / depthFactor, craterRadiusKm * 800) ;
    const travelDistanceKm = Math.max(populationInfo.radiusKm || 60, craterRadiusKm * 2 + 30);
    const coastalWaveHeight = sourceWaveHeight * Math.pow(craterRadiusKm / Math.max(travelDistanceKm, craterRadiusKm + 1), 1.1);
    const runupHeight = coastalWaveHeight * 1.35;
    const inundationDistanceKm = Math.max(runupHeight / 3, 1) + (coastalWaveHeight / 5);

    const gravity = 9.81;
    const waveSpeed = Math.sqrt(gravity * Math.max(depthMeters, 10));
    const arrivalTimeMinutes = (travelDistanceKm * 1000) / waveSpeed / 60;

    const density = Math.max(populationInfo.density || 50, 1);
    let exposedPopulation = Math.PI * inundationDistanceKm ** 2 * density;
    if (explicitPopulation > 0) {
        exposedPopulation = Math.min(exposedPopulation, explicitPopulation);
    }
    const fatalities = exposedPopulation * 0.45;

    return {
        sourceWaveHeight: sourceWaveHeight * 1000,
        coastalWaveHeight: coastalWaveHeight * 1000,
        runupHeight: runupHeight * 1000,
        inundationDistanceKm,
        arrivalTimeMinutes,
        exposedPopulation,
        fatalities,
        depthMeters,
        wavePeriodSeconds: oceanContext?.wavePeriodSeconds ?? null,
        surfaceTemperatureC: oceanContext?.surfaceTemperatureC ?? null,
        waveHeightMeters: oceanContext?.waveHeightMeters ?? null,
        source: oceanContext?.source ?? null
    };
}

function buildSummary(parameters, impact, location, populationInfo, tsunami) {
    const { diameter, velocity, angleDeg, density, terrainKey } = parameters;
    const terrain = TERRAIN[terrainKey] ?? TERRAIN.land;
    const composition = density >= 7000 ? "iron" : density <= 600 ? "cometary" : density <= 2000 ? "carbonaceous" : "stony";
    const energyText = `${impact.energyMt.toFixed(2)} megatons of TNT`;
    const placeText = location.description ? `near ${location.description}` : `at (${location.lat.toFixed(2)}, ${location.lng.toFixed(2)})`;
    const popText = populationInfo.total
        ? `The nearby population is roughly ${populationInfo.total.toLocaleString()}.`
        : "Population data was estimated heuristically.";

    const tsunamiText = tsunami
        ? ` Tsunami modelling projects coastal wave heights near ${Math.max(tsunami.coastalWaveHeight / 1000, 0).toFixed(1)} m with inundation reaching about ${tsunami.inundationDistanceKm.toFixed(1)} km inland.`
        : "";

    return `A ${composition} asteroid ${diameter.toFixed(0)} meters across strikes ${terrain.label} ${placeText} at an angle of ${angleDeg.toFixed(0)}� and ${velocity.toFixed(0)} km/s, releasing about ${energyText}. ${popText}${tsunamiText}`;
}

app.get("/api/geocode", async (req, res) => {
    const query = req.query.query?.trim();
    if (!query) {
        res.status(400).json({ error: "Missing query" });
        return;
    }
    try {
        const url = `https://geocode.maps.co/search?q=${encodeURIComponent(query)}`;
        const results = await fetchJson(url);
        const mapped = (Array.isArray(results) ? results : [])
            .slice(0, 10)
            .map((item) => ({
                label: item.display_name,
                lat: Number(item.lat),
                lng: Number(item.lon)
            }));
        res.json({ results: mapped });
    } catch (error) {
        res.status(500).json({ error: "Geocoding failed", details: error.message });
    }
});

app.get("/api/population", async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: "Invalid coordinates" });
        return;
    }
    const data = await resolvePopulation(lat, lng);
    res.json(data);
});

app.get("/api/geology", async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: "Invalid coordinates" });
        return;
    }
    try {
        const geology = await resolveGeology(lat, lng);
        res.json(geology);
    } catch (error) {
        res.status(500).json({ error: "Geology lookup failed", details: error.message });
    }
});

app.get("/api/asteroids", async (_req, res) => {
    try {
        const url = `https://api.nasa.gov/neo/rest/v1/neo/browse?size=12&api_key=${NASA_API_KEY}`;
        const catalog = await fetchJson(url, { timeoutMs: 8000 });
        const asteroids = (catalog?.near_earth_objects ?? []).map((neo) => {
            const diameterData = neo?.estimated_diameter?.meters;
            const diameter = diameterData
                ? (diameterData.estimated_diameter_min + diameterData.estimated_diameter_max) / 2
                : 150;
            const approach = neo?.close_approach_data?.[0];
            const velocity = approach ? Number(approach.relative_velocity?.kilometers_per_second) : 22;
            const density = neo.is_potentially_hazardous_asteroid ? 6500 : 3200;
            return {
                name: neo.name,
                designation: neo.designation,
                diameter,
                velocity: clamp(velocity, 5, 75),
                density,
                impactAngle: 45,
                absoluteMagnitude: neo.absolute_magnitude_h,
                source: neo.is_sentry_object ? "sentry" : "neo"
            };
        });
        res.json({
            asteroids,
            summary: `Fetched ${asteroids.length} objects from NASA's catalog (NEO browse).`
        });
    } catch (error) {
        const asteroids = fallbackAsteroids.map((neo) => ({
            ...neo,
            diameter: clamp(Number(neo.diameter) || 150, 5, 100000),
            velocity: clamp(Number(neo.velocity) || 22, 5, 75),
            density: clamp(Number(neo.density) || 3200, 500, 11000)
        }));
        res.json({
            asteroids,
            summary: `Using offline asteroid presets (${asteroids.length} objects). NASA catalog unavailable: ${error.message}`
        });
    }
});



app.post("/api/simulate", async (req, res) => {
    const { location, diameter, velocity, angle, density, terrain, populationOverride } = req.body ?? {};
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
        res.status(400).json({ error: "Missing or invalid impact location" });
        return;
    }

    const params = {
        diameter: clamp(Number(diameter) || 0, 5, 100000),
        velocity: clamp(Number(velocity) || 0, 1, 150),
        angleDeg: clamp(Number(angle) || 0, 5, 90),
        density: clamp(Number(density) || 0, 500, 11000),
        terrainKey: terrain ?? "land"
    };

    try {
        const [populationData, geology] = await Promise.all([
            resolvePopulation(location.lat, location.lng),
            resolveGeology(location.lat, location.lng)
        ]);
        const impact = computeImpact(params);
        const casualties = estimateCasualties(impact, populationData.population, Number(populationOverride) || 0);
        const economicLoss = estimateEconomicLoss(casualties, populationData.population, impact);

        const infrastructure = {
            severeDamageRadius: impact.severeDamageRadius,
            windowDamageRadius: impact.windowDamageRadius,
            economicLoss
        };

        const tsunami = computeTsunamiImpact({
            impact,
            oceanContext: geology?.ocean,
            populationInfo: populationData.population,
            explicitPopulation: Number(populationOverride) || 0
        });

        const footprints = buildFootprints(impact, casualties, infrastructure, tsunami);
        const summary = buildSummary(params, impact, location, populationData.population, tsunami);

        res.json({
            summary,
            location,
            population: populationData,
            geology,
            impact: {
                craterDiameter: impact.finalCraterDiameter,
                craterDepth: impact.craterDepth,
                fireballRadius: impact.fireballRadius,
                shockwaveRadius: impact.shockwaveRadius,
                windDamageRadius: impact.windDamageRadius,
                peakWind: impact.peakWind,
                energyMt: impact.energyMt,
                richterMagnitude: impact.richterMagnitude,
                severeDamageRadius: impact.severeDamageRadius,
                windowDamageRadius: impact.windowDamageRadius
            },
            infrastructure,
            casualties,
            tsunami,
            footprints
        });
    } catch (error) {
        res.status(500).json({ error: "Simulation failed", details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Asteroid Impact Lab running on http://localhost:${PORT}`);
});

