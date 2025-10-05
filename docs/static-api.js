const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isLocalhost(hostname) {
    if (!hostname) return false;
    if (LOCAL_HOSTNAMES.has(hostname)) return true;
    return hostname === "" || hostname.endsWith(".localhost");
}

export const isStaticMode = !isLocalhost(window.location.hostname);

const NASA_API_KEY = (window?.ASTEROID_LAB_NASA_KEY || "DEMO_KEY").trim() || "DEMO_KEY";
const MS_PER_DAY = 86_400_000;

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

const COMPOSITION_DENSITY = {
    iron: 7800,
    stony: 3300,
    carbonaceous: 1800,
    cometary: 600,
    unknown: 3200
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

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

    const controller = new AbortController();
    const abort = (event) => {
        controller.abort(event?.target?.reason);
    };
    for (const signal of validSignals) {
        if (signal.aborted) {
            controller.abort(signal.reason);
            break;
        }
        signal.addEventListener("abort", abort, { once: true });
    }
    controller.signal.addEventListener(
        "abort",
        () => {
            for (const signal of validSignals) {
                signal.removeEventListener("abort", abort);
            }
        },
        { once: true }
    );
    return controller.signal;
}

async function fetchExternalJson(url, { timeoutMs = 12000, signal, headers = {} } = {}) {
    const controller = new AbortController();
    const combinedSignal = combineAbortSignals([controller.signal, signal]);
    const timeout = setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), timeoutMs);
    try {
        const response = await fetch(url, { headers, signal: combinedSignal });
        if (!response.ok) {
            const message = await response.text();
            throw new Error(`Request failed (${response.status}): ${message}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
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

async function resolvePopulation(lat, lng, { signal } = {}) {
    try {
        const reverseUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
        const reverse = await fetchExternalJson(reverseUrl, { signal });
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
            const search = await fetchExternalJson(searchUrl, { signal });
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
            error: error?.message ?? String(error)
        };
    }
}

function inferSurfaceType({ reverse, elevation, landcover, lat }) {
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
    if (lat && Math.abs(lat) > 70) {
        return "Polar environment";
    }
    return "Continental landmass";
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

async function resolveOceanContext(lat, lng, { signal } = {}) {
    const context = {
        depthMeters: null,
        elevationMeters: null,
        waveHeightMeters: null,
        wavePeriodSeconds: null,
        surfaceTemperatureC: null,
        source: []
    };

    try {
        const bathymetry = await fetchExternalJson(`https://api.opentopodata.org/v1/gebco2020?locations=${lat},${lng}`, { signal });
        const result = bathymetry?.results?.[0];
        const elevation = Number(result?.elevation);
        if (Number.isFinite(elevation)) {
            context.elevationMeters = elevation;
            if (elevation < -0.5) {
                context.depthMeters = Math.abs(elevation);
            } else if (elevation > 0.5) {
                context.depthMeters = null;
            } else {
                context.depthMeters = 0;
            }
            context.source.push("GEBCO 2020 via OpenTopoData");
        }
    } catch (error) {
        // ignore bathymetry failures
    }

    try {
        const marine = await fetchExternalJson(
            `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,sea_surface_temperature,wave_period&length=1&timezone=UTC`,
            { signal }
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

async function resolveGeology(lat, lng, { signal } = {}) {
    const reverseUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    let reverse = buildFallbackReverse(lat, lng);
    try {
        const result = await fetchExternalJson(reverseUrl, { signal, timeoutMs: 6000 });
        if (result && typeof result === "object") {
            reverse = { ...reverse, ...result, fallback: false };
            delete reverse.fallbackReason;
        }
    } catch (error) {
        reverse = buildFallbackReverse(lat, lng, error.message);
    }

    let elevation = null;
    try {
        const elevationData = await fetchExternalJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, { signal });
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
        const landcoverData = await fetchExternalJson(`https://api.open-meteo.com/v1/landcover?latitude=${lat}&longitude=${lng}`, { signal });
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

    let ocean = null;
    try {
        ocean = await resolveOceanContext(lat, lng, { signal });
    } catch (error) {
        ocean = null;
    }

    const labels = [reverse.city, reverse.locality, reverse.principalSubdivision, reverse.countryName].filter(Boolean);
    const label = labels[0] || reverse.description || "Selected location";
    const natural = reverse?.localityInfo?.natural ?? [];
    const informative = reverse?.localityInfo?.informative ?? [];
    const highlights = informative.slice(0, 3).map((item) => item?.description || item?.name).filter(Boolean);
    if (!highlights.length && natural.length) {
        highlights.push(natural[0]?.description || natural[0]?.name);
    }

    return {
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
        ocean,
        fallback: reverse.fallback
            ? {
                  reason: reverse.fallbackReason || "Reverse geocoding service unavailable"
              }
            : null
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
    const peakWind = energyMt ** 0.28 * 120;
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
    const makeNumber = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };
    const labelWithRadius = (title, radiusMeters) => {
        const radius = makeNumber(radiusMeters);
        if (!radius || radius <= 0) return title;
        const km = radius / 1000;
        const digits = km >= 100 ? 0 : km >= 10 ? 1 : 2;
        return `${title} (${km.toFixed(digits)} km)`;
    };
    const stat = (label, value, kind) => {
        const numeric = makeNumber(value);
        if (numeric === null) return null;
        return { label, value: numeric, kind };
    };

    const craterDiameter = makeNumber(impact?.finalCraterDiameter);
    const craterDepth = makeNumber(impact?.craterDepth);
    const craterRadius = craterDiameter && craterDiameter > 0 ? craterDiameter / 2 : null;
    const fireballRadius = makeNumber(impact?.fireballRadius);
    const severeRadius = makeNumber(impact?.severeDamageRadius);
    const windRadius = makeNumber(impact?.windDamageRadius);
    const shockwaveRadius = makeNumber(impact?.shockwaveRadius);
    const windowRadius = makeNumber(infrastructure?.windowDamageRadius);
    const economicLoss = makeNumber(infrastructure?.economicLoss);
    const peakWind = makeNumber(impact?.peakWind);
    const richter = makeNumber(impact?.richterMagnitude);
    const energyMt = makeNumber(impact?.energyMt);
    const fireballFatalities = makeNumber(casualties?.fireball?.fatalities);
    const blastFatalities = makeNumber(casualties?.blast?.fatalities);
    const windFatalities = makeNumber(casualties?.wind?.fatalities);
    const seismicFatalities = makeNumber(casualties?.seismic?.fatalities);
    const fireballExposed = makeNumber(casualties?.fireball?.exposed);
    const blastExposed = makeNumber(casualties?.blast?.exposed);
    const windExposed = makeNumber(casualties?.wind?.exposed);
    const seismicExposed = makeNumber(casualties?.seismic?.exposed);

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
        const inundationRadiusMeters = makeNumber(tsunami.inundationDistanceKm ? tsunami.inundationDistanceKm * 1000 : null);
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

    const craterRadiusKm = impact.finalCraterDiameter / 2 / 1000;
    const depthKm = depthMeters / 1000;
    const energyMt = Math.max(impact.energyMt, 1);
    const energyFactor = Math.pow(energyMt, 0.28);
    const depthFactor = Math.max(Math.sqrt(depthKm + 0.05), 0.35);
    const sourceWaveHeight = Math.min((energyFactor * 6) / depthFactor, craterRadiusKm * 800);
    const travelDistanceKm = Math.max(populationInfo.radiusKm || 60, craterRadiusKm * 2 + 30);
    const coastalWaveHeight = sourceWaveHeight * Math.pow(craterRadiusKm / Math.max(travelDistanceKm, craterRadiusKm + 1), 1.1);
    const runupHeight = coastalWaveHeight * 1.35;
    const inundationDistanceKm = Math.max(runupHeight / 3, 1) + coastalWaveHeight / 5;

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

    const angleText = `${angleDeg.toFixed(0)}°`;
    return `A ${composition} asteroid ${diameter.toFixed(0)} meters across strikes ${terrain.label} ${placeText} at an angle of ${angleText} and ${velocity.toFixed(0)} km/s, releasing about ${energyText}. ${popText}${tsunamiText}`;
}

function deriveFriendlyAlias(rawName) {
    if (!rawName) return null;
    const cleaned = String(rawName).replace(/[()]/g, "").trim();
    if (!cleaned) return null;
    const parts = cleaned.split(/\s+/);
    if (parts.length <= 1) return null;
    const [, ...rest] = parts;
    const candidate = rest.join(" ").trim();
    if (!candidate) return null;
    if (/^\d/.test(candidate)) return null;
    if (!/[a-zA-Z]/.test(candidate)) return null;
    return candidate;
}

function resolveAsteroidNames(neo) {
    const rawName = String(neo?.name ?? "").trim();
    const designation = String(neo?.designation ?? neo?.neo_reference_id ?? "").trim();
    const alias = deriveFriendlyAlias(rawName);
    const officialName = rawName || designation || null;
    const displayName = alias || officialName || designation || "Unnamed near-Earth object";
    return {
        displayName,
        officialName,
        alias: alias || null
    };
}

function estimateComposition(neo, diameterMeters) {
    const name = String(neo?.name ?? "").toLowerCase();
    if (/^(c|p)\//.test(name) || /comet/.test(name)) {
        return "cometary";
    }

    const absoluteMagnitude = toNumber(neo?.absolute_magnitude_h);
    const orbitClass = String(neo?.orbital_data?.orbit_class?.orbit_class_type ?? "").toLowerCase();

    if (orbitClass.includes("aten") || orbitClass.includes("apollo")) {
        if (absoluteMagnitude != null && absoluteMagnitude <= 17.5) {
            return "iron";
        }
    }

    if (absoluteMagnitude != null && absoluteMagnitude >= 22.2) {
        return "carbonaceous";
    }

    if (diameterMeters != null) {
        if (diameterMeters >= 1000 && (absoluteMagnitude == null || absoluteMagnitude <= 19.5)) {
            return "iron";
        }
        if (diameterMeters <= 150 && (absoluteMagnitude == null || absoluteMagnitude >= 21)) {
            return "carbonaceous";
        }
    }

    return "stony";
}

function compositionLabel(key) {
    switch (key) {
        case "iron":
            return "Iron-rich";
        case "stony":
            return "Stony";
        case "carbonaceous":
            return "Carbonaceous";
        case "cometary":
            return "Cometary";
        default:
            return "Unknown";
    }
}

function buildAsteroidRecord(neo) {
    const { displayName, officialName, alias } = resolveAsteroidNames(neo);
    const diameter = neo?.estimated_diameter?.meters;
    const diameterMin = toNumber(diameter?.estimated_diameter_min);
    const diameterMax = toNumber(diameter?.estimated_diameter_max);
    const avgDiameter =
        diameterMin != null && diameterMax != null ? (diameterMin + diameterMax) / 2 : diameterMin ?? diameterMax ?? null;

    const approach = (neo?.close_approach_data ?? []).find((entry) =>
        Number.isFinite(Number(entry?.relative_velocity?.kilometers_per_second))
    );

    const approachVelocity = toNumber(approach?.relative_velocity?.kilometers_per_second);
    const missDistanceKm = toNumber(approach?.miss_distance?.kilometers);
    const missDistanceLunar = toNumber(approach?.miss_distance?.lunar);
    const composition = estimateComposition(neo, avgDiameter);

    const density = COMPOSITION_DENSITY[composition] ?? COMPOSITION_DENSITY.unknown;

    const fallbackId = `neo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const approachDateIso = approach?.close_approach_date ?? null;
    const approachDateFull = approach?.close_approach_date_full ?? null;

    return {
        id: String(neo?.id ?? neo?.neo_reference_id ?? neo?.designation ?? neo?.name ?? fallbackId),
        name: displayName,
        officialName: officialName,
        alias,
        designation: neo?.designation ?? neo?.neo_reference_id ?? null,
        diameter: avgDiameter != null ? clamp(avgDiameter, 5, 100000) : null,
        diameterMin,
        diameterMax,
        velocity: approachVelocity != null ? clamp(approachVelocity, 1, 150) : null,
        impactAngle: 45,
        density,
        absoluteMagnitude: toNumber(neo?.absolute_magnitude_h),
        composition,
        compositionLabel: compositionLabel(composition),
        hazardous: Boolean(neo?.is_potentially_hazardous_asteroid),
        approachDate: approachDateFull ?? approachDateIso ?? null,
        approachDateIso,
        approachBody: approach?.orbiting_body ?? null,
        approachRelativeVelocity: approachVelocity,
        approachMissDistanceKm: missDistanceKm,
        approachMissDistanceLunar: missDistanceLunar,
        orbitClass: neo?.orbital_data?.orbit_class?.orbit_class_type ?? null,
        nasaJplUrl: neo?.nasa_jpl_url ?? null,
        source: "nasa"
    };
}

function buildFallbackAsteroidRecord(asteroid) {
    const alias = deriveFriendlyAlias(asteroid?.name ?? "");
    const displayName = alias ?? asteroid?.name ?? "Unknown object";
    const diameter = clamp(Number(asteroid.diameter) || 0, 5, 100000);
    const density = clamp(Number(asteroid.density) || COMPOSITION_DENSITY.unknown, 500, 11000);
    const velocity = clamp(Number(asteroid.velocity) || 22, 1, 150);

    const composition =
        density >= 6000 ? "iron" : density <= 800 ? "cometary" : density <= 1800 ? "carbonaceous" : "stony";

    return {
        id: String(asteroid.designation ?? asteroid.name ?? `fallback-${Math.random()}`),
        name: displayName,
        officialName: asteroid?.name ?? displayName,
        alias,
        designation: asteroid.designation ?? null,
        diameter,
        diameterMin: diameter,
        diameterMax: diameter,
        velocity,
        approachRelativeVelocity: velocity,
        approachMissDistanceKm: null,
        approachMissDistanceLunar: null,
        impactAngle: clamp(Number(asteroid.impactAngle) || 45, 5, 90),
        density,
        absoluteMagnitude: toNumber(asteroid.absoluteMagnitude),
        composition,
        compositionLabel: compositionLabel(composition),
        hazardous: asteroid.source !== "comet",
        approachDate: null,
        approachDateIso: null,
        approachBody: null,
        orbitClass: asteroid.source === "comet" ? "Comet" : "Near-Earth Object",
        nasaJplUrl: null,
        source: "fallback"
    };
}

let fallbackAsteroidsPromise = null;

async function loadFallbackAsteroids() {
    if (!fallbackAsteroidsPromise) {
        fallbackAsteroidsPromise = fetch("data/asteroids-fallback.json")
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load fallback asteroid data (${response.status})`);
                }
                return response.json();
            })
            .then((json) => (Array.isArray(json) ? json : []))
            .catch((error) => {
                console.error("Failed to load fallback asteroids", error);
                return [];
            });
    }
    const raw = await fallbackAsteroidsPromise;
    return raw.map((item) => buildFallbackAsteroidRecord(item));
}

