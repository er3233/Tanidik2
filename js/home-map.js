(() => {
  const hero = document.getElementById("homeMapHero");
  const mapElement = document.getElementById("homeMap");
  const overlay = document.getElementById("homeMapOverlay");
  const walkButton = document.getElementById("walkModeButton");
  const preview = document.getElementById("homeVenuePreview");

  if (!hero || !mapElement || !walkButton || !preview) return;

  const bodrum = [27.4305, 37.0344];
  const venues = [
    {
      name: "Marina Noir",
      type: "Cocktail lounge",
      description: "Low-lit marina tables, polished service, late coastal sets.",
      coordinates: [27.4242, 37.0355],
    },
    {
      name: "Halicarnassus Echo",
      type: "Open-air club",
      description: "A grand night-stage prototype near the old town rhythm.",
      coordinates: [27.4388, 37.0318],
    },
    {
      name: "Kumbahce Room",
      type: "Listening bar",
      description: "Analog sound, intimate booths, and a salt-air terrace.",
      coordinates: [27.4431, 37.0346],
    },
    {
      name: "Mausoleum 37",
      type: "Rooftop",
      description: "High views, sharp drinks, and a cinematic Bodrum skyline.",
      coordinates: [27.4248, 37.0399],
    },
    {
      name: "Gumbet Pulse",
      type: "Dance venue",
      description: "Neon-forward energy on the west side of the peninsula.",
      coordinates: [27.4054, 37.0342],
    },
    {
      name: "Bitez Afterglow",
      type: "Beach club",
      description: "A slower shoreline mood built for dusk into midnight.",
      coordinates: [27.3838, 37.0294],
    },
    {
      name: "Castle Line",
      type: "Premium bar",
      description: "Glassware, stone streets, and an old-town after-hours path.",
      coordinates: [27.4299, 37.0312],
    },
  ];

  const walkState = {
    active: false,
    keys: new Set(),
    animationFrame: null,
    lastTime: 0,
    dragging: false,
    pointerX: 0,
  };

  let map = null;

  function showFallback() {
    hero.classList.add("home-map-fallback-active");
  }

  function renderPreview(venue) {
    preview.innerHTML = `
      <span>${venue.type}</span>
      <h3>${venue.name}</h3>
      <p>${venue.description}</p>
    `;
    preview.classList.add("is-visible");
  }

  function getNoirStyle() {
    return {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          ],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap &copy; CARTO",
        },
      },
      layers: [
        {
          id: "osm",
          type: "raster",
          source: "osm",
          paint: {
            "raster-brightness-min": 0.02,
            "raster-brightness-max": 0.82,
            "raster-contrast": 0.16,
            "raster-saturation": -0.62,
          },
        },
      ],
    };
  }

  function addMarkers() {
    venues.forEach((venue) => {
      const markerElement = document.createElement("button");
      markerElement.className = "home-map-marker";
      markerElement.type = "button";
      markerElement.setAttribute("aria-label", venue.name);
      markerElement.addEventListener("click", () => {
        renderPreview(venue);
        map.flyTo({
          center: venue.coordinates,
          zoom: Math.max(map.getZoom(), 15.2),
          bearing: map.getBearing() + 8,
          pitch: walkState.active ? 66 : 72,
          duration: 900,
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
    const hasMovement =
      pressed.has("w") ||
      pressed.has("a") ||
      pressed.has("s") ||
      pressed.has("d") ||
      pressed.has("arrowleft") ||
      pressed.has("arrowright");

    if (!hasMovement) return;

    if (pressed.has("arrowleft")) {
      map.setBearing(map.getBearing() - deltaTime * 0.08);
    }

    if (pressed.has("arrowright")) {
      map.setBearing(map.getBearing() + deltaTime * 0.08);
    }

    const forward =
      (pressed.has("w") ? 1 : 0) - (pressed.has("s") ? 1 : 0);
    const strafe =
      (pressed.has("d") ? 1 : 0) - (pressed.has("a") ? 1 : 0);

    if (!forward && !strafe) return;

    const bearing = (map.getBearing() * Math.PI) / 180;
    const metersPerMs = 0.018;
    const distance = deltaTime * metersPerMs;
    const east =
      Math.sin(bearing) * forward * distance +
      Math.cos(bearing) * strafe * distance;
    const north =
      Math.cos(bearing) * forward * distance -
      Math.sin(bearing) * strafe * distance;
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
    walkState.active = active;
    walkButton.setAttribute("aria-pressed", String(active));
    walkButton.textContent = active ? "Exit Walk" : "Walk Mode";
    document.body.classList.toggle("home-walk-active", active);

    if (overlay) {
      overlay.setAttribute("aria-hidden", String(active));
    }

    if (active) {
      preview.classList.remove("is-visible");
      map.easeTo({
        pitch: 64,
        zoom: Math.max(map.getZoom(), 16),
        duration: 650,
        essential: true,
      });
      walkState.lastTime = 0;
      walkState.animationFrame = requestAnimationFrame(walkLoop);
    } else {
      walkState.keys.clear();
      cancelAnimationFrame(walkState.animationFrame);
      map.easeTo({
        pitch: 72,
        zoom: 14.4,
        duration: 650,
        essential: true,
      });
    }
  }

  function setupWalkControls() {
    walkButton.addEventListener("click", () => {
      if (!map) return;
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
      map.setBearing(map.getBearing() + deltaX * 0.18);
    });

    mapElement.addEventListener("pointerup", (event) => {
      walkState.dragging = false;
      mapElement.releasePointerCapture(event.pointerId);
    });
  }

  function initMap() {
    if (!window.maplibregl) {
      showFallback();
      return;
    }

    try {
      map = new maplibregl.Map({
        container: mapElement,
        style: getNoirStyle(),
        center: bodrum,
        zoom: 14.35,
        pitch: 72,
        bearing: -28,
        attributionControl: false,
        antialias: true,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();

      map.on("load", () => {
        mapElement.classList.add("is-ready");
        addMarkers();
        setupWalkControls();
      });

      map.on("error", showFallback);
    } catch (error) {
      console.log(error);
      showFallback();
    }
  }

  // Phase 3 can connect this to Mapillary or Google Street View.
  initMap();
})();
