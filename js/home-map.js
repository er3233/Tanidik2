(() => {
  const hero = document.getElementById("homeMapHero");
  const mapElement = document.getElementById("homeMap");
  const overlay = document.getElementById("homeMapOverlay");
  const walkButton = document.getElementById("walkModeButton");
  const preview = document.getElementById("homeVenuePreview");

  if (!hero || !mapElement || !walkButton || !preview) return;

  const mapProviderDefaults = {
    atmosphere: "night",
    mapTiler: {
      enabled: true,
      apiBaseUrl: "https://api.maptiler.com",
      styleId: "hybrid",
      styleUrl: "",
      terrainSourceId: "maptilerTerrain",
      terrainTilesetId: "terrain-rgb-v2",
      apiKey: "",
      apiKeyMetaName: "maptiler-api-key",
    },
    fallback: {
      terrainSourceId: "terrainDem",
    },
  };
  const homeMapIntroFlagKey = "tanidik.playMapIntro";
  const mapProviderConfig = getMapProviderConfig();
  const bodrum = [27.4305, 37.0344];
  const homeMapIntro = createHomeMapIntroState();
  const demoVenues = [
    {
      id: null,
      name: "Marina Noir",
      category: "Cocktail lounge",
      city: "Bodrum",
      rating: "4.8",
      description: "Low-lit marina tables, polished service, late coastal sets.",
      coordinates: [27.4242, 37.0355],
      url: "./discover.html",
      demo: true,
    },
    {
      id: null,
      name: "Halicarnassus Echo",
      category: "Open-air club",
      city: "Bodrum",
      rating: "4.7",
      description: "A grand night-stage prototype near the old town rhythm.",
      coordinates: [27.4388, 37.0318],
      url: "./discover.html",
      demo: true,
    },
    {
      id: null,
      name: "Kumbahce Room",
      category: "Listening bar",
      city: "Bodrum",
      rating: "4.6",
      description: "Analog sound, intimate booths, and a salt-air terrace.",
      coordinates: [27.4431, 37.0346],
      url: "./discover.html",
      demo: true,
    },
    {
      id: null,
      name: "Mausoleum 37",
      category: "Rooftop",
      city: "Bodrum",
      rating: "4.9",
      description: "High views, sharp drinks, and a cinematic Bodrum skyline.",
      coordinates: [27.4248, 37.0399],
      url: "./discover.html",
      demo: true,
    },
    {
      id: null,
      name: "Gumbet Pulse",
      category: "Dance venue",
      city: "Bodrum",
      rating: "4.5",
      description: "Neon-forward energy on the west side of the peninsula.",
      coordinates: [27.4054, 37.0342],
      url: "./discover.html",
      demo: true,
    },
    {
      id: null,
      name: "Bitez Afterglow",
      category: "Beach club",
      city: "Bodrum",
      rating: "4.7",
      description: "A slower shoreline mood built for dusk into midnight.",
      coordinates: [27.3838, 37.0294],
      url: "./discover.html",
      demo: true,
    },
    {
      id: null,
      name: "Castle Line",
      category: "Premium bar",
      city: "Bodrum",
      rating: "4.8",
      description: "Glassware, stone streets, and an old-town after-hours path.",
      coordinates: [27.4299, 37.0312],
      url: "./discover.html",
      demo: true,
    },
  ];

  const walkState = {
    active: false,
    keys: new Set(),
    animationFrame: null,
    lastTime: 0,
    dragging: false,
    pointerX: 0,
    controlsReady: false,
    velocityX: 0,
    velocityY: 0,
    turnVelocity: 0,
  };

  let map = null;
  let activeMapProvider = "fallback";
  let activeMapTilerApiKey = "";

  function showFallback() {
    hero.classList.add("home-map-fallback-active");
    finishHomeMapIntro();
  }

  function logHomeMapIntro(message) {
    console.log(`[home-map-intro] ${message}`);
  }

  function prefersReducedMotion() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function hasHomeMapIntroFlag() {
    try {
      const shouldPlay =
        sessionStorage.getItem(homeMapIntroFlagKey) === "1";

      if (shouldPlay) {
        logHomeMapIntro("flag bulundu");
      }

      return shouldPlay;
    } catch (error) {
      return false;
    }
  }

  function clearHomeMapIntroFlag() {
    try {
      sessionStorage.removeItem(homeMapIntroFlagKey);
    } catch (error) {
      console.log("[home-map-intro] flag silinemedi:", error);
    }
  }

  function setHomeMapIntroClasses(active) {
    document.body.classList.toggle("home-map-intro-active", active);
    hero.classList.toggle("home-map-intro-active", active);
    document.body.classList.toggle("home-map-intro-done", !active);
    hero.classList.toggle("home-map-intro-done", !active);
  }

  function createHomeMapIntroState() {
    const flagFound = hasHomeMapIntroFlag();
    const reducedMotion = prefersReducedMotion();
    const requested = flagFound && !reducedMotion;

    if (flagFound && reducedMotion) {
      clearHomeMapIntroFlag();
      logHomeMapIntro("reduced motion nedeniyle atlandı");
    }

    setHomeMapIntroClasses(requested);

    return {
      requested,
      completed: !requested,
      fallbackTimer: null,
    };
  }

  function finishHomeMapIntro() {
    if (homeMapIntro.completed) return;

    homeMapIntro.completed = true;
    window.clearTimeout(homeMapIntro.fallbackTimer);
    clearHomeMapIntroFlag();
    setHomeMapIntroClasses(false);
    logHomeMapIntro("intro tamamlandı");
  }

  function getMapProviderConfig() {
    const runtimeConfig = window.TANIDIK_MAP_CONFIG || {};
    const runtimeMapTiler =
      runtimeConfig.mapTiler || runtimeConfig.maptiler || {};

    return {
      atmosphere: runtimeConfig.atmosphere || mapProviderDefaults.atmosphere,
      mapTiler: {
        ...mapProviderDefaults.mapTiler,
        ...runtimeMapTiler,
      },
      fallback: {
        ...mapProviderDefaults.fallback,
        ...(runtimeConfig.fallback || {}),
      },
    };
  }

  function getMetaContent(name) {
    if (!name) return "";

    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta ? meta.content.trim() : "";
  }

  function getMapTilerApiKey() {
    const configuredKey = String(mapProviderConfig.mapTiler.apiKey || "").trim();

    return (
      configuredKey ||
      getMetaContent(mapProviderConfig.mapTiler.apiKeyMetaName)
    );
  }

  function appendQueryParam(url, key, value) {
    const separator = url.includes("?") ? "&" : "?";

    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }

  function getMapTilerBaseUrl() {
    return String(mapProviderConfig.mapTiler.apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");
  }

  function getMapTilerStyleUrl(apiKey) {
    const configuredUrl = String(mapProviderConfig.mapTiler.styleUrl || "").trim();

    if (configuredUrl) {
      return appendQueryParam(configuredUrl, "key", apiKey);
    }

    const styleId = encodeURIComponent(mapProviderConfig.mapTiler.styleId);
    return appendQueryParam(
      `${getMapTilerBaseUrl()}/maps/${styleId}/style.json`,
      "key",
      apiKey
    );
  }

  function getMapTilerTerrainUrl(apiKey) {
    const tilesetId = encodeURIComponent(
      mapProviderConfig.mapTiler.terrainTilesetId
    );

    return appendQueryParam(
      `${getMapTilerBaseUrl()}/tiles/${tilesetId}/tiles.json`,
      "key",
      apiKey
    );
  }

  function setMapPresentation(provider) {
    activeMapProvider = provider;
    hero.classList.toggle("home-map-provider-maptiler", provider === "maptiler");
    hero.classList.toggle("home-map-provider-fallback", provider !== "maptiler");
    hero.dataset.mapAtmosphere = mapProviderConfig.atmosphere || "night";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderPreview(venue) {
    const meta = [venue.city, venue.category, venue.rating ? `${venue.rating} / 5` : ""]
      .filter(Boolean)
      .map(escapeHtml)
      .join(" · ");
    const href = venue.url || (venue.id ? `./venue.html?id=${venue.id}` : "#");

    preview.innerHTML = `
      <span>${meta || "TANIDIK venue"}</span>
      <h3>${escapeHtml(venue.name)}</h3>
      <p>${escapeHtml(venue.description || "Premium nightlife venue.")}</p>
      <a class="home-venue-link" href="${escapeHtml(href)}">View venue</a>
    `;
    preview.classList.add("is-visible");
  }

  function getSupabaseClient() {
    if (
      typeof supabaseClient !== "undefined" &&
      supabaseClient &&
      typeof supabaseClient.from === "function"
    ) {
      return supabaseClient;
    }

    if (
      window.supabaseClient &&
      typeof window.supabaseClient.from === "function"
    ) {
      return window.supabaseClient;
    }

    return null;
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getCoordinate(record, names) {
    for (const name of names) {
      if (record[name] !== undefined && record[name] !== null) {
        const value = toNumber(record[name]);
        if (value !== null) return value;
      }
    }

    return null;
  }

  function getVenueCoordinates(record) {
    const lat = getCoordinate(record, ["latitude", "lat"]);
    const lng = getCoordinate(record, ["longitude", "lng", "lon"]);

    if (
      lat === null ||
      lng === null ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return [lng, lat];
  }

  function getVenueRating(record) {
    const rating =
      record.averageRating ||
      record.average_rating ||
      record.rating ||
      record.review_rating;
    const number = toNumber(rating);

    return number === null ? "" : number.toFixed(1);
  }

  function normalizeVenue(record) {
    const coordinates = getVenueCoordinates(record);

    if (!coordinates) return null;

    return {
      id: record.id || null,
      name: record.name || record.title || "TANIDIK Venue",
      city: record.city || record.location || "",
      category: record.category || record.type || record.venue_type || "",
      rating: getVenueRating(record),
      description:
        record.description ||
        record.summary ||
        record.short_description ||
        "Premium nightlife venue.",
      coordinates,
      url: record.id ? `./venue.html?id=${encodeURIComponent(record.id)}` : "#",
      demo: false,
    };
  }

  async function loadMapVenues() {
    const client = getSupabaseClient();

    if (!client) {
      console.log("[home-map] Supabase unavailable; fallback demo markers used.");
      return demoVenues;
    }

    try {
      const { data, error } = await client
        .from("venues")
        .select("*")
        .limit(80);

      if (error) throw error;

      const realVenues = (data || [])
        .map(normalizeVenue)
        .filter(Boolean);

      console.log(`[home-map] Loaded real venues count: ${realVenues.length}`);

      if (realVenues.length) return realVenues;

      console.log("[home-map] No venue coordinates found; fallback demo markers used.");
      return demoVenues;
    } catch (error) {
      console.log("[home-map] Venue loading failed; fallback demo markers used.", error);
      return demoVenues;
    }
  }

  function getFallbackSatelliteStyle() {
    return {
      version: 8,
      sources: {
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP",
          maxzoom: 19,
        },
        terrainDem: {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          tileSize: 256,
          encoding: "terrarium",
          maxzoom: 14,
        },
      },
      layers: [
        {
          id: "satellite",
          type: "raster",
          source: "satellite",
        },
      ],
    };
  }

  function getMapStyle() {
    const apiKey = getMapTilerApiKey();

    if (mapProviderConfig.mapTiler.enabled && apiKey) {
      activeMapTilerApiKey = apiKey;
      setMapPresentation("maptiler");
      return getMapTilerStyleUrl(apiKey);
    }

    activeMapTilerApiKey = "";
    setMapPresentation("fallback");

    if (mapProviderConfig.mapTiler.enabled) {
      console.log("[home-map] MapTiler API key missing; Esri fallback used.");
    }

    return getFallbackSatelliteStyle();
  }

  function addMapTilerTerrainSource() {
    const sourceId = mapProviderConfig.mapTiler.terrainSourceId;

    if (!activeMapTilerApiKey || !sourceId || map.getSource(sourceId)) return;

    map.addSource(sourceId, {
      type: "raster-dem",
      url: getMapTilerTerrainUrl(activeMapTilerApiKey),
      encoding: "mapbox",
      maxzoom: 14,
    });
  }

  function setupTerrainAndSky() {
    try {
      const terrainSourceId =
        activeMapProvider === "maptiler"
          ? mapProviderConfig.mapTiler.terrainSourceId
          : mapProviderConfig.fallback.terrainSourceId;

      if (activeMapProvider === "maptiler") {
        addMapTilerTerrainSource();
      }

      if (terrainSourceId && map.getSource(terrainSourceId)) {
        map.setTerrain({
          source: terrainSourceId,
          exaggeration: activeMapProvider === "maptiler" ? 1.18 : 1.5,
        });
      }

      if (!map.getLayer("sky")) {
        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 30.0],
            "sky-atmosphere-sun-intensity": 15,
          },
        });
      }
    } catch (e) {
      console.log("[home-map] Terrain/sky unavailable:", e);
    }
  }

  function getInitialCamera() {
    if (homeMapIntro.requested) {
      return {
        center: [0, 20],
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
      };
    }

    return {
      center: bodrum,
      zoom: 13.8,
      pitch: 65,
      bearing: -28,
    };
  }

  function playHomeMapIntro() {
    if (!homeMapIntro.requested || !map) {
      finishHomeMapIntro();
      return;
    }

    logHomeMapIntro("intro başladı");
    clearHomeMapIntroFlag();
    map.once("moveend", finishHomeMapIntro);
    homeMapIntro.fallbackTimer = window.setTimeout(
      finishHomeMapIntro,
      3400
    );

    logHomeMapIntro("flyTo başladı");
    map.flyTo({
      center: bodrum,
      zoom: 14,
      pitch: 65,
      bearing: -20,
      duration: 2800,
      curve: 1.45,
      speed: 1.2,
      essential: true,
    });
  }

  function addMarkers(venues) {
    venues.forEach((venue) => {
      const markerElement = document.createElement("button");
      markerElement.className = venue.demo
        ? "home-map-marker"
        : "home-map-marker home-map-marker--real";
      markerElement.type = "button";
      markerElement.setAttribute("aria-label", venue.name);

      const pinLabel = document.createElement("span");
      pinLabel.className = "home-map-pin-label";
      pinLabel.textContent = venue.name;
      markerElement.appendChild(pinLabel);

      markerElement.addEventListener("click", () => {
        renderPreview(venue);
        map.flyTo({
          center: venue.coordinates,
          zoom: Math.max(map.getZoom(), 15.2),
          bearing: map.getBearing() + (walkState.active ? 4 : 8),
          pitch: walkState.active ? 74 : 72,
          duration: walkState.active ? 620 : 900,
          essential: true,
        });
      });

      new maplibregl.Marker({
        element: markerElement,
        anchor: "center",
      })
        .setLngLat(venue.coordinates)
        .addTo(map);
    });
  }

  function moveByKeys(deltaTime) {
    if (!walkState.active || !map) return;

    const pressed = walkState.keys;
    const seconds = deltaTime / 1000;
    const targetForward =
      (pressed.has("w") ? 1 : 0) - (pressed.has("s") ? 1 : 0);
    const targetStrafe =
      (pressed.has("d") ? 1 : 0) - (pressed.has("a") ? 1 : 0);
    const targetTurn =
      (pressed.has("arrowright") ? 1 : 0) -
      (pressed.has("arrowleft") ? 1 : 0);
    const accel = Math.min(1, deltaTime / 120);
    const brake = Math.min(1, deltaTime / 170);

    walkState.velocityY +=
      (targetForward * 1.25 - walkState.velocityY) *
      (targetForward ? accel : brake);
    walkState.velocityX +=
      (targetStrafe * 1.05 - walkState.velocityX) *
      (targetStrafe ? accel : brake);
    walkState.turnVelocity +=
      (targetTurn * 58 - walkState.turnVelocity) *
      (targetTurn ? accel : brake);

    if (Math.abs(walkState.velocityY) < 0.006) walkState.velocityY = 0;
    if (Math.abs(walkState.velocityX) < 0.006) walkState.velocityX = 0;
    if (Math.abs(walkState.turnVelocity) < 0.06) {
      walkState.turnVelocity = 0;
    }

    if (walkState.turnVelocity) {
      map.setBearing(map.getBearing() + walkState.turnVelocity * seconds);
    }

    if (!walkState.velocityY && !walkState.velocityX) return;

    const bearing = (map.getBearing() * Math.PI) / 180;
    const metersPerSecond = 34;
    const forwardDistance = walkState.velocityY * metersPerSecond * seconds;
    const strafeDistance = walkState.velocityX * metersPerSecond * seconds;
    const east =
      Math.sin(bearing) * forwardDistance +
      Math.cos(bearing) * strafeDistance;
    const north =
      Math.cos(bearing) * forwardDistance -
      Math.sin(bearing) * strafeDistance;
    const center = map.getCenter();
    const latFactor = 111320;
    const lngFactor =
      111320 * Math.cos((center.lat * Math.PI) / 180);

    map.setCenter([
      center.lng + east / lngFactor,
      center.lat + north / latFactor,
    ]);
  }

  function walkLoop(time) {
    const deltaTime = walkState.lastTime
      ? Math.min(time - walkState.lastTime, 48)
      : 16;

    walkState.lastTime = time;
    moveByKeys(deltaTime);
    walkState.animationFrame = requestAnimationFrame(walkLoop);
  }

  function setWalkMode(active) {
    if (!map) {
      console.log("[home-map] Walk Mode unavailable: map is not ready.");
      return;
    }

    if (walkState.active === active) return;

    walkState.active = active;
    walkButton.setAttribute("aria-pressed", String(active));
    walkButton.textContent = active ? "Exit Walk" : "Walk Mode";
    document.body.classList.toggle("home-walk-active", active);
    hero.classList.toggle("home-walk-active", active);

    if (overlay) {
      overlay.setAttribute("aria-hidden", String(active));
    }

    if (active) {
      console.log("[home-map] Walk Mode enabled.");
      preview.classList.remove("is-visible");
      cancelAnimationFrame(walkState.animationFrame);
      map.easeTo({
        pitch: 76,
        zoom: Math.max(map.getZoom(), 16.35),
        duration: 760,
        essential: true,
      });
      walkState.lastTime = 0;
      walkState.animationFrame = requestAnimationFrame(walkLoop);
    } else {
      console.log("[home-map] Walk Mode disabled.");
      walkState.keys.clear();
      walkState.velocityX = 0;
      walkState.velocityY = 0;
      walkState.turnVelocity = 0;
      cancelAnimationFrame(walkState.animationFrame);
      walkState.animationFrame = null;
      map.easeTo({
        pitch: 72,
        zoom: 14.4,
        duration: 650,
        essential: true,
      });
    }
  }

  function setupWalkControls() {
    if (walkState.controlsReady) return;
    walkState.controlsReady = true;

    walkButton.addEventListener("click", () => {
      setWalkMode(!walkState.active);
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if (key === "escape" && walkState.active) {
        setWalkMode(false);
        return;
      }

      if (!walkState.active) return;

      if (
        ["w", "a", "s", "d", "arrowleft", "arrowright"].includes(key)
      ) {
        event.preventDefault();
        walkState.keys.add(key);
      }
    });

    window.addEventListener("keyup", (event) => {
      walkState.keys.delete(event.key.toLowerCase());
    });

    mapElement.addEventListener("pointerdown", (event) => {
      if (!walkState.active) return;
      walkState.dragging = true;
      walkState.pointerX = event.clientX;
      mapElement.setPointerCapture(event.pointerId);
    });

    mapElement.addEventListener("pointermove", (event) => {
      if (!walkState.active || !walkState.dragging) return;
      const deltaX = event.clientX - walkState.pointerX;
      walkState.pointerX = event.clientX;
      map.setBearing(map.getBearing() + deltaX * 0.14);
    });

    mapElement.addEventListener("pointerup", (event) => {
      walkState.dragging = false;
      mapElement.releasePointerCapture(event.pointerId);
    });

    mapElement.addEventListener("pointercancel", () => {
      walkState.dragging = false;
    });
  }

  async function handleMapLoaded() {
    logHomeMapIntro("map loaded");
    setupTerrainAndSky();
    mapElement.classList.add("is-ready");
    playHomeMapIntro();
    const mapVenues = await loadMapVenues();
    addMarkers(mapVenues);
  }

  function whenMapLoaded(callback) {
    if (typeof map.loaded === "function" && map.loaded()) {
      callback();
      return;
    }

    map.once("load", callback);
  }

  function initMap() {
    if (!window.maplibregl) {
      showFallback();
      return;
    }

    try {
      const initialCamera = getInitialCamera();

      map = new maplibregl.Map({
        container: mapElement,
        style: getMapStyle(),
        center: initialCamera.center,
        zoom: initialCamera.zoom,
        pitch: initialCamera.pitch,
        bearing: initialCamera.bearing,
        attributionControl: false,
        antialias: true,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      setupWalkControls();

      whenMapLoaded(() => {
        handleMapLoaded();
      });

      map.on("error", showFallback);
    } catch (error) {
      console.log(error);
      showFallback();
    }
  }

  initMap();
})();