function filterAsteroidRecords(records, { query, minDiameter, maxDiameter, compositions, hazardousOnly, startDate, endDate }) {
    const startTime = startDate instanceof Date ? startDate.getTime() : null;
    const endTime = endDate instanceof Date ? endDate.getTime() + MS_PER_DAY - 1 : null;

    return records.filter((record) => {
        if (hazardousOnly && !record.hazardous) {
            return false;
        }

        if (Array.isArray(compositions) && compositions.length > 0) {
            if (!record.composition || !compositions.includes(record.composition)) {
                return false;
            }
        }

        if (minDiameter != null && record.diameter != null && record.diameter < minDiameter) {
            return false;
        }

        if (maxDiameter != null && record.diameter != null && record.diameter > maxDiameter) {
            return false;
        }

        if (query) {
            const haystack = [record.name, record.officialName, record.alias, record.designation]
                .filter(Boolean)
                .map((value) => String(value).toLowerCase())
                .join(" ");
            if (!haystack.includes(String(query).toLowerCase())) {
                return false;
            }
        }

        if (startTime != null || endTime != null) {
            const recordTime = Date.parse(record.approachDateIso ?? record.approachDate ?? "");
            if (!Number.isFinite(recordTime)) {
                return false;
            }
            if (startTime != null && recordTime < startTime) {
                return false;
            }
            if (endTime != null && recordTime > endTime) {
                return false;
            }
        }

        return true;
    });
}

