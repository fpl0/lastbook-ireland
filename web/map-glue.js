/* Mounts the shared Lastbook map module (web/map/) into the app's Map tab and connects it to the rest of the app:
   #/map?lat=&lon=&z=&pin=1 links from other screens fly there (and open the point popup),
   and the map's "I am here" button becomes the app's location (Now tab, nearest help, toolkit). */
import { initMap } from "./map/map.js";

let api = null, pending = null, starting = null;
const appFlavor = () => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
// the map follows the app's light/dark toggle
window.addEventListener("lb:theme", () => api && api.setFlavor && api.setFlavor(appFlavor()));
const el = document.getElementById("lbmap");

async function ensure() {
  if (api) return api;
  const st = window.LB.status ? await window.LB.status : {};
  if (st.map === false) {   // map data not downloaded yet: explain instead of showing a blank canvas
    el.innerHTML = `<div style="position:absolute;inset:0;overflow:auto;padding:24px 32px">${window.LB.noDataCard("The offline map", st.dataDir)}</div>`;
    return null;
  }
  if (!starting) starting = initMap(el, { data: "/data/map/", hash: false, flavor: appFlavor() }).then(a => {
    api = a; window.LB.mapApi = a;
    polish(a.map);
    if (pending) { const p = pending; pending = null; go(p); }
    return a;
  }).catch(e => { window.LBLOG && LBLOG("map init: " + (e.stack || e)); el.insertAdjacentHTML("beforeend", `<div class="empty" style="position:absolute;inset:auto 0 50% 0;text-align:center">Map couldn't start: ${String(e.message || e)}</div>`); });
  return starting;
}

// Anything outside the offline extract is drawn as open sea (never as flat grey blocks),
// and the view stays around the island where the map data is.
function polish(map) {
  const seaBackground = () => {
    try {
      const w = map.getLayer("water") && map.getPaintProperty("water", "fill-color");
      if (w && map.getLayer("background") && JSON.stringify(map.getPaintProperty("background", "background-color")) !== JSON.stringify(w)) map.setPaintProperty("background", "background-color", w);
    } catch {}
  };
  map.on("style.load", seaBackground);
  map.on("styledata", seaBackground);
  if (map.isStyleLoaded()) seaBackground();
  map.setMinZoom(5);
  map.setMaxBounds([[-14.5, 49.8], [-2.5, 57.2]]);
}

function go(params) {
  const lat = +params.get("lat"), lon = +params.get("lon");
  if (!lat || !lon) return;
  const z = +params.get("z") || 14, { map } = api;
  // leave room under the point for its popup (nearest-help list)
  const h = map.getContainer().clientHeight;
  map.flyTo({ center: [lon, lat], zoom: z, speed: 1.6, offset: params.get("pin") ? [0, -Math.min(220, h * 0.28)] : [0, 0] });
  if (params.get("pin")) map.once("moveend", () => { const ll = map.unproject(map.project([lon, lat])); map.fire("click", { lngLat: ll, point: map.project(ll), originalEvent: null }); });
}

window.addEventListener("lb:route", async e => {
  if (e.detail.tab !== "map") return;
  const params = e.detail.params;
  if (params.get("lat")) history.replaceState(null, "", "#/map");
  if (api) { requestAnimationFrame(() => api.map.resize()); if (params.get("lat")) go(params); return; }
  if (params.get("lat")) pending = params;
  await ensure();
  requestAnimationFrame(() => api && api.map.resize());
});

// "I am here" in a map popup → app location
el.addEventListener("click", e => {
  const b = e.target.closest('[data-act="setme"]'); if (!b) return;
  const [lon, lat] = (b.dataset.ll || "").split(",").map(Number);
  if (lat && lon) window.LB.setLoc(lat, lon, "", "map");
});
// the map's own geolocate control → app location
const syncMe = () => { try { const m = JSON.parse(localStorage.getItem("lb.map.me") || "null"); const L = window.LB.loc; if (m && !m.manual && (!L || (m.t || 0) > (L.t || 0) + 1000)) window.LB.setLoc(m.lat, m.lon, "", "gps"); } catch {} };
setInterval(syncMe, 3000);

// the route event may already have fired before this module loaded
if ((location.hash || "").startsWith("#/map")) window.dispatchEvent(new CustomEvent("lb:route", { detail: { tab: "map", params: new URLSearchParams((location.hash.split("?")[1]) || "") } }));
