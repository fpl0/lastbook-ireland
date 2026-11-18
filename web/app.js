/* Lastbook Ireland — core: router, Now, Guides, Toolkit, global search */
(() => {
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (n, cls = "i") => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const store = {
  get(k, d) { try { const v = localStorage.getItem("lb." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("lb." + k, JSON.stringify(v)); } catch {} },
};
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const toast = msg => { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), Math.max(2200, msg.length * 55)); };

/* ---------------- layer catalogue (shared with map) ---------------- */
const LAYERS = [
  { id: "ae", name: "A&E (emergency dept.)", color: "#d7263d", on: true, short: "A&E" },
  { id: "hospital", name: "Hospitals", color: "#e5484d", on: true, short: "H" },
  { id: "aed", name: "Defibrillators (AED)", color: "#ef4444", on: true, short: "AED" },
  { id: "pharmacy", name: "Pharmacies", color: "#16a34a", on: true, short: "Rx" },
  { id: "doctor", name: "GPs & clinics", color: "#0ea5a4", on: false, short: "GP" },
  { id: "police", name: "Garda / PSNI stations", color: "#2563eb", on: true, short: "G" },
  { id: "fire", name: "Fire stations", color: "#ea580c", on: true, short: "F" },
  { id: "ambulance", name: "Ambulance bases", color: "#db2777", on: false, short: "Amb" },
  { id: "coast", name: "Coast Guard & lifeboats", color: "#0284c7", on: true, short: "CG" },
  { id: "water", name: "Drinking water, wells, springs", color: "#0891b2", on: true, short: "W" },
  { id: "shelter", name: "Shelters, huts, hostels, camps", color: "#7c3aed", on: false, short: "S" },
  { id: "community", name: "Community halls & schools", color: "#9333ea", on: false, short: "C" },
  { id: "food", name: "Food shops", color: "#ca8a04", on: false, short: "£" },
  { id: "fuel", name: "Fuel stations", color: "#475569", on: false, short: "⛽" },
  { id: "hardware", name: "Hardware & outdoor shops", color: "#78716c", on: false, short: "HW" },
  { id: "vet", name: "Vets", color: "#65a30d", on: false, short: "V" },
  { id: "toilets", name: "Public toilets", color: "#64748b", on: false, short: "WC" },
  { id: "hydrant", name: "Fire hydrants", color: "#f97316", on: false, short: "Hy" },
  { id: "church", name: "Churches", color: "#a1a1aa", on: false, short: "†" },
];
const LAYER = Object.fromEntries(LAYERS.map(l => [l.id, l]));

/* ---------------- shared state ---------------- */
const LB = window.LB = {
  $, $$, esc, icon, store, toast, debounce, LAYERS, LAYER,
  loc: store.get("loc", null),   // {lat, lon, label, src}
  pois: null, places: null, books: null,
  async loadPois() {
    if (!this.pois) this.pois = fetch("data/pois.geojson").then(r => r.json()).catch(() => ({ features: [] }));
    return this.pois;
  },
  async loadPlaces() {
    if (!this.places) this.places = fetch("data/places.json").then(r => r.json()).then(a => a.map(p => ({ n: p[0], k: p[1], lat: p[2], lon: p[3], ga: p[4], x: p[5], s: (p[0] + " " + p[4]).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") }))).catch(() => []);
    return this.places;
  },
  async loadBooks() {
    if (!this.books) this.books = fetch("api/books").then(r => r.json()).catch(() => []);
    const b = await this.books;
    if (!b.length) this.books = null; // don't cache a failed/empty catalogue — retry next time
    return b;
  },
  async book(key) { // med | wp | voy | prefix
    const pre = { med: "wikipedia_en_medicine", wp: "wikipedia_en_top", voy: "wikivoyage_en", nhs: "nhs.uk_en_medicines" }[key] || key;
    return (await this.loadBooks()).find(b => b.name && b.name.startsWith(pre));
  },
  setLoc(lat, lon, label, src) {
    this.loc = { lat, lon, label, src, t: Date.now() }; store.set("loc", this.loc);
    renderNowWhere(); window.dispatchEvent(new CustomEvent("lb:loc"));
  },
  open(url, title, source) { location.hash = "#/read?u=" + encodeURIComponent(url) + (title ? "&t=" + encodeURIComponent(title) : "") + (source ? "&s=" + encodeURIComponent(source) : ""); },
  go(h) { location.hash = h; },
  nearestPlace(lat, lon) {
    const ps = this._placesSync; if (!ps) return null;
    let best = null, bd = 1e18;
    for (const p of ps) { if (!["city","town","village","suburb","hamlet","townland"].includes(p.k)) continue; const d = (p.lat - lat) ** 2 + ((p.lon - lon) * 0.6) ** 2; if (d < bd) { bd = d; best = p; } }
    return best ? { ...best, d: GEO.dist(lat, lon, best.lat, best.lon) } : null;
  },
};
LB.loadPlaces().then(p => { LB._placesSync = p; renderNowWhere(); });

/* ---------------- theme ---------------- */
const setTheme = t => { document.documentElement.dataset.theme = t; store.set("theme", t); window.dispatchEvent(new CustomEvent("lb:theme")); };
setTheme(store.get("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
$("#themeBtn").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

/* ---------------- status ---------------- */
fetch("api/status").then(r => r.json()).then(s => {
  const ok = s.kiwix && s.docs;
  $("#status").classList.toggle("warn", !ok);
  $("#statusText").textContent = ok ? "Offline-ready · all libraries loaded" : (s.kiwix ? "Indexing manuals…" : "Library engine not running");
}).catch(() => { $("#status").classList.add("warn"); $("#statusText").textContent = "Static mode"; });

/* ---------------- router ---------------- */
const views = ["now", "map", "guides", "library", "tools", "read"];
function route() {
  const h = location.hash.slice(2) || "now";
  const [path, qs] = h.split("?");
  const params = new URLSearchParams(qs || "");
  const [section, arg] = path.split("/");
  const tab = section === "guide" ? "guides" : section === "book" ? "library" : views.includes(section) ? section : "now";
  if (tab !== "read") LB.lastView = location.hash || "#/now";
  views.forEach(v => $("#view-" + v).classList.toggle("on", v === tab));
  $$(".rail a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab || (tab === "read" && a.dataset.tab === "library")));
  if (tab === "now") renderNow();
  if (tab === "guides") section === "guide" ? renderGuide(decodeURIComponent(arg)) : renderGuides();
  if (tab === "tools") renderTools();
  window.dispatchEvent(new CustomEvent("lb:route", { detail: { tab, section, arg, params } }));
  if (tab !== "map" && tab !== "read") $("#view-" + tab).scrollTop = 0;
}
window.addEventListener("hashchange", route);

/* ================================================================ NOW */
const QUICK = [
  ["cpr", "CPR & AED", "heart", ""], ["bleeding", "Severe bleeding", "drop", ""], ["firstaid", "Choking, burns, stroke", "heart", ""],
  ["childbirth", "Emergency birth", "baby", ""], ["cold", "Hypothermia & cold", "snow", "b"], ["sea", "Water & coast", "wave", "b"],
  ["lost", "Lost or stranded", "pin", "g"], ["power", "Power, gas, CO", "plug", "a"], ["flood", "Flooding", "wave", "a"],
  ["weather", "Storm warnings", "wind", "a"], ["water", "Safe water", "drop", "b"], ["radiation", "Chemical / nuclear", "radiation", "a"],
];
const NEAR_LABEL = { ae: "A&E", hospital: "Hospital", aed: "Defibrillator", pharmacy: "Pharmacy", police: "Garda/PSNI", fire: "Fire", doctor: "GP", coast: "Coast Guard", water: "Water", shelter: "Shelter", food: "Food", fuel: "Fuel" };
const NEAR = ["ae", "hospital", "aed", "pharmacy", "police", "fire", "doctor", "coast", "water", "shelter", "food", "fuel"];

function renderNow() {
  const v = $("#view-now");
  if (!v.dataset.built) {
    v.dataset.built = 1;
    v.innerHTML = `<div class="page">
      <div class="hero">
        <div class="call-card">
          <div class="eyebrow" style="color:#fff;opacity:.8">Emergency — Ireland & Northern Ireland</div>
          <div class="big">112 <small>or 999</small></div>
          <p>Garda / PSNI, ambulance, fire, Coast Guard, mountain & cave rescue. Free from any phone, even with no credit or SIM.</p>
          <div class="say">
            <div><b>1</b><span>Which service you need</span></div>
            <div><b>2</b><span>Where you are — read the grid reference on the right</span></div>
            <div><b>3</b><span>What happened, how many are hurt</span></div>
            <div><b>4</b><span>Stay on the line. Can't speak? text 112 — register first by texting REGISTER to 112 (NI: to 999)</span></div>
          </div>
        </div>
        <div class="card where" id="whereCard"></div>
      </div>
      <h2>Do this now</h2>
      <div class="quick">${QUICK.map(([id, t, ic, c]) => `<a class="${c}" href="#/guide/${id}"><span class="ic">${icon(ic)}</span>${esc(t)}</a>`).join("")}</div>
      <h2>Nearest help</h2>
      <p class="near-note" id="nearNote"></p>
      <div class="near" id="nearList"></div>
      <h2>Daylight today</h2>
      <div class="sun" id="sunCard"></div>
    </div>`;
    window.addEventListener("lb:loc", () => { renderNear(); renderSun(); });
  }
  renderNowWhere(); renderNear(); renderSun();
}

function renderGridChip() {
  const c = $("#gridChip"); if (!c) return;
  const L = LB.loc; c.hidden = !L;
  if (L) $("#gridChipRef").textContent = GEO.igRef(L.lat, L.lon, 4);
}
window.addEventListener("lb:loc", renderGridChip);
setTimeout(renderGridChip, 0);

function renderNowWhere() {
  const c = $("#whereCard"); if (!c) return;
  const L = LB.loc;
  if (!L) {
    c.innerHTML = `<div class="eyebrow">Where am I?</div>
      <div class="ref" style="font-size:20px;font-family:var(--font-display)">Location not set</div>
      <p class="sub">Use your device location, or tap anywhere on the Map to set your position — it works with no signal.</p>
      <div class="actions"><button class="btn primary" id="locBtn">${icon("locate")} Use my location</button><a class="btn" href="#/map">${icon("map")} Pick on map</a></div>`;
  } else {
    const np = LB.nearestPlace(L.lat, L.lon);
    const age = L.t ? Math.round((Date.now() - L.t) / 60000) : null;
    c.innerHTML = `<div class="eyebrow">Where am I? — read this to 112</div>
      <div class="ref">${esc(GEO.igRef(L.lat, L.lon))}</div>
      <div class="sub">Irish Grid reference${np ? ` · ${GEO.fmtDist(np.d)} ${GEO.compass(GEO.bearing(np.lat, np.lon, L.lat, L.lon))} of <b>${esc(np.n)}</b> (${esc(np.k)})` : ""}</div>
      <dl class="rows">
        <dt>ITM</dt><dd>${esc(GEO.fmtITM(L.lat, L.lon))}</dd>
        <dt>Lat / Lon</dt><dd>${L.lat.toFixed(5)}, ${L.lon.toFixed(5)}</dd>
        <dt>DMS</dt><dd>${dms(L.lat, "N", "S")} ${dms(L.lon, "E", "W")}</dd>
        <dt>Source</dt><dd style="font-family:var(--font)">${esc(L.src === "gps" ? "Device location" : "Picked on map")}${age != null ? ` · ${age < 1 ? "just now" : age < 120 ? age + " min ago" : Math.round(age / 60) + " h ago"}` : ""}</dd>
      </dl>
      <div class="actions"><button class="btn primary" id="locBtn">${icon("locate")} Update</button><a class="btn" href="#/map?lat=${L.lat}&lon=${L.lon}&z=14">${icon("map")} Show on map</a><button class="btn" id="copyLoc">Copy</button></div>`;
    $("#copyLoc").onclick = () => { navigator.clipboard?.writeText(`Irish Grid ${GEO.igRef(L.lat, L.lon)} · ITM ${GEO.fmtITM(L.lat, L.lon)} · ${L.lat.toFixed(5)}, ${L.lon.toFixed(5)}`); toast("Copied"); };
  }
  $("#locBtn").onclick = locate;
}
const dms = (v, p, n) => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d - m / 60) * 3600).toFixed(0); return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″${v >= 0 ? p : n}`; };

function locate() {
  if (!navigator.geolocation) return toast("Location not available on this device");
  toast("Finding your position…");
  navigator.geolocation.getCurrentPosition(p => { LB.setLoc(p.coords.latitude, p.coords.longitude, "", "gps"); toast(`Located (±${Math.round(p.coords.accuracy)} m)`); },
    e => toast(e && e.message ? e.message : "Couldn't get your location — tap your spot on the Map instead."), { enableHighAccuracy: true, timeout: 25000, maximumAge: 60000 });
}
LB.locate = locate;

async function renderNear() {
  const list = $("#nearList"); if (!list) return;
  const L = LB.loc;
  if (!L) {
    $("#nearNote").textContent = "";
    list.innerHTML = `<div class="help-empty"><span class="hi">${icon("locate")}</span>
      <div><b>Where are you?</b><span>Set your position to see the closest A&amp;E, defibrillator, pharmacy, Garda station, water and shelter — straight away, offline.</span></div>
      <div class="acts"><button class="btn primary" data-act="loc">${icon("locate")} Use my location</button><a class="btn" href="#/map">${icon("map")} Pick on map</a></div></div>`;
    list.querySelector('[data-act="loc"]').onclick = locate;
    return;
  }
  const { features } = await LB.loadPois();
  const best = {};
  for (const f of features) {
    const lid = f.properties.l; if (!NEAR.includes(lid)) continue;
    const [lon, lat] = f.geometry.coordinates, d = GEO.dist(L.lat, L.lon, lat, lon);
    if (!best[lid] || d < best[lid][0]) best[lid] = [d, f];
  }
  $("#nearNote").textContent = "Straight-line distance and compass direction from your position. OpenStreetMap data — confirm opening hours and A&E status by phone if you can.";
  list.innerHTML = NEAR.map(lid => {
    const ly = LAYER[lid], hit = best[lid];
    if (!hit) return `<div class="help-t none" style="--c:${ly.color}"><div class="ht-k"><span class="sw"></span>${esc(NEAR_LABEL[lid])}</div><div class="ht-n">None mapped nearby</div></div>`;
    const [d, f] = hit, p = f.properties, [lon, lat] = f.geometry.coordinates, br = GEO.bearing(L.lat, L.lon, lat, lon);
    const meta = p.ph || p.de || p.oh || "";
    return `<a class="help-t" style="--c:${ly.color}" href="#/map?lat=${lat}&lon=${lon}&z=16&pin=1">
      <div class="ht-k"><span class="sw"></span>${esc(NEAR_LABEL[lid])}</div>
      <div class="ht-d">${GEO.fmtDist(d)}<small>${GEO.compass(br)} · ${Math.round(br)}°</small></div>
      <div class="ht-n">${esc(p.n || "Unnamed " + NEAR_LABEL[lid].toLowerCase())}</div>
      ${meta ? `<div class="ht-m">${esc(meta)}</div>` : ""}</a>`;
  }).join("");
}

function renderSun() {
  const c = $("#sunCard"); if (!c) return;
  const L = LB.loc || { lat: 53.35, lon: -7.7 };
  const s = GEO.sun(new Date(), L.lat, L.lon);
  const f = d => d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const len = s.rise && s.set ? (s.set - s.rise) / 3600000 : 0;
  const tiles = [["First light", f(s.dawn), "dawn"], ["Sunrise", f(s.rise), "rise"], ["Sun due south", f(s.noon), "noon"], ["Sunset", f(s.set), "set"], ["Last light", f(s.dusk), "dusk"], ["Daylight", `${Math.floor(len)} h ${Math.round((len % 1) * 60)} m`, "len"]];
  c.innerHTML = `<div class="sun-tiles">${tiles.map(([k, v, cls]) => `<div class="sun-t ${cls}"><span>${k}</span><b>${v}</b></div>`).join("")}</div>
    <p class="near-note">${LB.loc ? "For your position." : "For the centre of Ireland — set your location for exact times."} Plan to be off the hills and back on a road by sunset.</p>`;
}

/* ================================================================ GUIDES */
const GROUP_ORDER = ["Emergency", "First aid", "Hazards", "Outdoors", "Survival", "Reference"];
function guideCard(g) {
  const m = GUIDE_META[g.id] || {};
  const tone = ["water", "sea", "cold", "comms", "sanitation"].includes(g.id) ? "blue" : ({ Emergency: "red", "First aid": "red", Hazards: "amber", Outdoors: "green", Survival: "teal", Reference: "violet" })[g.group] || "teal";
  return `<a class="gcard ${tone}" href="#/guide/${g.id}"><div class="ic">${icon(m.icon || "book")}</div><div><b>${esc(g.title)}</b><span>${esc(g.summary)}</span></div></a>`;
}
function renderGuides() {
  const v = $("#view-guides");
  const groups = GROUP_ORDER.map(gr => [gr, GUIDES.filter(g => g.group === gr)]).filter(x => x[1].length);
  v.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">Field guides</div><h1>What to do, and where to read more</h1>
    <p class="lede">Each guide starts with the actions that matter, then links straight into the right pages of the survival manuals, official Irish guidance and the medical encyclopedia — all offline.</p></div></div>
    <div class="guide-groups">${groups.map(([gr, gs]) => `<h2>${esc(gr)}</h2><div class="grid g2">${gs.map(guideCard).join("")}</div>`).join("")}</div></div>`;
}

function renderGuide(id) {
  const g = GUIDES.find(x => x.id === id); const v = $("#view-guides");
  if (!g) { v.innerHTML = `<div class="page"><div class="empty">Guide not found. <a href="#/guides">All guides</a></div></div>`; return; }
  const m = GUIDE_META[id] || {};
  v.innerHTML = `<div class="page">
    <a href="#/guides" class="muted" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:10px">${icon("left")} All guides</a>
    <div class="page-head"><div><div class="eyebrow">${esc(g.group)}</div><h1>${esc(g.title)}</h1><p class="lede">${esc(g.summary)}</p></div></div>
    <div class="guide">
      <article class="guide-body">${g.html}</article>
      <aside class="deep">
        ${m.wiki ? `<div class="card"><h4>${icon("globe")} Encyclopedia</h4><div id="dWiki"><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div></div>` : ""}
        ${m.docs ? `<div class="card"><h4>${icon("file")} In the manuals</h4><div id="dDocs"><div class="skeleton"></div><div class="skeleton" style="width:60%"></div></div></div>` : ""}
        ${m.lib ? `<div class="card"><h4>${icon("search")} Search the libraries</h4><a class="btn sm" href="#/library?q=${encodeURIComponent(m.lib)}">“${esc(m.lib)}” in all libraries ${icon("right")}</a></div>` : ""}
      </aside>
    </div></div>`;
  if (m.wiki) fillWiki(m.wiki);
  if (m.docs) fillDocs(m.docs);
}

async function fillWiki(list) {
  const el = $("#dWiki"); if (!el) return;
  const items = await Promise.all(list.map(async key => {
    const [b, title] = key.split(":");
    const book = await LB.book(b); if (!book) return null;
    const url = `/kiwix/content/${book.book}/${encodeURIComponent(title).replace(/%2F/g, "/")}`;
    try { const r = await fetch(url, { method: "HEAD" }); if (!r.ok) return null; } catch { return null; }
    return `<a class="ref-item" href="#" data-u="${esc(url)}" data-t="${esc(title.replace(/_/g, " "))}" data-s="${esc(book.title)}"><b>${esc(title.replace(/_/g, " "))}</b><small>${esc(book.title)}</small></a>`;
  }));
  const html = items.filter(Boolean).join("");
  if (!$("#dWiki")) return;
  el.innerHTML = html || `<div class="muted" style="font-size:13px">Encyclopedia not available.</div>`;
  bindRefs(el);
}
async function fillDocs(qs) {
  const el = $("#dDocs"); if (!el) return;
  const seen = new Set(), out = [];
  const res = await Promise.all(qs.map(q => fetch("api/docs?q=" + encodeURIComponent(q)).then(r => r.json()).catch(() => [])));
  // interleave the queries' top hits
  for (let i = 0; i < 6; i++) for (const r of res) { const h = r && r[i]; if (h && !seen.has(h.doc)) { seen.add(h.doc); out.push(h); } }
  if (!$("#dDocs")) return;
  el.innerHTML = out.slice(0, 9).map(docHitHtml).join("") || `<div class="muted" style="font-size:13px">No matching manual pages.</div>`;
  bindRefs(el);
}
const docUrl = h => h.url + (h.url.endsWith(".pdf") || h.url.includes(".pdf") ? "#page=" + h.page : "");
const docHitHtml = h => `<a class="ref-item" href="#" data-u="${esc(docUrl(h))}" data-t="${esc(h.title)}" data-s="${esc(h.source)}"><b>${esc(h.title)}</b><small>${esc(h.source)}${h.pages > 1 ? ` · page ${h.page} of ${h.pages}` : ""}</small>${h.snippet ? `<q>${esc(h.snippet)}</q>` : ""}</a>`;
function bindRefs(el) { $$("[data-u]", el).forEach(a => a.onclick = e => { e.preventDefault(); LB.open(a.dataset.u, a.dataset.t, a.dataset.s); }); }
LB.docHitHtml = docHitHtml; LB.bindRefs = bindRefs;

/* ================================================================ TOOLKIT */
const KIT = {
  "Water & food (at least 3 days, ideally 7)": [
    "Water: 3 litres per person per day + pets (bottled or in clean containers)", "Tinned food you'll actually eat + manual tin opener", "Porridge oats, pasta, rice, crackers, peanut butter, UHT milk",
    "Baby formula / special-diet food / pet food", "Camping stove + spare gas (outdoor use only)", "Water purification tablets or unscented bleach + dropper", "Bin bags, kitchen roll, wipes"],
  "Light, power & information": [
    "Torch (+ head torch) and spare batteries", "Battery or wind-up FM radio (RTÉ Radio 1 / BBC Radio Ulster)", "Power bank(s), charged; car phone charger", "Written list of phone numbers (phones die)",
    "Cash in small notes and coins (card machines fail in outages)", "Candles + matches/lighter in a sealed bag (use with care)"],
  "Health": [
    "First aid kit (dressings, tape, bandages, gloves, scissors, tweezers)", "Tourniquet and haemostatic gauze (and know how to use them)", "2+ weeks of prescription medicines + written list of doses",
    "Paracetamol, ibuprofen, antihistamine, oral rehydration sachets, loperamide", "Spare glasses / contacts, hearing aid batteries", "Hand sanitiser, soap, toothpaste, sanitary products, nappies", "Thermometer"],
  "Warmth & shelter": ["Warm layers, hats, gloves, waterproofs for everyone", "Sleeping bags / blankets, foil survival blankets", "Sturdy shoes or boots by the bed", "CO alarm + smoke alarm tested; fire blanket / extinguisher"],
  "Documents & home": [
    "Passports, ID, insurance, PPS / NI numbers — copies in a waterproof bag", "Know your Eircode and where your stopcock, fuse board and gas meter are", "Spare house and car keys", "Duct tape, rope, multi-tool, work gloves, whistle",
    "Car: half a tank minimum, blanket, shovel, hi-vis, de-icer, water, snacks"],
  "Go-bag (one per person, by the door)": [
    "Water bottle + purification", "Snacks for 24–48 h", "Torch, radio, power bank, charger cable", "Medicines (3 days) + copy of prescriptions", "Change of clothes, rain jacket, hat",
    "Copies of documents + some cash", "Phone numbers on paper + meeting-place plan", "Comfort items for children; pet lead, food, papers"],
};
const PLAN_FIELDS = [
  ["meet1", "Meeting place near home"], ["meet2", "Meeting place outside the area"], ["contact", "Out-of-area contact (name & number)"], ["eircode", "Our Eircode / address"],
  ["gp", "GP & out-of-hours number"], ["meds", "Medicines, doses & allergies (everyone)"], ["needs", "Who needs extra help (elderly, babies, medical equipment)"], ["pets", "Pets: food, vet, carrier"],
  ["utilities", "Stopcock / fuse board / gas meter locations"], ["neighbours", "Neighbours to check on"], ["school", "Schools / crèche emergency arrangements"], ["notes", "Other notes"],
];

function renderTools() {
  const v = $("#view-tools");
  if (v.dataset.built) { renderToolLoc(); return; }
  v.dataset.built = 1;
  const kit = store.get("kit", {});
  const all = Object.values(KIT).flat();
  v.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">Toolkit</div><h1>Prepare, plan and work it out</h1><p class="lede">Your household kit and plan are saved on this computer. The calculators work entirely offline.</p></div></div>
    <div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><h3 style="margin:0">${icon("check")} Emergency kit</h3><span class="muted" id="kitCount"></span></div>
      <div class="progress"><div id="kitBar"></div></div>
      ${Object.entries(KIT).map(([sec, items]) => `<h3>${esc(sec)}</h3><ul class="checklist">${items.map(it => `<li><label><input type="checkbox" data-k="${esc(it)}" ${kit[it] ? "checked" : ""}><span>${esc(it)}</span></label></li>`).join("")}</ul>`).join("")}
      <p class="muted" style="font-size:13px;margin-top:14px">Based on gov.ie <i>Be Emergency Ready</i> (Office of Emergency Planning, 2026) and nidirect <i>Household emergency kit</i>. Full originals in Library → Official guidance.</p>
    </div>
    <h2>Household emergency plan</h2>
    <div class="card"><div class="form-grid">${PLAN_FIELDS.map(([k, l]) => `<label>${esc(l)}<textarea class="input" data-p="${k}">${esc(store.get("plan", {})[k] || "")}</textarea></label>`).join("")}</div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="planCopy">Copy as text</button></div></div>
    <h2>Calculators & tools</h2>
    <div class="grid g2">
      <div class="card tool"><h3>${icon("pin")} Coordinate converter</h3>
        <label class="muted" style="font-size:13px">Lat, lon · ITM (E, N) · Irish Grid (e.g. V 803 844)</label>
        <input class="input" id="convIn" placeholder="53.3498, -6.2603  or  715830, 734697  or  O 158 346">
        <dl class="kv2" id="convOut" style="margin-top:12px"></dl></div>
      <div class="card tool"><h3>${icon("compass")} Distance & bearing</h3>
        <div style="display:grid;gap:8px"><input class="input" id="dbA" placeholder="From — lat, lon (blank = my location)"><input class="input" id="dbB" placeholder="To — lat, lon, ITM or grid ref"></div>
        <dl class="kv2" id="dbOut" style="margin-top:12px"></dl></div>
      <div class="card tool"><h3>${icon("drop")} Water disinfection (bleach)</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="muted" style="font-size:13px">Water (litres)<input class="input" id="wL" type="number" value="10" min="0" step="1"></label>
        <label class="muted" style="font-size:13px">Bleach strength (% chlorine)<input class="input" id="wP" type="number" value="5" min="1" max="15" step="0.5"></label></div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:14px"><input type="checkbox" id="wC"> Water is cloudy or very cold</label>
        <div id="wOut" class="callout green" style="margin-bottom:0"></div></div>
      <div class="card tool"><h3>${icon("sun")} SOS signal</h3>
        <p style="margin-top:0">Turns the screen into a flashing light: SOS in Morse (··· ––– ···) or the mountain distress signal (6 flashes a minute).</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn red" id="sosBtn">Flash SOS</button><button class="btn" id="sixBtn">6 per minute</button><button class="btn" id="lightBtn">Steady white light</button></div>
        <p class="muted" style="font-size:13px">Click or press any key to stop.</p></div>
      <div class="card tool"><h3>${icon("radio")} Morse code</h3><input class="input" id="morseIn" placeholder="Type text…" value="SOS"><p id="morseOut" style="font:600 18px var(--mono);letter-spacing:.08em;margin:12px 0 0;word-break:break-word"></p></div>
      <div class="card tool"><h3>${icon("can")} Food & water for your household</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><label class="muted" style="font-size:13px">Adults<input class="input" id="fA" type="number" value="2" min="0"></label><label class="muted" style="font-size:13px">Children<input class="input" id="fC" type="number" value="0" min="0"></label><label class="muted" style="font-size:13px">Days<input class="input" id="fD" type="number" value="7" min="1"></label></div>
        <dl class="kv2" id="fOut" style="margin-top:12px"></dl></div>
    </div>
    <h2>Radio stations for emergency bulletins</h2>
    <div class="card"><p style="margin-top:0">In a national emergency, information goes out on national and local radio. Keep a battery or wind-up FM radio.</p>
      <dl class="kv2"><dt>RTÉ Radio 1</dt><dd>FM 88–90 MHz nationwide (e.g. 88.2 Dublin/East, 89.0–90 regional transmitters)</dd><dt>BBC Radio Ulster</dt><dd>FM 92.4–95.4 MHz across Northern Ireland</dd><dt>Local stations</dt><dd>Your county's local radio — councils use them for road closures, rest centres and water notices</dd></dl></div>
  </div>`;
  const updKit = () => { const k = store.get("kit", {}); const n = all.filter(i => k[i]).length; $("#kitCount").textContent = `${n} of ${all.length} ready`; $("#kitBar").style.width = (100 * n / all.length) + "%"; };
  $$("[data-k]", v).forEach(cb => cb.onchange = () => { const k = store.get("kit", {}); k[cb.dataset.k] = cb.checked; store.set("kit", k); updKit(); }); updKit();
  $$("[data-p]", v).forEach(t => t.oninput = debounce(() => { const p = store.get("plan", {}); p[t.dataset.p] = t.value; store.set("plan", p); }, 300));
  const planText = () => { const p = store.get("plan", {}); return "HOUSEHOLD EMERGENCY PLAN\n\n" + PLAN_FIELDS.map(([k, l]) => `${l}:\n${p[k] || "—"}\n`).join("\n") + "\nEmergency: 112 / 999"; };
  $("#planCopy").onclick = () => { navigator.clipboard?.writeText(planText()); toast("Plan copied"); };
  // converter
  const conv = () => { const r = parseCoord($("#convIn").value); $("#convOut").innerHTML = r ? coordRows(r[0], r[1]) : `<dt>&nbsp;</dt><dd class="muted">Enter coordinates in any format.</dd>`; };
  $("#convIn").oninput = conv; conv();
  const db = () => {
    const a = $("#dbA").value.trim() ? parseCoord($("#dbA").value) : (LB.loc ? [LB.loc.lat, LB.loc.lon] : null), b = parseCoord($("#dbB").value);
    if (!a || !b) { $("#dbOut").innerHTML = `<dt>&nbsp;</dt><dd class="muted">${a ? "Enter a destination." : "Set your location or enter a start point."}</dd>`; return; }
    const d = GEO.dist(a[0], a[1], b[0], b[1]), br = GEO.bearing(a[0], a[1], b[0], b[1]);
    $("#dbOut").innerHTML = `<dt>Distance</dt><dd>${GEO.fmtDist(d)}</dd><dt>Bearing</dt><dd>${Math.round(br)}° (${GEO.compass(br)}) true · ~${Math.round(br + 1.5)}° magnetic</dd><dt>Walking (4 km/h)</dt><dd>${fmtH(d / 4000)}</dd><dt>Hill walking (Naismith)</dt><dd>${fmtH(d / 5000)} + 1 h per 600 m of ascent</dd>`;
  };
  $("#dbA").oninput = $("#dbB").oninput = db; db(); window.addEventListener("lb:loc", db);
  const water = () => {
    const L = +$("#wL").value || 0, P = +$("#wP").value || 5, cloudy = $("#wC").checked;
    const mgPerL = cloudy ? 4 : 2; const ml = L * mgPerL / (P * 10); const drops = Math.round(ml * 20);
    $("#wOut").innerHTML = `<b>${ml < 1 ? drops + " drops" : ml.toFixed(1) + " ml (≈ " + drops + " drops)"}</b> of plain, unscented bleach for ${L} L. Mix, then wait <b>${cloudy ? "60" : "30"} minutes</b>. It should smell faintly of chlorine — if not, repeat the dose and wait another 15 min.<br><span class="muted" style="font-size:13px">Filter cloudy water through cloth first. Boiling (1 min rolling boil) is more reliable. Bleach doesn't remove chemicals or algal toxins.</span>`;
  };
  ["wL", "wP", "wC"].forEach(i => $("#" + i).oninput = water); water();
  const food = () => { const a = +$("#fA").value || 0, c = +$("#fC").value || 0, d = +$("#fD").value || 1, p = a + c;
    $("#fOut").innerHTML = `<dt>Drinking & cooking water</dt><dd>${p * 3 * d} litres (3 L/person/day)</dd><dt>With basic washing</dt><dd>${p * 5 * d} litres</dd><dt>Food energy</dt><dd>~${((a * 2200 + c * 1600) * d / 1000).toFixed(0)},000 kcal — e.g. ${Math.ceil((a * 2200 + c * 1600) * d / 400)} × 400 kcal tins/meals</dd><dt>Porridge oats equivalent</dt><dd>${((a * 2200 + c * 1600) * d / 3750).toFixed(1)} kg</dd>`; };
  ["fA", "fC", "fD"].forEach(i => $("#" + i).oninput = food); food();
  // morse + flasher
  const MORSE = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----." };
  const morse = () => $("#morseOut").textContent = $("#morseIn").value.toUpperCase().split("").map(c => c === " " ? "/" : (MORSE[c] || "").replace(/\./g, "·").replace(/-/g, "–")).join("  ");
  $("#morseIn").oninput = morse; morse();
  const flash = pattern => {
    const el = document.createElement("div"); el.className = "flash"; el.textContent = "Click or press a key to stop"; document.body.append(el);
    let stop = false, i = 0; const end = () => { stop = true; el.remove(); removeEventListener("keydown", end); };
    el.onclick = end; addEventListener("keydown", end);
    if (!pattern) { el.classList.add("lit"); return; }
    const step = () => { if (stop) return; const [on, ms] = pattern[i++ % pattern.length]; el.classList.toggle("lit", on); setTimeout(step, ms); };
    step();
  };
  const U = 250, sos = [];
  ["...", "---", "..."].forEach((l, li) => { [...l].forEach((c, ci) => { sos.push([1, c === "." ? U : 3 * U]); sos.push([0, ci < l.length - 1 ? U : 3 * U]); }); });
  sos[sos.length - 1] = [0, 7 * U];
  $("#sosBtn").onclick = () => flash(sos);
  $("#sixBtn").onclick = () => flash([[1, 1500], [0, 8500]]);
  $("#lightBtn").onclick = () => flash(null);
  renderToolLoc();
}
function renderToolLoc() { const i = $("#convIn"); if (i && !i.value && LB.loc) { i.value = `${LB.loc.lat.toFixed(5)}, ${LB.loc.lon.toFixed(5)}`; i.oninput(); } }
const fmtH = h => `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`;
function coordRows(lat, lon) { return `<dt>Lat / Lon</dt><dd>${lat.toFixed(5)}, ${lon.toFixed(5)}</dd><dt>DMS</dt><dd>${dms(lat, "N", "S")} ${dms(lon, "E", "W")}</dd><dt>Irish Grid</dt><dd>${esc(GEO.igRef(lat, lon))}</dd><dt>ITM</dt><dd>${esc(GEO.fmtITM(lat, lon))}</dd>`; }
function parseCoord(s) {
  s = (s || "").trim(); if (!s) return null;
  const g = s.toUpperCase().match(/^([A-HJ-Z])\s*(\d{1,5})\s*(\d{1,5})$/) || s.toUpperCase().replace(/\s+/g, "").match(/^([A-HJ-Z])(\d{2,10})$/);
  if (g) { // Irish grid
    let e, n; if (g[3] !== undefined) { e = g[2]; n = g[3]; } else { const d = g[2]; if (d.length % 2) return null; e = d.slice(0, d.length / 2); n = d.slice(d.length / 2); }
    const letters = "VWXYZQRSTULMNOPFGHJKABCDE", i = letters.indexOf(g[1]); if (i < 0) return null;
    const E = (i % 5) * 1e5 + +e.padEnd(5, "0"), N = Math.floor(i / 5) * 1e5 + +n.padEnd(5, "0");
    return igToLatLon(E, N);
  }
  const nums = s.match(/-?\d+(\.\d+)?/g); if (!nums || nums.length < 2) return null;
  const a = +nums[0], b = +nums[1];
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b];
  if (a > 300000 && a < 800000 && b > 400000 && b < 1000000) return GEO.fromITM(a, b);
  return null;
}
// Irish Grid → WGS84 by iterating the forward transform (good to <1 m)
function igToLatLon(E, N) {
  let lat = 53.5, lon = -8;
  for (let k = 0; k < 30; k++) {
    const [e1, n1] = GEO.toIG(lat, lon), [e2] = GEO.toIG(lat, lon + 1e-4), [, n3] = GEO.toIG(lat + 1e-4, lon);
    lon += (E - e1) / ((e2 - e1) / 1e-4); lat += (N - n1) / ((n3 - n1) / 1e-4);
  }
  return [lat, lon];
}
LB.parseCoord = parseCoord; LB.coordRows = coordRows; LB.dms = dms;

/* ================================================================ GLOBAL SEARCH (⌘K) */
const pal = $("#palette"), qIn = $("#q");
let palSel = 0, palItems = [], palSeq = 0;
function openPalette(prefill) { pal.hidden = false; qIn.value = prefill ?? qIn.value; qIn.focus(); qIn.select(); runSearch(); }
function closePalette() { pal.hidden = true; }
$("#searchBtn").onclick = () => openPalette();
pal.onclick = e => { if (e.target === pal) closePalette(); };
addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.hidden ? openPalette() : closePalette(); }
  else if (e.key === "/" && pal.hidden && !/input|textarea/i.test(document.activeElement.tagName) && !$("#view-map").classList.contains("on")) { e.preventDefault(); openPalette(); }
  else if (!pal.hidden) {
    if (e.key === "Escape") closePalette();
    else if (e.key === "ArrowDown") { e.preventDefault(); selPal(palSel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); selPal(palSel - 1); }
    else if (e.key === "Enter") { e.preventDefault(); palItems[palSel]?.act(); }
  }
});
function selPal(i) { const els = $$(".pal-item", pal); if (!els.length) return; palSel = (i + els.length) % els.length; els.forEach((el, j) => el.classList.toggle("sel", j === palSel)); els[palSel].scrollIntoView({ block: "nearest" }); }
qIn.oninput = debounce(runSearch, 140);