async function loadNasaCatalog({ page = 0, size = 25, signal } = {}) {
    const safePage = Number.isFinite(page) && page >= 0 ? Math.min(page, 2000) : 0;
    const safeSize = clamp(Number(size) || 25, 1, 100);
    const url = `https://api.nasa.gov/neo/rest/v1/neo/browse?page=${safePage}&size=${safeSize}&api_key=${NASA_API_KEY}`;
    const catalog = await fetchExternalJson(url, { timeoutMs: 12000, signal });
    const neos = Array.isArray(catalog?.near_earth_objects) ? catalog.near_earth_objects : [];
    const records = neos.map((neo) => buildAsteroidRecord(neo));
    const pageInfo = {
        page: Number.isFinite(Number(catalog?.page?.number)) ? Number(catalog.page.number) : safePage,
        size: Number.isFinite(Number(catalog?.page?.size)) ? Number(catalog.page.size) : safeSize,
        totalPages: Number.isFinite(Number(catalog?.page?.total_pages)) ? Number(catalog.page.total_pages) : 0,
        totalItems: Number.isFinite(Number(catalog?.page?.total_elements)) ? Number(catalog.page.total_elements) : records.length
    };
    const hasMore = pageInfo.page < pageInfo.totalPages - 1;
    const summary = `Fetched ${records.length.toLocaleString()} objects from NASA's Near-Earth Object catalog (page ${
        pageInfo.page + 1
    } of ${pageInfo.totalPages || 1}).`;
    return { records, pageInfo, hasMore, summary };
}

