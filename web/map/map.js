/* Lastbook Ireland — offline map.
   Basemap: Protomaps (OpenStreetMap) vector tiles to z15, every road, path, building, POI and place on the island.
   Terrain: Mapterhorn Terrarium elevation (512 px tiles to z12, ~11 m/px) → hillshade, contour lines (generated on the fly), 3D, spot heights.
   Overlays: 32k emergency & resource points (hospitals, AEDs, pharmacies, Garda/PSNI, water, shelter…).
   Everything is read from local files; no network needed.
   Requires classic globals loaded first: pmtiles, basemaps, mlcontour, GEO (../geo.js). */
import * as maplibregl from "./vendor/maplibre-gl.mjs";

const abs = p => new URL(p, location.href).href;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem("lb.map." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("lb.map." + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

export async function initMap(root, opts = {}) {
  const DATA = opts.data || "/data/map/";
  const ASSETS = opts.assets || new URL(".", import.meta.url).href;
  const PM_URL = abs(DATA + "ireland.pmtiles");
  const DEM_URL = abs(DATA) + "terrain/{z}/{x}/{y}.webp"; // template braces must not be URL-encoded

  // ---------- state ----------
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const S = Object.assign({
    flavor: prefersDark ? "dark" : "light", lang: "en", hillshade: true, contours: true, terrain3d: false,
    cats: null, aeOnly: false,
  }, store.get("state", {}));
  if (opts.flavor) S.flavor = opts.flavor;
  const save = () => store.set("state", S);

  // ---------- data ----------
  const [poiFC, places] = await Promise.all([
    fetch(abs(ASSETS + "data/pois.geojson")).then(r => r.json()),
    fetch(abs(ASSETS + "data/places.json")).then(r => r.ok ? r.json() : []).catch(() => []),
  ]);
  const CATS = poiFC.cats;
  if (!S.cats) S.cats = Object.fromEntries(CATS.map(c => [c.id, !["toilets", "school", "food", "fuel", "hardware", "vet"].includes(c.id)]));
  poiFC.features.forEach((f, i) => { f.id = i; f.properties.k = CATS[f.properties.c].id; });
  const byCat = {};
  for (const f of poiFC.features) (byCat[f.properties.k] ||= []).push(f);

  // ---------- protocols ----------
  const pmProtocol = new pmtiles.Protocol({ metadata: true });
  pmProtocol.add(new pmtiles.PMTiles(PM_URL)); // one shared archive instance: restyles reuse its header & directories
  maplibregl.addProtocol("pmtiles", pmProtocol.tile);
  const dem = new mlcontour.DemSource({ url: DEM_URL, encoding: "terrarium", maxzoom: 12, worker: true, cacheSize: 200 });
  dem.setupMaplibre(maplibregl);

  // ---------- style ----------
  const dark = () => S.flavor === "dark" || S.flavor === "black";
  function buildStyle() {
    const flavor = basemaps.namedFlavor(S.flavor);
    const base = basemaps.layers("protomaps", flavor, { lang: S.lang });
    const ink = dark() ? "#94a3b8" : "#7c5a3a";
    const hill = {
      id: "hillshade", type: "hillshade", source: "dem-hs", layout: { visibility: S.hillshade ? "visible" : "none" },
      paint: {
        "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 6, 0.55, 12, 0.35, 15, 0.25],
        "hillshade-shadow-color": dark() ? "rgba(0,0,0,0.55)" : "rgba(60,50,40,0.45)",
        "hillshade-highlight-color": dark() ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.35)",
        "hillshade-accent-color": dark() ? "rgba(0,0,0,0.2)" : "rgba(80,70,50,0.15)",
      },
    };
    const vis = S.contours ? "visible" : "none";
    const contourLine = {
      id: "contours", type: "line", source: "contours", "source-layer": "contours", minzoom: 10, filter: [">", ["get", "ele"], 0], layout: { visibility: vis, "line-join": "round" },
      paint: {
        "line-color": ink, "line-opacity": ["case", ["==", ["get", "level"], 1], 0.55, 0.28],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, ["case", ["==", ["get", "level"], 1], 0.6, 0.3], 15, ["case", ["==", ["get", "level"], 1], 1.3, 0.7]],
      },
    };
    const contourLabel = {
      id: "contour-labels", type: "symbol", source: "contours", "source-layer": "contours", minzoom: 12,
      filter: ["all", [">", ["get", "level"], 0], [">", ["get", "ele"], 0]],
      layout: {
        visibility: vis, "symbol-placement": "line", "text-field": ["concat", ["number-format", ["get", "ele"], {}], " m"],
        "text-font": ["Noto Sans Regular"], "text-size": 10, "symbol-spacing": 320, "text-max-angle": 25,
      },
      paint: { "text-color": ink, "text-halo-color": dark() ? "#151b19" : "#f8f5ef", "text-halo-width": 1.4 },
    };
    // insert terrain beneath water & roads so the basemap stays crisp
    const iWater = base.findIndex(l => l.id === "water");
    const iRoads = base.findIndex((l, i) => i > iWater && l.id.startsWith("roads_"));
    const layers = [...base.slice(0, iWater), hill, ...base.slice(iWater, iRoads), contourLine, ...base.slice(iRoads), contourLabel, ...poiLayers()];
    return {
      version: 8,
      glyphs: abs(ASSETS) + "fonts/{fontstack}/{range}.pbf",
      sprite: abs(ASSETS + "sprites/" + (dark() ? "dark" : "light")),
      sources: {
        protomaps: { type: "vector", url: "pmtiles://" + PM_URL, attribution: "© OpenStreetMap contributors · Protomaps" },
        "dem-hs": { type: "raster-dem", tiles: [DEM_URL], encoding: "terrarium", tileSize: 512, maxzoom: 12, attribution: "Terrain © Mapterhorn (Copernicus GLO-30 & national DEMs)" },
        "dem-3d": { type: "raster-dem", tiles: [DEM_URL], encoding: "terrarium", tileSize: 512, maxzoom: 12 },
        contours: {
          type: "vector", maxzoom: 15,
          tiles: [dem.contourProtocolUrl({ thresholds: { 10: [100, 500], 11: [50, 250], 12: [20, 100], 13: [10, 50], 14: [10, 50] }, contourLayer: "contours", elevationKey: "ele", levelKey: "level", extent: 4096, buffer: 1 })],
        },
        pois: { type: "geojson", data: poiFC, promoteId: undefined },
        measure: { type: "geojson", data: emptyFC() },
        me: { type: "geojson", data: emptyFC() },
      },
      layers,
      terrain: S.terrain3d ? { source: "dem-3d", exaggeration: 1.4 } : undefined,
      sky: { "sky-color": dark() ? "#0d1110" : "#cfe3ef", "horizon-color": dark() ? "#151b19" : "#e6f0f2", "fog-color": dark() ? "#0d1110" : "#f3f1ec", "sky-horizon-blend": 0.5 },
    };
  }
  const CRITICAL = ["hospital", "aed", "police", "fire", "ambulance", "coast"];
  function catFilter() {
    const on = CATS.filter(c => S.cats[c.id]).map(c => c.id);
    const f = ["all", ["in", ["get", "k"], ["literal", on]]];
    if (S.aeOnly) f.push(["any", ["!=", ["get", "k"], "hospital"], ["==", ["get", "ae"], 1]]);
    return f;
  }
  function poiLayers() {
    const halo = dark() ? "#0d1110" : "#ffffff";
    return [
      { id: "measure-line", type: "line", source: "measure", filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": "#f43f5e", "line-width": 3, "line-dasharray": [2, 1.2] } },
      { id: "measure-pts", type: "circle", source: "measure", filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#f43f5e", "circle-stroke-width": 2.5 } },
      { id: "poi-hosp", type: "circle", source: "pois", maxzoom: 9, filter: ["all", catFilter(), ["==", ["get", "k"], "hospital"]],
        paint: { "circle-color": "#dc2626", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["case", ["==", ["get", "ae"], 1], 3.5, 2], 9, ["case", ["==", ["get", "ae"], 1], 6, 4]],
          "circle-stroke-color": halo, "circle-stroke-width": 1.2 } },
      { id: "poi-dots", type: "circle", source: "pois", minzoom: 9, maxzoom: 12.5, filter: catFilter(),
        paint: {
          "circle-color": ["match", ["get", "k"], ...CATS.flatMap(c => [c.id, c.color]), "#888"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "k"], "hospital", 6, 2.2], 12.5, ["match", ["get", "k"], "hospital", 7, 4.5]],
          "circle-stroke-color": halo, "circle-stroke-width": 1,
        } },
      // life-safety points always draw; everything else yields when crowded
      ...[["poi-icons-minor", false], ["poi-icons", true]].map(([id, crit]) => ({
        id, type: "symbol", source: "pois", minzoom: 12.5,
        filter: ["all", catFilter(), (crit ? ["in", ["get", "k"], ["literal", CRITICAL]] : ["!", ["in", ["get", "k"], ["literal", CRITICAL]]])],
        layout: {
          "icon-image": ["concat", "lb-", ["get", "k"]], "icon-size": ["interpolate", ["linear"], ["zoom"], 12.5, 0.6, 17, 0.85],
          "icon-allow-overlap": crit, "icon-ignore-placement": false, "icon-anchor": "bottom", "icon-padding": 1,
          "symbol-sort-key": ["match", ["get", "k"], "hospital", 0, "aed", 1, "police", 2, "fire", 3, "ambulance", 4, "coast", 5, "pharmacy", 6, "water", 7, "shelter", 8, 10],
          "text-field": ["step", ["zoom"], "", 15, ["get", "n"]], "text-font": ["Noto Sans Medium"], "text-size": 11,
          "text-anchor": "top", "text-offset": [0, 0.2], "text-max-width": 9, "text-optional": true,
        },
        paint: { "text-color": ["match", ["get", "k"], ...CATS.flatMap(c => [c.id, c.color]), "#333"], "text-halo-color": halo, "text-halo-width": 1.6 },
      })),
    ];
  }

  // marker images drawn on canvas (uses system fonts, so symbols render without glyph files)
  function markerImage(cat) {
    const r = devicePixelRatio > 1 ? 2 : 1, w = 30 * r, h = 38 * r, c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.scale(r, r);
    g.beginPath(); g.moveTo(15, 37); g.bezierCurveTo(6, 26, 2, 21, 2, 15); g.arc(15, 15, 13, Math.PI, 0); g.bezierCurveTo(28, 21, 24, 26, 15, 37); g.closePath();
    g.fillStyle = cat.color; g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${cat.glyph.length > 1 || cat.glyph.charCodeAt(0) > 255 ? 13 : 14}px -apple-system, system-ui, sans-serif`;
    g.fillText(cat.glyph, 15, 15.5);
    return { width: w, height: h, data: g.getImageData(0, 0, w, h).data, pixelRatio: r };
  }

  // ---------- map ----------
  const saved = store.get("view", { center: [-7.9, 53.45], zoom: 6.4 });
  const map = new maplibregl.Map({
    container: $(".lbm-canvas", root), style: buildStyle(), center: saved.center, zoom: saved.zoom, bearing: saved.bearing || 0, pitch: saved.pitch || 0,
    maxZoom: 19, minZoom: 4, maxBounds: [[-16, 49], [0, 58]], attributionControl: { compact: true }, hash: opts.hash ?? "map",
    canvasContextAttributes: { preserveDrawingBuffer: false },
  });
  window.lbMap = map;
  const addMarkers = () => CATS.forEach(c => { if (!map.hasImage("lb-" + c.id)) map.addImage("lb-" + c.id, markerImage(c)); });
  map.on("style.load", addMarkers);
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true });
  map.addControl(geo, "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 140 }), "bottom-left");
  let me = store.get("me", null);
  geo.on("geolocate", e => { me = { lat: e.coords.latitude, lon: e.coords.longitude, t: Date.now() }; store.set("me", me); });
  map.on("moveend", () => store.set("view", { center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }));
  const restyle = () => { save(); map.setStyle(buildStyle()); root.dataset.theme = dark() ? "dark" : "light"; };
  root.dataset.theme = dark() ? "dark" : "light";

  // ---------- elevation from the DEM (for clicks, measure profile) ----------
  const tileCache = new Map();
  async function demTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (!tileCache.has(key)) tileCache.set(key, (async () => {
      const r = await fetch(DEM_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y));
      if (!r.ok) return null;
      const bmp = await createImageBitmap(await r.blob());
      const w = bmp.width, c = new OffscreenCanvas(w, w), g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      return { w, d: g.getImageData(0, 0, w, w).data };
    })().catch(() => null));
    return tileCache.get(key);
  }
  async function elevation(lat, lon) {
    const z = 12, n = 2 ** z, xf = (lon + 180) / 360 * n, yf = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n;
    const x = Math.floor(xf), y = Math.floor(yf), t = await demTile(z, x, y);
    if (!t) return null;
    const { w, d } = t, px = Math.min(w - 1, Math.floor((xf - x) * w)), py = Math.min(w - 1, Math.floor((yf - y) * w)), i = (py * w + px) * 4;
    const m = d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
    return m < -50 ? null : Math.max(0, m);
  }

  // ---------- nearest help ----------
  function nearest(lat, lon, k, n = 1, filter) {
    const list = (byCat[k] || []).filter(f => !filter || filter(f.properties));
    return list.map(f => ({ f, d: GEO.dist(lat, lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) }))
      .sort((a, b) => a.d - b.d).slice(0, n);
  }
  const dirFrom = (lat, lon, f) => {
    const [x, y] = f.geometry.coordinates;
    return `${GEO.fmtDist(GEO.dist(lat, lon, y, x))} ${GEO.compass(GEO.bearing(lat, lon, y, x))}`;
  };
  const refs = (lat, lon) => `
    <div class="lbm-refs">
      <div><span>Irish Grid</span><b>${GEO.igRef(lat, lon)}</b></div>
      <div><span>ITM</span><b>${GEO.fmtITM(lat, lon)}</b></div>
      <div><span>Lat, Lon</span><b>${lat.toFixed(5)}, ${lon.toFixed(5)}</b></div>
    </div>`;

  // ---------- popups ----------
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "340px", className: "lbm-pop", focusAfterOpen: false });
  function poiPopup(f) {
    const p = f.properties, cat = CATS[p.c], [lon, lat] = f.geometry.coordinates;
    const info = typeof p.i === "string" ? JSON.parse(p.i) : p.i || {};
    const rows = Object.entries(info).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${k === "Phone" ? `<a href="tel:${esc(v)}">${esc(v)}</a>` : esc(v)}</td></tr>`).join("");
    const fromMe = me ? `<div class="lbm-from">${dirFrom(me.lat, me.lon, f)} of your last known position</div>` : "";
    popup.setLngLat([lon, lat]).setHTML(`
      <div class="lbm-cat" style="--c:${cat.color}">${esc(cat.label.replace(/s$/, ""))}${p.k === "hospital" ? (p.ae ? " · <b>A&amp;E</b>" : " · no A&amp;E listed") : ""}</div>
      <h3>${esc(p.n || "Unnamed " + cat.label.toLowerCase().replace(/s$/, ""))}</h3>${p.ga ? `<div class="lbm-ga">${esc(p.ga)}</div>` : ""}
      ${rows ? `<table class="lbm-info">${rows}</table>` : ""}${fromMe}${refs(lat, lon)}
      <div class="lbm-actions"><button data-act="measure" data-ll="${lon},${lat}">Measure from here</button><button data-act="copy" data-ll="${lon},${lat}">Copy grid ref</button></div>`).addTo(map);
  }
  async function placePopup(lngLat) {
    const { lat, lng: lon } = lngLat;
    const near = [
      ["hospital", "A&E hospital", p => p.ae === 1], ["aed", "Defibrillator"], ["pharmacy", "Pharmacy"], ["police", "Garda / PSNI"], ["water", "Drinking water"], ["shelter", "Shelter / hall"],
    ].map(([k, label, flt]) => {
      const [hit] = nearest(lat, lon, k, 1, flt);
      return hit ? `<li data-fly="${hit.f.geometry.coordinates}" data-id="${hit.f.id}"><span class="dot" style="background:${CATS.find(c => c.id === k).color}"></span><span class="lbl">${label}</span><span class="nm">${esc(hit.f.properties.n || "unnamed")}</span><span class="d">${GEO.fmtDist(hit.d)} ${GEO.compass(GEO.bearing(lat, lon, hit.f.geometry.coordinates[1], hit.f.geometry.coordinates[0]))}</span></li>` : "";
    }).join("");
    const place = nearestPlace(lat, lon);
    popup.setLngLat(lngLat).setHTML(`
      <div class="lbm-cat" style="--c:#64748b">Selected point</div>
      <h3>${place ? `${place.d > 400 ? GEO.fmtDist(place.d) + " " + GEO.compass(GEO.bearing(place.r[2], place.r[3], lat, lon)) + " of " : ""}${esc(place.r[0])}` : "Map point"}</h3>
      <div class="lbm-ele">Elevation: <b data-ele>…</b></div>
      ${refs(lat, lon)}
      <div class="lbm-sub">Nearest help</div><ul class="lbm-near">${near}</ul>
      <div class="lbm-actions"><button data-act="measure" data-ll="${lon},${lat}">Measure from here</button><button data-act="copy" data-ll="${lon},${lat}">Copy grid ref</button><button data-act="setme" data-ll="${lon},${lat}">I am here</button></div>`).addTo(map);
    const e = await elevation(lat, lon);
    const el = popup.getElement()?.querySelector("[data-ele]");
    if (el) el.textContent = e == null ? "sea / no data" : `${Math.round(e)} m`;
  }
  function nearestPlace(lat, lon) {
    let best = null;
    for (const r of places) {
      if (r[5] > 5) continue;
      const dy = (r[2] - lat) * 111, dx = (r[3] - lon) * 68;
      const d2 = dx * dx + dy * dy;
      if (d2 < 400 && (!best || d2 < best.d2)) best = { r, d2 };
    }
    return best && { r: best.r, d: GEO.dist(lat, lon, best.r[2], best.r[3]) };
  }
  root.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"), li = e.target.closest("[data-fly]");
    if (li) { const f = poiFC.features[+li.dataset.id]; map.flyTo({ center: f.geometry.coordinates, zoom: Math.max(map.getZoom(), 15) }); poiPopup(f); return; }
    if (!b) return;
    const [lon, lat] = (b.dataset.ll || "").split(",").map(Number);
    if (b.dataset.act === "copy") { await navigator.clipboard?.writeText(`${GEO.igRef(lat, lon)} (ITM ${GEO.fmtITM(lat, lon)}; ${lat.toFixed(5)}, ${lon.toFixed(5)})`).catch(() => {}); b.textContent = "Copied"; }
    if (b.dataset.act === "measure") { popup.remove(); setMeasure(true); addMeasurePoint([lon, lat]); }
    if (b.dataset.act === "setme") { me = { lat, lon, t: Date.now(), manual: true }; store.set("me", me); b.textContent = "Saved as your position"; }
  });

  // ---------- interaction ----------
  for (const l of ["poi-icons", "poi-icons-minor", "poi-dots", "poi-hosp"]) { map.on("mouseenter", l, () => map.getCanvas().style.cursor = "pointer"); map.on("mouseleave", l, () => map.getCanvas().style.cursor = ""); }
  map.on("click", e => {
    if (measuring) return addMeasurePoint(e.lngLat.toArray());
    const hit = map.queryRenderedFeatures(e.point, { layers: ["poi-icons", "poi-icons-minor", "poi-dots", "poi-hosp"] })[0];
    if (hit) return poiPopup(poiFC.features[hit.id] || hit);
    placePopup(e.lngLat);
  });
  const coordEl = $(".lbm-coords", root);
  const showCoords = ll => { coordEl.innerHTML = `<b>${GEO.igRef(ll.lat, ll.lng)}</b><span>ITM ${GEO.fmtITM(ll.lat, ll.lng)}</span><span>${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}</span>`; };
  map.on("mousemove", e => showCoords(e.lngLat));
  map.on("move", () => showCoords(map.getCenter())); // keyboard/touch/fly moves show the centre; mouse moves show the pointer
  showCoords(map.getCenter());

  // ---------- measure ----------
  let measuring = false, mpts = [];
  const mEl = $(".lbm-measure", root);
  function setMeasure(on) {
    measuring = on; root.classList.toggle("measuring", on); $(".lbm-tool-measure", root).classList.toggle("on", on);
    if (!on) { mpts = []; drawMeasure(); }
    mEl.hidden = !on;
    if (on) mEl.innerHTML = `<b>Measure</b><span>Click the map to add points.</span><button data-m="undo">Undo</button><button data-m="done">Done</button>`;
  }
  mEl.addEventListener("click", e => {
    const m = e.target.dataset.m;
    if (m === "undo") { mpts.pop(); drawMeasure(); }
    if (m === "done") setMeasure(false);
  });
  function addMeasurePoint(p) { mpts.push(p); drawMeasure(); }
  let mSeq = 0;
  async function drawMeasure() {
    const fc = emptyFC();
    mpts.forEach(p => fc.features.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: {} }));
    if (mpts.length > 1) fc.features.push({ type: "Feature", geometry: { type: "LineString", coordinates: mpts }, properties: {} });
    map.getSource("measure")?.setData(fc);
    if (!measuring || mpts.length < 2) return;
    let d = 0;
    for (let i = 1; i < mpts.length; i++) d += GEO.dist(mpts[i - 1][1], mpts[i - 1][0], mpts[i][1], mpts[i][0]);
    const last = mpts.at(-1), prev = mpts.at(-2), br = GEO.bearing(prev[1], prev[0], last[1], last[0]);
    const flatMin = d / 1000 / 4.5 * 60;
    mEl.innerHTML = `<b>${GEO.fmtDist(d)}</b><span>last leg ${br.toFixed(0)}° ${GEO.compass(br)}</span><span data-asc>ascent …</span><span data-time>~${fmtMin(flatMin)} walking</span><button data-m="undo">Undo</button><button data-m="done">Done</button>`;
    // sample the DEM every ~30 m for total ascent → Naismith walking time
    const seq = ++mSeq; let up = 0, down = 0, prevE = null;
    for (let i = 1; i < mpts.length; i++) {
      const [a, b] = [mpts[i - 1], mpts[i]], leg = GEO.dist(a[1], a[0], b[1], b[0]), n = Math.max(1, Math.round(leg / 30));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
        const t = j / n, e = await elevation(a[1] + (b[1] - a[1]) * t, a[0] + (b[0] - a[0]) * t);
        if (seq !== mSeq) return;
        if (e != null && prevE != null) { if (e > prevE) up += e - prevE; else down += prevE - e; }
        if (e != null) prevE = e;
      }
    }
    const nais = d / 1000 / 5 * 60 + up / 10; // Naismith: 5 km/h + 1 min per 10 m ascent
    $("[data-asc]", mEl).textContent = `↗ ${Math.round(up)} m ↘ ${Math.round(down)} m`;
    $("[data-time]", mEl).textContent = `~${fmtMin(nais)} walking (Naismith)`;
  }
  const fmtMin = m => m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
  $(".lbm-tool-measure", root).addEventListener("click", () => setMeasure(!measuring));
  addEventListener("keydown", e => { if (e.key === "Escape" && measuring) setMeasure(false); });

  // ---------- layers panel ----------
  const panel = $(".lbm-panel", root);
  function renderPanel() {
    const counts = Object.fromEntries(CATS.map(c => [c.id, (byCat[c.id] || []).length]));
    panel.innerHTML = `
      <div class="lbm-ph"><b>Map layers</b><button class="lbm-x" data-close>✕</button></div>
      <div class="lbm-sec">Style</div>
      <div class="lbm-seg">${[["light", "Light"], ["dark", "Dark"], ["grayscale", "Grey"], ["white", "Paper"]].map(([v, l]) => `<button data-flavor="${v}" class="${S.flavor === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="lbm-sec">Labels</div>
      <div class="lbm-seg">${[["en", "English"], ["ga", "Gaeilge"]].map(([v, l]) => `<button data-lang="${v}" class="${S.lang === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="lbm-sec">Terrain</div>
      ${tog("hillshade", "Hill shading")}${tog("contours", "Contour lines (10 m)")}${tog("terrain3d", "3D terrain (tilt with right-drag)")}
      <div class="lbm-sec">Help &amp; resources <button class="lbm-link" data-all>all</button> <button class="lbm-link" data-none>none</button></div>
      ${tog("aeOnly", "Hospitals: only those with A&amp;E")}
      ${CATS.map(c => `<label class="lbm-cat-t"><input type="checkbox" data-cat="${c.id}" ${S.cats[c.id] ? "checked" : ""}><span class="sw" style="background:${c.color}">${esc(c.glyph)}</span>${esc(c.label)}<em>${counts[c.id].toLocaleString()}</em></label>`).join("")}
      <p class="lbm-note">Resource points from OpenStreetMap (${poiFC.stamp.slice(0, 10)}). Not every AED or tap is mapped — treat as a guide.</p>`;
  }
  const tog = (k, l) => `<label class="lbm-tog"><input type="checkbox" data-tog="${k}" ${S[k] ? "checked" : ""}><span class="track"></span>${l}</label>`;
  panel.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-close]")) return panel.classList.remove("open");
    if (t.dataset.flavor) { S.flavor = t.dataset.flavor; renderPanel(); return restyle(); }
    if (t.dataset.lang) { S.lang = t.dataset.lang; renderPanel(); return restyle(); }
    if (t.dataset.all != null || t.dataset.none != null) { CATS.forEach(c => S.cats[c.id] = t.dataset.all != null); renderPanel(); applyCats(); }
  });
  panel.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.cat) { S.cats[t.dataset.cat] = t.checked; applyCats(); }
    if (t.dataset.tog) {
      S[t.dataset.tog] = t.checked; save();
      if (t.dataset.tog === "hillshade") map.setLayoutProperty("hillshade", "visibility", t.checked ? "visible" : "none");
      if (t.dataset.tog === "contours") ["contours", "contour-labels"].forEach(l => map.setLayoutProperty(l, "visibility", t.checked ? "visible" : "none"));
      if (t.dataset.tog === "terrain3d") { map.setTerrain(t.checked ? { source: "dem-3d", exaggeration: 1.4 } : null); if (t.checked && map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 800 }); if (!t.checked) map.easeTo({ pitch: 0 }); }
      if (t.dataset.tog === "aeOnly") applyCats();
    }
  });
  function applyCats() { save(); map.setFilter("poi-dots", catFilter()); map.setFilter("poi-icons", ["all", catFilter(), ["in", ["get", "k"], ["literal", CRITICAL]]]); map.setFilter("poi-icons-minor", ["all", catFilter(), ["!", ["in", ["get", "k"], ["literal", CRITICAL]]]]); map.setFilter("poi-hosp", ["all", catFilter(), ["==", ["get", "k"], "hospital"]]); }
  $(".lbm-tool-layers", root).addEventListener("click", () => { renderPanel(); panel.classList.toggle("open"); });

  // ---------- search: places, townlands, peaks, resources, grid refs ----------
  const input = $(".lbm-search input", root), results = $(".lbm-results", root);
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const placeIdx = places.map(r => [norm(r[0]), norm(r[1] || "")]);
  const poiIdx = poiFC.features.map(f => norm(f.properties.n || ""));
  function parseCoords(q) {
    const s = q.trim().toUpperCase();
    let m = s.match(/^([A-HJ-Z])\s*(\d{2,10})\s*(\d{0,5})$/);
    if (m) {
      const digits = (m[2] + m[3]).replace(/\s/g, ""); if (digits.length % 2) return null;
      const h = digits.length / 2, e = +digits.slice(0, h) * 10 ** (5 - h), n = +digits.slice(h) * 10 ** (5 - h);
      const L = "VWXYZQRSTULMNOPFGHJKABCDE".indexOf(m[1]); if (L < 0) return null; // 100 km squares, row 0 at south
      const half = h < 5 ? 10 ** (5 - h) / 2 : 0; // centre of the referenced square
      const E = (L % 5) * 100000 + e + half, N = Math.floor(L / 5) * 100000 + n + half;
      const ll = igToLatLon(E, N); return ll && { ...ll, label: `Irish Grid ${q.trim().toUpperCase()}` };
    }
    m = s.match(/^(\d{6})(?:\.\d+)?[ ,]+(\d{6,7})(?:\.\d+)?$/);
    if (m) { const [lat, lon] = GEO.fromITM(+m[1], +m[2]); return { lat, lon, label: `ITM ${m[1]}, ${m[2]}` }; }
    m = s.match(/^(-?\d{1,2}\.\d+)[ ,]+(-?\d{1,3}\.\d+)$/);
    if (m) return { lat: +m[1], lon: +m[2], label: `${m[1]}, ${m[2]}` };
    return null;
  }
  function igToLatLon(E, N) { // Irish Grid → WGS84 by inverting GEO.toIG numerically (sub-metre after a few iterations)
    let [lat, lon] = GEO.fromITM(E + 599965, N + 750022);
    for (let i = 0; i < 6; i++) { const [e2, n2] = GEO.toIG(lat, lon); lat += (N - n2) / 111200; lon += (E - e2) / (111200 * Math.cos(lat * Math.PI / 180)); }
    return { lat, lon };
  }
  let sel = 0, hits = [];
  function search(q) {
    const nq = norm(q); hits = [];
    const c = parseCoords(q);
    if (c) hits.push({ kind: "Grid reference", name: c.label, lat: c.lat, lon: c.lon, zoom: 15 });
    if (nq.length >= 2) {
      const scored = [];
      for (let i = 0; i < places.length && scored.length < 400; i++) {
        const [en, ga] = placeIdx[i];
        const s = en === nq || ga === nq ? 0 : en.startsWith(nq) || ga.startsWith(nq) ? 1 : (en.includes(" " + nq) || ga.includes(" " + nq)) ? 2 : en.includes(nq) ? 3 : -1;
        if (s >= 0) scored.push([s * 10 + places[i][5], i]);
      }
      scored.sort((a, b) => a[0] - b[0]);
      for (const [, i] of scored.slice(0, 12)) { const r = places[i]; hits.push({ kind: r[4] + (r[6] ? (/^\d+(\.\d+)?$/.test(r[6]) && r[4].match(/Peak|Hill/) ? ` · ${Math.round(r[6])} m` : "") : ""), name: r[0], ga: r[1], lat: r[2], lon: r[3], zoom: r[5] <= 1 ? 12 : r[5] <= 3 ? 14 : 15 }); }
      let n = 0;
      for (let i = 0; i < poiIdx.length && n < 8; i++) if (poiIdx[i] && poiIdx[i].includes(nq)) { const f = poiFC.features[i]; hits.push({ kind: CATS[f.properties.c].label.replace(/s$/, ""), name: f.properties.n, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], zoom: 16, poi: f }); n++; }
    }
    sel = 0; renderResults(q);
  }
  function renderResults(q) {
    if (!q.trim()) { results.hidden = true; return; }
    results.hidden = false;
    results.innerHTML = hits.length ? hits.map((h, i) => `<li class="${i === sel ? "sel" : ""}" data-i="${i}"><span class="nm">${esc(h.name)}${h.ga ? ` <i>${esc(h.ga)}</i>` : ""}</span><span class="kd">${esc(h.kind)}</span></li>`).join("")
      : `<li class="none">No match. Try a town, townland, hill, lake — or a grid ref like <b>O 155 345</b>, ITM <b>715830 734697</b> or <b>53.35, -6.26</b>.</li>`;
  }
  function go(h) {
    if (!h) return;
    results.hidden = true; input.blur();
    map.flyTo({ center: [h.lon, h.lat], zoom: h.zoom, speed: 1.6 });
    map.once("moveend", () => h.poi ? poiPopup(h.poi) : placePopup(new maplibregl.LngLat(h.lon, h.lat)));
  }
  input.addEventListener("input", () => search(input.value));
  input.addEventListener("focus", () => input.value && search(input.value));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { sel = Math.min(hits.length - 1, sel + 1); renderResults(input.value); e.preventDefault(); }
    if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); renderResults(input.value); e.preventDefault(); }
    if (e.key === "Enter") go(hits[sel]);
    if (e.key === "Escape") { input.value = ""; results.hidden = true; input.blur(); }
  });
  results.addEventListener("mousedown", e => { const li = e.target.closest("[data-i]"); if (li) { e.preventDefault(); go(hits[+li.dataset.i]); } });
  document.addEventListener("click", e => { if (!e.target.closest(".lbm-search")) results.hidden = true; });
  addEventListener("keydown", e => { if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); } });

  // ---------- nearest-help quick button ----------
  $(".lbm-tool-help", root).addEventListener("click", () => {
    const c = me ? new maplibregl.LngLat(me.lon, me.lat) : map.getCenter();
    if (me) map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 13) });
    placePopup(c);
  });

  const setFlavor = f => { if (!f || f === S.flavor) return; S.flavor = f; if (panel.classList.contains("open")) renderPanel(); restyle(); };
  return { map, flyTo: (lat, lon, zoom = 14) => map.flyTo({ center: [lon, lat], zoom }), elevation, setFlavor };
}

const emptyFC = () => ({ type: "FeatureCollection", features: [] });