const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
LB.searchPlaces = async (q, n = 8) => {
  const ps = await LB.loadPlaces(); q = norm(q.trim()); if (q.length < 2) return [];
  const pre = [], sub = [];
  for (const p of ps) { const i = p.s.indexOf(q); if (i === 0 || p.s.includes(" " + q) && p.s.startsWith(q.split(" ")[0])) { pre.push(p); if (pre.length > 200) break; } else if (i > 0 && sub.length < 60) sub.push(p); }
  return [...pre, ...sub].slice(0, n);
};
const KIND = { city: "City", town: "Town", village: "Village", hamlet: "Hamlet", suburb: "Suburb", neighbourhood: "Neighbourhood", quarter: "Quarter", townland: "Townland", locality: "Locality", island: "Island", islet: "Islet", isolated_dwelling: "Dwelling", peak: "Peak", bay: "Bay", beach: "Beach", cape: "Headland", valley: "Valley", ridge: "Ridge", saddle: "Pass", cliff: "Cliff", river: "River", lake: "Lake" };
LB.KIND = KIND;
LB.placeLabel = p => `${KIND[p.k] || p.k}${p.ga ? " · " + p.ga : ""}${p.k === "peak" && p.x ? " · " + p.x + " m" : ""}${LB.nearestPlace && p.k !== "city" && p.k !== "town" ? "" : ""}`;