async function loadNasaFeed({ startDate, endDate, page = 0, size = 25, signal } = {}) {
    if (!startDate) {
        throw new Error("A start date is required to load the NASA feed");
    }

    const safeSize = clamp(Number(size) || 25, 1, 100);
    const safePage = Number.isFinite(page) && page >= 0 ? page : 0;
    const params = new URLSearchParams({ start_date: startDate, api_key: NASA_API_KEY });
    if (endDate) {
        params.set("end_date", endDate);
    }

    const url = `https://api.nasa.gov/neo/rest/v1/feed?${params.toString()}`;
    const catalog = await fetchExternalJson(url, { timeoutMs: 12000, signal });
    const nearEarthObjects = catalog?.near_earth_objects ?? {};
    const records = [];

    const sortedDates = Object.keys(nearEarthObjects).sort();
    for (const dateKey of sortedDates) {
        const items = Array.isArray(nearEarthObjects[dateKey]) ? nearEarthObjects[dateKey] : [];
        for (const neo of items) {
            const record = buildAsteroidRecord(neo);
            if (!record.approachDateIso && dateKey) {
                record.approachDateIso = dateKey;
            }
            if (!record.approachDate && dateKey) {
                record.approachDate = dateKey;
            }
            records.push(record);
        }
    }

    records.sort((a, b) => {
        const aTime = Date.parse(a.approachDateIso ?? a.approachDate ?? "");
        const bTime = Date.parse(b.approachDateIso ?? b.approachDate ?? "");
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return aTime - bTime;
    });

    const totalItems = records.length;
    const totalPages = Math.max(Math.ceil(totalItems / safeSize), 1);
    const safePageClamped = Math.min(safePage, totalPages - 1);
    const startIndex = safePageClamped * safeSize;
    const pageRecords = records.slice(startIndex, startIndex + safeSize);
    const hasMore = safePageClamped < totalPages - 1;
    const summary = `Fetched ${totalItems.toLocaleString()} objects approaching Earth between ${startDate} and ${endDate ?? startDate}.`;

    return {
        records: pageRecords,
        pageInfo: {
            page: safePageClamped,
            size: safeSize,
            totalPages,
            totalItems
        },
        hasMore,
        summary
    };
}