async function kiwixSearch(q, bookKey, n = 5) {
  const b = await LB.book(bookKey); if (!b) return [];
  try {
    const x = await fetch(`/kiwix/search?books.name=${encodeURIComponent(b.book)}&pattern=${encodeURIComponent(q)}&format=xml&pageLength=${n}`).then(r => r.text());
    const doc = new DOMParser().parseFromString(x, "text/xml");
    return [...doc.querySelectorAll("item")].map(it => ({ title: (it.querySelector("title")?.textContent || "").replace(/ [|–—] [^|–—]*(Encyclopedia|Wiki)[^|–—]*$/, ""), url: it.querySelector("link")?.textContent, desc: it.querySelector("description")?.textContent?.replace(/<[^>]+>/g, "") || "", book: b.title }));
  } catch { return []; }
}
LB.kiwixSearch = kiwixSearch;

async function runSearch() {
  const q = qIn.value.trim(), seq = ++palSeq, R = $("#qResults");
  if (q.length < 2) {
    R.innerHTML = `<div class="pal-group"><div>Try</div>${["hypothermia", "Carrauntoohil", "boil water notice", "tourniquet", "Athlone", "wild garlic", "carbon monoxide"].map(t => `<div class="pal-item" data-try="${t}"><div class="pi">${icon("search")}</div><div class="pt"><b>${t}</b></div></div>`).join("")}</div>`;
    palItems = $$(".pal-item", R).map(el => ({ act: () => { qIn.value = el.dataset.try; runSearch(); } })); $$(".pal-item", R).forEach((el, i) => el.onclick = () => palItems[i].act()); selPal(0); return;
  }
  const groups = { Guides: [], Places: [], Manuals: [], WikiMed: [], Wikipedia: [] };
  const draw = () => {
    if (seq !== palSeq) return;
    palItems = [];
    R.innerHTML = Object.entries(groups).filter(([, v]) => v.length).map(([g, v]) => `<div class="pal-group"><div>${g}</div>${v.map(it => { palItems.push(it); return `<div class="pal-item"><div class="pi">${icon(it.icon)}</div><div class="pt"><b>${esc(it.t)}</b><small>${esc(it.s)}</small></div></div>`; }).join("")}</div>`).join("") || `<div class="empty">Searching…</div>`;
    $$(".pal-item", R).forEach((el, i) => el.onclick = () => palItems[i].act()); selPal(Math.min(palSel, palItems.length - 1));
  };
  const nq = norm(q);
  groups.Guides = GUIDES.filter(g => norm(g.title + " " + g.summary).includes(nq) || norm(g.html.replace(/<[^>]+>/g, " ")).includes(nq)).slice(0, 4)
    .map(g => ({ icon: (GUIDE_META[g.id] || {}).icon || "book", t: g.title, s: "Field guide · " + g.summary, act: () => { closePalette(); LB.go("#/guide/" + g.id); } }));
  palSel = 0; draw();
  const coord = parseCoord(q);
  if (coord) groups.Places.unshift({ icon: "pin", t: `${coord[0].toFixed(5)}, ${coord[1].toFixed(5)}`, s: "Coordinates · show on map", act: () => { closePalette(); LB.go(`#/map?lat=${coord[0]}&lon=${coord[1]}&z=14&pin=1`); } });
  LB.searchPlaces(q, 6).then(ps => { groups.Places.push(...ps.map(p => ({ icon: "pin", t: p.n, s: LB.placeLabel(p), act: () => { closePalette(); LB.go(`#/map?lat=${p.lat}&lon=${p.lon}&z=${p.k === "city" ? 12 : p.k === "town" ? 13 : 14}&pin=1&name=${encodeURIComponent(p.n)}`); } }))); draw(); });
  fetch("api/docs?q=" + encodeURIComponent(q)).then(r => r.json()).then(hs => { groups.Manuals = (hs || []).slice(0, 5).map(h => ({ icon: "file", t: h.title, s: `${h.source}${h.pages > 1 ? " · p." + h.page : ""} — ${h.snippet}`, act: () => { closePalette(); LB.open(docUrl(h), h.title, h.source); } })); draw(); }).catch(() => {});
  kiwixSearch(q, "med", 4).then(r => { groups.WikiMed = r.map(a => ({ icon: "heart", t: a.title, s: a.desc.slice(0, 140), act: () => { closePalette(); LB.open(a.url, a.title, a.book); } })); draw(); });
  kiwixSearch(q, "wp", 4).then(r => { groups.Wikipedia = r.map(a => ({ icon: "globe", t: a.title, s: a.desc.slice(0, 140), act: () => { closePalette(); LB.open(a.url, a.title, a.book); } })); draw(); });
  groups.More = [{ icon: "library", t: `Search all libraries for “${q}”`, s: "iFixit, Wikibooks, Wikivoyage, Appropedia, NHS medicines, gardening…", act: () => { closePalette(); LB.go("#/library?q=" + encodeURIComponent(q)); } }];
}

// first route only once every script (library.js etc.) has run — a timer could fire while later scripts are still loading
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", route); else setTimeout(route, 0);
})();