function parseDateParam(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return null;
    }
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function formatDateParam(date) {
    if (!(date instanceof Date)) return null;
    return date.toISOString().slice(0, 10);
}

function resolveDateRange(query) {
    const rawStart = query.startDate ?? query.start_date ?? query.get?.("startDate");
    const rawEnd = query.endDate ?? query.end_date ?? query.get?.("endDate");
    const parsedStart = parseDateParam(rawStart);
    const parsedEnd = parseDateParam(rawEnd);

    if (!parsedStart && !parsedEnd) {
        return { start: null, end: null, startString: null, endString: null };
    }

    const startDate = parsedStart ?? parsedEnd;
    let endDate = parsedEnd ?? parsedStart ?? null;
    if (!endDate) {
        endDate = startDate;
    }

    if (endDate < startDate) {
        endDate = startDate;
    }

    const maxSpan = 7 * MS_PER_DAY;
    if (endDate.getTime() - startDate.getTime() > maxSpan) {
        endDate = new Date(startDate.getTime() + maxSpan);
    }

    return {
        start: startDate,
        end: endDate,
        startString: formatDateParam(startDate),
        endString: formatDateParam(endDate)
    };
}

function parseCompositionFilters(value) {
    if (value == null) return [];
    const items = Array.isArray(value) ? value : String(value).split(",");
    return items
        .map((item) => item.trim().toLowerCase())
        .filter((item) => ["stony", "iron", "carbonaceous", "cometary", "unknown"].includes(item));
}

async function geocodeQuery(query, { signal } = {}) {
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(query)}`;
    const results = await fetchExternalJson(url, { signal });
    return (Array.isArray(results) ? results : [])
        .slice(0, 10)
        .map((item) => ({
            label: item.display_name,
            lat: Number(item.lat),
            lng: Number(item.lon)
        }));
}

async function runSimulationStatic(body, { signal } = {}) {
    if (!body?.location || !Number.isFinite(body.location.lat) || !Number.isFinite(body.location.lng)) {
        throw new Error("Missing or invalid impact location");
    }

    const params = {
        diameter: clamp(Number(body.diameter) || 0, 5, 100000),
        velocity: clamp(Number(body.velocity) || 0, 1, 150),
        angleDeg: clamp(Number(body.angle) || 0, 5, 90),
        density: clamp(Number(body.density) || 0, 500, 11000),
        terrainKey: body.terrain ?? "land"
    };

    const [populationData, geology] = await Promise.all([
        resolvePopulation(body.location.lat, body.location.lng, { signal }),
        resolveGeology(body.location.lat, body.location.lng, { signal })
    ]);
    const impact = computeImpact(params);
    const casualties = estimateCasualties(impact, populationData.population, Number(body.populationOverride) || 0);
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
        explicitPopulation: Number(body.populationOverride) || 0
    });

    const footprints = buildFootprints(impact, casualties, infrastructure, tsunami);
    const summary = buildSummary(params, impact, body.location, populationData.population, tsunami);

    return {
        summary,
        location: body.location,
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
    };
}

function parseBody(options) {
    if (!options) return null;
    if (options.body == null) return null;
    if (typeof options.body === "string") {
        try {
            return JSON.parse(options.body);
        } catch (error) {
            console.error("Failed to parse request body", error);
            return null;
        }
    }
    if (options.body instanceof Blob) {
        return null;
    }
    return options.body;
}

async function fetchFallbackAsteroidsPayload() {
    const asteroids = await loadFallbackAsteroids();
    return {
        asteroids,
        page: 0,
        pageSize: asteroids.length,
        totalPages: 1,
        totalItems: asteroids.length,
        hasMore: false,
        summary: `Loaded offline asteroid presets (${asteroids.length} objects).`,
        source: "fallback"
    };
}

async function searchAsteroidsStatic(url, { signal } = {}) {
    const queryParams = url.searchParams;
    const page = Number(queryParams.get("page")) || 0;
    const size = Number(queryParams.get("size")) || 25;
    const query = String(queryParams.get("q") ?? "").trim().toLowerCase();
    const minDiameter = toNumber(queryParams.get("minDiameter"));
    const maxDiameter = toNumber(queryParams.get("maxDiameter"));
    const hazardousOnly = String(queryParams.get("hazardous") ?? "").toLowerCase() === "true";
    const compositions = parseCompositionFilters(queryParams.getAll("composition"));
    const { start: startDateValue, end: endDateValue, startString, endString } = resolveDateRange(queryParams);

    const filters = {
        query,
        minDiameter,
        maxDiameter,
        compositions,
        hazardousOnly,
        startDate: startString,
        endDate: endString
    };

    try {
        const loaderOptions = { page, size, signal };
        const loader = startString
            ? await loadNasaFeed({ ...loaderOptions, startDate: startString, endDate: endString })
            : await loadNasaCatalog(loaderOptions);
        const { records, pageInfo, hasMore, summary } = loader;
        const filtered = filterAsteroidRecords(records, {
            ...filters,
            startDate: startDateValue,
            endDate: endDateValue
        });
        return {
            asteroids: filtered,
            page: pageInfo.page,
            pageSize: pageInfo.size,
            totalPages: pageInfo.totalPages,
            totalItems: pageInfo.totalItems,
            hasMore,
            summary,
            source: "nasa",
            filters
        };
    } catch (error) {
        console.warn("NASA asteroid catalog unavailable, using fallback dataset", error);
        const fallback = await loadFallbackAsteroids();
        const filteredFallback = filterAsteroidRecords(fallback, {
            ...filters,
            startDate: startDateValue,
            endDate: endDateValue
        });
        const rangeNote = startString
            ? ` Requested range ${startString}${endString && endString !== startString ? ` to ${endString}` : ""}.`
            : "";
        const summaryParts = [
            `Using offline asteroid presets (${filteredFallback.length} objects).`,
            error?.message ? `NASA catalog unavailable: ${error.message}` : "NASA catalog unavailable.",
            rangeNote.trim()
        ].filter(Boolean);
        return {
            asteroids: filteredFallback,
            page: 0,
            pageSize: filteredFallback.length,
            totalPages: 1,
            totalItems: filteredFallback.length,
            hasMore: false,
            summary: summaryParts.join(" ").replace(/\s+/g, " ").trim(),
            source: "fallback",
            filters,
            error: error?.message ?? String(error)
        };
    }
}

export async function fetchApiJson(path, options = {}) {
    if (!isStaticMode) {
        const response = await fetch(path, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Request failed (${response.status}): ${text}`);
        }
        if (response.status === 204) {
            return null;
        }
        return response.json();
    }

    const url = new URL(path, window.location.origin);
    const { pathname } = url;

    switch (pathname) {
        case "/api/population": {
            const lat = Number(url.searchParams.get("lat"));
            const lng = Number(url.searchParams.get("lng"));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                throw new Error("Invalid coordinates");
            }
            return resolvePopulation(lat, lng, options);
        }
        case "/api/geology": {
            const lat = Number(url.searchParams.get("lat"));
            const lng = Number(url.searchParams.get("lng"));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                throw new Error("Invalid coordinates");
            }
            return resolveGeology(lat, lng, options);
        }
        case "/api/asteroids/offline": {
            return fetchFallbackAsteroidsPayload();
        }
        case "/api/asteroids/search": {
            return searchAsteroidsStatic(url, options);
        }
        case "/api/geocode": {
            const query = url.searchParams.get("query");
            if (!query) {
                throw new Error("Missing query");
            }
            const results = await geocodeQuery(query, options);
            return { results };
        }
        case "/api/simulate": {
            const body = parseBody(options);
            if (!body) {
                throw new Error("Missing simulation payload");
            }
            return runSimulationStatic(body, options);
        }
        default: {
            throw new Error(`No static handler for ${pathname}`);
        }
    }
}
