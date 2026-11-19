/* Lastbook Ireland — Library (Kiwix collections, survival manuals, official guidance) + Reader */
(() => {
const { $, $$, esc, icon, store, toast, debounce } = LB;

// Curated descriptions, order and sections for the collections (matched by name prefix)
const G_MED = "Emergency & medicine", G_SURV = "Survival & preparedness", G_BUILD = "Rebuilding: skills, energy & science", G_REF = "General knowledge";
const SHELF = [
  ["wikipedia_en_medicine", "WikiMed Medical Encyclopedia", "Every medical article on Wikipedia — conditions, drugs, procedures, anatomy — with images.", "heart", G_MED],
  ["nhs.uk_en_medicines", "NHS Medicines A–Z", "What each medicine is for, how to take it, doses, side effects and interactions.", "pill", G_MED],
  ["zimgit-medicine", "Austere Medicine Library", "Where There Is No Doctor / Dentist, Emergency War Surgery, wound closure, wilderness medicine, midwifery.", "heart", G_MED],
  ["irp.fas.org_en_military-medicine", "Military Medicine", "US military medical manuals: combat casualty care, field surgery, special forces medical handbook.", "shield", G_MED],
  ["libretexts.org_en_med", "Medicine Textbooks", "Open university textbooks: anatomy, physiology, nursing, pharmacology, public health.", "heart", G_MED],
  ["zimgit-post-disaster", "Post-Disaster Library", "Army survival manuals, Where There Is No Doctor, nuclear survival, shelters, foraging, preserving, trapping.", "tent", G_SURV],
  ["zimgit-water", "Water Treatment Library", "Purifying, distilling and testing water during an emergency.", "drop", G_SURV],
  ["zimgit-food-preparation", "Food & Preserving", "Canning, drying, curing, fermenting and camp cooking.", "can", G_SURV],
  ["zimgit-knots", "Knots & Rope", "Encyclopedia of knots, splices, lashings and rope rescue.", "knot", G_SURV],
  ["gardenology", "Gardenology", "Encyclopedia of plants and gardening — what to grow and how.", "leaf", G_SURV],
  ["cd3wdproject.org", "CD3WD — Rebuild & Development", "Thousands of practical manuals (FAO, WHO, ITDG and more): farming, water, building, energy, health, small-scale industry.", "sprout", G_BUILD],
  ["appropedia", "Appropedia", "Appropriate technology: water, sanitation, energy, building, agriculture, low-tech fixes.", "sprout", G_BUILD],
  ["energypedia", "Energypedia", "Off-grid energy: solar, micro-hydro, wind, biogas, batteries, efficient cookstoves.", "sun", G_BUILD],
  ["libretexts.org_en_workforce", "Trades & Workforce", "Open textbooks for the trades: construction, electrical, welding, HVAC, automotive, agriculture.", "tool", G_BUILD],
  ["libretexts.org_en_eng", "Engineering", "Open textbooks: mechanical, civil, electrical and chemical engineering.", "tool", G_BUILD],
  ["ifixit", "iFixit Repair Guides", "Step-by-step repair guides for phones, radios, tools, appliances, cars and more.", "tool", G_BUILD],
  ["libretexts.org_en_chem", "Chemistry", "Open textbooks: general, organic, analytical and environmental chemistry.", "flame", G_BUILD],
  ["libretexts.org_en_phys", "Physics", "Open textbooks: mechanics, electricity and magnetism, thermodynamics, optics.", "plug", G_BUILD],
  ["libretexts.org_en_bio", "Biology", "Open textbooks: cell biology, genetics, microbiology, ecology, botany.", "leaf", G_BUILD],
  ["libretexts.org_en_math", "Mathematics", "Open textbooks from arithmetic to calculus, statistics and applied maths.", "ruler", G_BUILD],
  ["libretexts.org_en_socialsci", "Social Science", "Open textbooks on how societies work: governance, economics, law, sociology, community organising.", "chat", G_BUILD],
  ["wikipedia_en_top", "Wikipedia", "The most-read English Wikipedia articles with images: science, history, places, plants, animals, technology.", "globe", G_REF],
  ["wikibooks", "Wikibooks", "Open textbooks: first aid, cookbook, chemistry, engineering, languages and much more.", "book", G_REF],
  ["internet-encyclopedia-philosophy", "Internet Encyclopedia of Philosophy", "Peer-reviewed encyclopedia of philosophy: ethics, logic, philosophers, schools of thought.", "brain", G_REF],
  ["wikivoyage", "Wikivoyage", "Travel guide for every county, town and region — getting around, where to stay.", "map", G_REF],
];
const GROUPS = [G_MED, G_SURV, G_BUILD, G_REF];
const HUE = { brain: "violet", heart: "red", pill: "red", shield: "red", globe: "blue", drop: "blue", map: "blue", tent: "green", sprout: "green", leaf: "green", can: "amber", tool: "amber", knot: "violet", book: "violet", sun: "amber", flame: "amber", plug: "blue", ruler: "violet", chat: "teal" };
const shelfInfo = b => SHELF.find(s => b.name.startsWith(s[0]));

async function renderLibrary(params) {
  const v = $("#view-library");
  const q = params.get("q") || "";
  if (!v.dataset.built) v.innerHTML = `<div class="page"><div class="eyebrow">Library</div><h1>Opening the libraries…</h1><div class="skeleton" style="width:60%;margin-top:24px"></div><div class="skeleton" style="width:40%"></div></div>`;
  const books = (await LB.loadBooks()).filter(b => b.book);
  books.sort((a, b) => SHELF.findIndex(s => a.name.startsWith(s[0])) - SHELF.findIndex(s => b.name.startsWith(s[0])));
  if (!books.length) {
    const st = await LB.status;
    if (!st.library) { v.dataset.built = ""; v.innerHTML = `<div class="page"><div class="eyebrow">Library</div><h1>Offline libraries</h1>${LB.noDataCard("The offline library", st.dataDir)}</div>`; return; }
    v.dataset.built = ""; setTimeout(() => location.hash.startsWith("#/library") && renderLibrary(params), 1500); return;
  }
  if (!v.dataset.built) {
    v.dataset.built = 1;
    v.innerHTML = `<div class="page">
      <div class="page-head"><div><div class="eyebrow">Library</div><h1>${books.length} offline libraries · ${fmtCount(books.reduce((n, b) => n + (b.articles || 0), 0))} articles</h1>
      <p class="lede">Encyclopedias, medical references, survival and field manuals, repair guides and official Irish guidance — all on this computer, searchable without a connection. <a href="#/setup">Add or update libraries →</a></p></div></div>
      <div class="lib-search"><input class="input" id="libQ" placeholder="Search every library — e.g. splint, diabetic emergency, solar panel wiring, potato blight"></div>
      <div id="libResults"></div>
      <div id="libHome"></div>
    </div>`;
    $("#libQ").oninput = debounce(() => { const val = $("#libQ").value.trim(); history.replaceState(null, "", "#/library" + (val ? "?q=" + encodeURIComponent(val) : "")); search(val, books); }, 250);
    renderHome(books);
  }
  if ($("#libQ").value !== q) { $("#libQ").value = q; }
  search(q, books);
  if (!q) setTimeout(() => $("#libQ")?.focus(), 50);
}
const fmtCount = n => n > 1e6 ? (n / 1e6).toFixed(1) + " million" : n > 1000 ? Math.round(n / 1000) + "k" : String(n);

async function renderHome(books) {
  const home = $("#libHome");
  const docs = await fetch("api/doclist").then(r => r.json()).catch(() => []);
  const marks = store.get("bookmarks", []), recent = store.get("recent", []);
  const byCat = {};
  for (const d of docs) { if (d.Dup) continue; const c = d.Cat === "Official guidance" ? "Official guidance" : d.Source; (byCat[c] = byCat[c] || []).push(d); }
  const official = byCat["Official guidance"] || []; delete byCat["Official guidance"];
  home.innerHTML = `
    ${marks.length ? `<h2>Bookmarks</h2><div class="doclist">${marks.map(m => `<a class="docrow" data-k="mark" href="#" data-u="${esc(m.u)}" data-t="${esc(m.t)}" data-s="${esc(m.s)}">${icon("bookmark")}<span>${esc(m.t)}</span><small>${esc(m.s || "")}</small></a>`).join("")}</div>` : ""}
    ${GROUPS.map(g => {
      const inG = books.filter(b => ((shelfInfo(b) || [])[4] || G_REF) === g);
      if (!inG.length) return "";
      return `<h2>${esc(g)}</h2><div class="shelf">${inG.map(b => { const s = shelfInfo(b) || [0, b.title, b.summary, "book"];
      const shelfLink = /^(zimgit|cd3wd)/.test(b.name) ? `href="#/book/${esc(b.book)}"` : `href="#" data-u="${esc(b.href)}/" data-t="${esc(s[1])}" data-s="${esc(s[1])}"`;
      return `<a class="book" data-h="${HUE[s[3]] || "teal"}" ${shelfLink}>
      <div class="cover"><span class="ph">${icon(s[3])}</span></div><div class="bt"><b>${esc(s[1])}</b><p>${esc(s[2] || b.summary)}</p>
      <div class="meta">${b.articles > 1 ? fmtCount(b.articles) + " articles" : "Document library"}${b.ftindex ? " · full-text search" : ""}</div></div></a>`; }).join("")}</div>`; }).join("")}
    ${official.length ? `<h2>Official guidance — Ireland, Northern Ireland & Europe</h2><p class="muted" style="margin-top:-4px">Snapshots of gov.ie (Office of Emergency Planning), nidirect, HSE, Met Éireann and others, saved for offline use.</p>
      <div class="doclist">${official.map(d => `<a class="docrow" data-k="${d.URL.endsWith(".pdf") ? "pdf" : "page"}" href="#" data-u="${esc(d.URL)}" data-t="${esc(d.Title)}" data-s="${esc(d.Source)}">${icon(d.URL.endsWith(".pdf") ? "file" : "globe")}<span>${esc(d.Title)}</span><small>${esc(d.Source)}</small></a>`).join("")}</div>` : ""}
    ${Object.entries(byCat).map(([cat, ds]) => `<h2>${esc(cat)}</h2><div class="doclist">${ds.sort((a, b) => a.Title.localeCompare(b.Title)).map(d => `<a class="docrow" href="#" data-u="${esc(d.URL)}" data-t="${esc(d.Title)}" data-s="${esc(d.Source)}">${icon("file")}<span>${esc(d.Title)}</span><small>${d.Pages > 1 ? d.Pages + " pages" : ""}</small></a>`).join("")}</div>`).join("")}
    ${recent.length ? `<h2>Recently read</h2><div class="doclist">${recent.slice(0, 12).map(m => `<a class="docrow" href="#" data-u="${esc(m.u)}" data-t="${esc(m.t)}" data-s="${esc(m.s)}">${icon("book")}<span>${esc(m.t)}</span><small>${esc(m.s || "")}</small></a>`).join("")}</div>` : ""}`;
  $$("[data-u]", home).forEach(a => a.onclick = e => { e.preventDefault(); LB.open(a.dataset.u, a.dataset.t, a.dataset.s); });
}

let seq = 0;
async function search(q, books) {
  const out = $("#libResults"), home = $("#libHome"), my = ++seq;
  if (!q || q.length < 2) { out.innerHTML = ""; home.hidden = false; return; }
  home.hidden = true;
  const cols = [{ key: "docs", title: "Survival manuals & official guidance", items: null }];
  for (const b of books) { const s = shelfInfo(b); if (b.name.startsWith("zimgit")) continue; cols.push({ key: b.book, title: s ? s[1] : b.title, book: b, items: null }); }
  const draw = () => {
    if (my !== seq) return;
    out.innerHTML = `<div class="results-cols">${cols.filter(c => c.items === null || c.items.length).map(c => `<div class="card" style="padding:12px"><h4 style="margin:2px 6px 6px;font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--text-3)">${esc(c.title)}${c.items ? ` <span class="tag">${c.items.length}${c.more ? "+" : ""}</span>` : ""}</h4>
      ${c.items === null ? `<div class="skeleton"></div><div class="skeleton" style="width:60%"></div>` : c.items.map(it => it.html).join("")}</div>`).join("")}</div>
      ${cols.every(c => c.items && !c.items.length) ? `<div class="empty">Nothing found for “${esc(q)}”. Try fewer or simpler words.</div>` : ""}`;
    $$("[data-u]", out).forEach(a => a.onclick = e => { e.preventDefault(); LB.open(a.dataset.u, a.dataset.t, a.dataset.s); });
  };
  draw();
  fetch("api/docs?q=" + encodeURIComponent(q)).then(r => r.json()).then(hs => { cols[0].items = (hs || []).slice(0, 12).map(h => ({ html: LB.docHitHtml(h) })); draw(); }).catch(() => { cols[0].items = []; draw(); });
  for (const c of cols.slice(1)) {
    const b = c.book;
    const p = b.ftindex
      ? fetch(`/kiwix/search?books.name=${encodeURIComponent(b.book)}&pattern=${encodeURIComponent(q)}&format=xml&pageLength=8`).then(r => r.text()).then(x => {
          const d = new DOMParser().parseFromString(x, "text/xml");
          c.more = +(d.getElementsByTagName("opensearch:totalResults")[0]?.textContent || 0) > 8;
          return [...d.querySelectorAll("item")].map(it => ({ t: (it.querySelector("title")?.textContent || "").replace(/ [|–—] [^|–—]*(Encyclopedia|Wiki)[^|–—]*$/, ""), u: it.querySelector("link")?.textContent, d: it.querySelector("description")?.textContent || "" }));
        })
      : fetch(`/kiwix/suggest?content=${encodeURIComponent(b.book)}&term=${encodeURIComponent(q)}&count=8`).then(r => r.json()).then(a => a.filter(x => x.kind === "path").map(x => ({ t: x.value, u: `/kiwix/content/${b.book}/${x.path}`, d: "" })));
    p.then(items => { c.items = items.map(it => ({ html: `<a class="result" href="#" data-u="${esc(it.u)}" data-t="${esc(it.t)}" data-s="${esc(c.title)}"><b>${esc(it.t)}</b>${it.d ? `<p>${it.d.replace(/<(?!\/?b>)[^>]+>/g, "")}</p>` : ""}</a>` })); draw(); }).catch(() => { c.items = []; draw(); });
  }
}

/* ---------------- Reader ---------------- */
const frame = $("#reader");
let cur = null;
function openReader(params) {
  let u = params.get("u"); if (!u) return;
  const t = params.get("t") || "", s = params.get("s") || "";
  // guidance HTML fragments are shown through the styled reader page
  const src = /^\/guidance\/pages\//.test(u) ? "reader.html?src=" + encodeURIComponent(u) + "&t=" + encodeURIComponent(t) + "&s=" + encodeURIComponent(s) : u;
  cur = { u, t, s };
  $("#rdTitle").textContent = t || "Loading…"; $("#rdSource").textContent = s;
  if (frame.dataset.src !== src) { frame.dataset.src = src; if (!/\.pdf/i.test(src)) frame.style.visibility = "hidden"; frame.src = src; }
  markSaved();
  const rec = store.get("recent", []).filter(r => r.u !== u); rec.unshift({ u, t, s }); store.set("recent", rec.slice(0, 40));
}
/* Pages in the reader follow the app's light/dark theme and look (wiki-skin.css). */
function skinFrame() {
  let d; try { d = frame.contentDocument; } catch { return; }
  if (!d || !d.documentElement || !/html/i.test(d.contentType || "text/html")) { frame.style.visibility = ""; return; }
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light", de = d.documentElement;
  de.dataset.theme = theme;
  const own = /\/reader\.html$/.test(frame.contentWindow.location.pathname);   // guidance reader styles itself
  if (!own && d.head) {
    const wiki = !!d.querySelector(".mw-parser-output, #mw-content-text, .mw-body, .mediawiki");
    // plain archived pages (few stylesheets, no site chrome) get the app's reading skin; styled sites keep a solid light page
    const sheets = [...d.querySelectorAll('link[rel="stylesheet"], style')].filter(x => !/_zim_static|wiki-skin/.test(x.href || "")).length;
    const plain = !wiki && (/irp\.fas\.org/.test(frame.contentWindow.location.pathname) || (sheets <= 1 && !d.querySelector("header nav, .site-header, #header nav")));
    de.classList.toggle("lb-wiki", wiki); de.classList.toggle("lb-plain", plain); de.classList.toggle("lb-generic", !wiki && !plain);
    de.classList.remove("skin-theme-clientpref-os");                                   // the app decides, not the OS
    de.classList.toggle("skin-theme-clientpref-night", wiki && theme === "dark");   // Wikipedia's own night mode
    de.classList.toggle("skin-theme-clientpref-day", wiki && theme !== "dark");
    // inline <style>, not <link>: archived web pages rewrite link URLs to the original (online) site
    if (!d.getElementById("lb-skin")) { const st = d.createElement("style"); st.id = "lb-skin"; st.textContent = skinCSS || ""; d.head.appendChild(st); if (!skinCSS) skinReady.then(css => (st.textContent = css)); }
  }
  frame.style.visibility = "";
}
let skinCSS = "";
const skinReady = fetch("wiki-skin.css").then(r => r.text()).then(t => (skinCSS = t)).catch(() => "");
window.addEventListener("lb:theme", skinFrame);
frame.addEventListener("load", () => {
  skinFrame();
  try {
    const d = frame.contentDocument; if (!d) return;
    const title = d.title && !/^(Lastbook|Page not found|Reader)$|^(Lastbook|Page not found)/.test(d.title) ? d.title.replace(/ - Wiki.*$/, "").replace(/ [|–—] [^|–—]*(Encyclopedia|Wiki)[^|–—]*$/, "") : null;
    if (title) { $("#rdTitle").textContent = title; if (cur) cur.t = title; }
    const loc = frame.contentWindow.location; if (cur && loc.pathname.startsWith("/kiwix/")) cur.u = loc.pathname + loc.search + loc.hash;
    markSaved();
    // Archived websites (zimit/warc ZIMs) replay through a URL-rewriting script: their links already point at the local
    // copy, but reading a.href reports the original web address. Leave those clicks alone — the app's offline guard
    // still stops anything that really is external.
    const archived = !!d.querySelector('script[src*="wombat" i], script[src*="_zim_static" i]') || /wombatSetup|_WBWombatInit/.test(d.documentElement.innerHTML.slice(0, 20000));
    if (!archived) {
      // ordinary pages: open external links in the system browser rather than the frame
      d.addEventListener("click", e => { const a = e.target.closest && e.target.closest("a[href]"); if (a && /^https?:/.test(a.href) && !a.href.startsWith(location.origin)) { e.preventDefault(); window.open(a.href, "_blank"); } }, true);
    }
    if (/cd3wdproject\.org/.test(frame.contentWindow.location.pathname)) cd3wdRows(d);
    // site search boxes post to the original site (or Google) — answer them from the offline library instead
    d.addEventListener("submit", e => {
      const f = e.target, act = (f.getAttribute("action") || "").trim();
      if (!/^https?:\/\//i.test(act) || act.startsWith(location.origin)) return;
      const inp = f.querySelector('input[type="search"], input[type="text"], input[name="s"], input[name="q"], input:not([type])');
      e.preventDefault(); e.stopPropagation();
      const q = inp && inp.value.trim(); if (q) LB.go("#/library?q=" + encodeURIComponent(q));
    }, true);
  } catch {}
});
/* CD3WD book contents: only a tiny icon next to each chapter title is a link. Make the whole title clickable,
   in this document and in every frame it contains (books are framesets: banner + contents/chapter). */
function cd3wdRows(doc) {
  if (!doc || !doc.documentElement) return;
  const wire = dd => {
    if (!dd || !dd.body || dd.__lbRows) return;
    dd.__lbRows = true;
    const st = dd.createElement("style");
    st.textContent = "td.lb-rowlink{cursor:pointer;color:#0d6e4f;text-decoration:underline;text-decoration-color:rgba(13,110,79,.35);text-underline-offset:2px}td.lb-rowlink:hover{color:#08583e;text-decoration-color:currentColor}";
    dd.head && dd.head.appendChild(st);
    for (const a of dd.querySelectorAll("td > a[href] > img")) {
      const link = a.parentElement, cell = link.parentElement;
      let t = cell.nextElementSibling;                       // the title sits in the next cell…
      if (!t || !t.textContent.trim()) {                     // …or, when the <td> wasn't closed, after the link in the same cell
        const sib = link.nextElementSibling; t = sib && sib.tagName === "TD" ? sib : null;
      }
      if (!t || t.querySelector("a") || !t.textContent.trim()) continue;
      t.classList.add("lb-rowlink");
      t.addEventListener("click", () => link.click());
    }
  };
  const visit = dd => {
    wire(dd);
    for (const fr of dd.querySelectorAll("frame, iframe")) {
      fr.addEventListener("load", () => { try { visit(fr.contentDocument); } catch {} });
      try { if (fr.contentDocument && fr.contentDocument.readyState !== "loading") visit(fr.contentDocument); } catch {}
    }
  };
  visit(doc);
}
$("#rdBack").onclick = () => { try { frame.contentWindow.history.back(); } catch { history.back(); } };
$("#rdFwd").onclick = () => { try { frame.contentWindow.history.forward(); } catch {} };
$("#rdClose").onclick = () => LB.go(LB.lastView || "#/library");
function markSaved() { const on = cur && store.get("bookmarks", []).some(b => b.u === cur.u); $("#rdSave").classList.toggle("on", !!on); $("#rdSave").style.color = on ? "var(--accent)" : ""; }
$("#rdSave").onclick = () => {
  if (!cur) return; let b = store.get("bookmarks", []);
  if (b.some(x => x.u === cur.u)) { b = b.filter(x => x.u !== cur.u); toast("Bookmark removed"); } else { b.unshift({ u: cur.u, t: $("#rdTitle").textContent, s: cur.s }); toast("Bookmarked"); }
  store.set("bookmarks", b); markSaved(); const lv = $("#view-library"); delete lv.dataset.built;
};

/* Native shelf for the document libraries (PDF collections): every manual by category, with a filter */
/* CD3WD: ~1,000 development manuals by subject, from the catalogue built by tools/build_cd3wd.py */
async function renderCD3WD(bookId) {
  const v = $("#view-library");
  v.dataset.built = "";
  const [books, cat] = await Promise.all([LB.loadBooks(), fetch("data/cd3wd.json").then(r => r.json()).catch(() => null)]);
  const b = books.find(x => x.book === bookId), s = b && shelfInfo(b);
  if (!cat) { v.innerHTML = `<div class="page"><div class="empty">The CD3WD catalogue is missing — run tools/build_cd3wd.py. <a href="#" id="cdRaw">Open the original index</a></div></div>`;
    $("#cdRaw").onclick = e => { e.preventDefault(); LB.open(`/kiwix/content/${bookId}/www.cd3wdproject.org/CD3WD/INDEX.HTM`, "CD3WD index", "CD3WD"); }; return; }
  const byCat = {};
  for (const e of cat.items) (byCat[e.cat] = byCat[e.cat] || []).push(e);
  const cats = Object.keys(byCat).sort((a, b) => (a === "Miscellaneous") - (b === "Miscellaneous") || a.localeCompare(b));
  v.innerHTML = `<div class="page">
    <a href="#/library" class="muted" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:12px">${icon("left")} Library</a>
    <div class="eyebrow">Development library · ${cat.items.length} publications · ${cats.length} subjects</div>
    <h1>${esc(s ? s[1] : "CD3WD")}</h1>
    <p class="lede">${esc(s ? s[2] : "")} Every publication is searchable from the Library search and ⌘K.</p>
    <div class="lib-search" style="margin-top:20px"><input class="input" id="shelfQ" placeholder="Filter ${cat.items.length} publications — e.g. well, bricks, solar dryer, goats"></div>
    <div class="seg" id="cdCats" style="margin:4px 0 6px">${cats.map(c => `<button data-c="${esc(c)}">${esc(c)} <span class="muted">${byCat[c].length}</span></button>`).join("")}</div>
    <div id="shelfList">${cats.map(c => `<section data-c="${esc(c)}"><h2>${esc(c)}</h2><div class="doclist">${byCat[c].map(e =>
      `<a class="docrow" data-k="page" href="#" data-u="${esc(e.path)}" data-t="${esc(e.title)}" data-s="CD3WD · ${esc(c)}" data-f="${esc((e.title + " " + e.meta + " " + e.code + " " + c).toLowerCase())}">${icon("book")}<span>${esc(e.title)}</span><small>${esc(e.meta || e.code.replace(/_/g, " "))}</small></a>`).join("")}</div></section>`).join("")}</div>
  </div>`;
  $$("[data-u]", v).forEach(a => a.onclick = ev => { ev.preventDefault(); LB.open(a.dataset.u, a.dataset.t, a.dataset.s); });
  let only = null;
  const apply = () => {
    const q = $("#shelfQ").value.trim().toLowerCase();
    $$("#shelfList section", v).forEach(sec => {
      let any = false;
      if (only && sec.dataset.c !== only) { sec.hidden = true; return; }
      $$(".docrow", sec).forEach(r => { const on = !q || q.split(/\s+/).every(w => r.dataset.f.includes(w)); r.hidden = !on; any = any || on; });
      sec.hidden = !any;
    });
  };
  $("#shelfQ").oninput = apply;
  $("#cdCats").onclick = e => { const btn = e.target.closest("button"); if (!btn) return; only = only === btn.dataset.c ? null : btn.dataset.c; $$("#cdCats button", v).forEach(x => x.classList.toggle("on", x.dataset.c === only)); apply(); };
}

async function renderShelf(bookId) {
  if (/^cd3wd/.test(bookId)) return renderCD3WD(bookId);
  const v = $("#view-library");
  v.dataset.built = "";
  const [books, docs] = await Promise.all([LB.loadBooks(), fetch("api/doclist").then(r => r.json()).catch(() => [])]);
  const b = books.find(x => x.book === bookId), s = b && shelfInfo(b);
  const mine = docs.filter(d => d.URL.includes(`/kiwix/content/${bookId}/`));
  let byCat = {};
  for (const d of mine) (byCat[d.Cat] = byCat[d.Cat] || []).push(d);
  // when "categories" are really per-document taglines, show one list with the tagline under each title
  const cats = Object.values(byCat);
  if (cats.length > 1 && cats.filter(c => c.length === 1).length >= cats.length / 2) {
    mine.forEach(d => { if (!d.Desc && d.Cat !== (s && s[1])) d.Desc = d.Cat; });
    byCat = { "All documents": mine };
  }
  const pages = mine.reduce((n, d) => n + (d.Pages || 0), 0);
  v.innerHTML = `<div class="page">
    <a href="#/library" class="muted" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:12px">${icon("left")} Library</a>
    <div class="eyebrow">Document library · ${mine.length} documents · ${pages.toLocaleString()} pages</div>
    <h1>${esc(s ? s[1] : bookId)}</h1>
    <p class="lede">${esc(s ? s[2] : "")} Every page is searchable from the Library search and ⌘K.</p>
    <div class="lib-search" style="margin-top:20px"><input class="input" id="shelfQ" placeholder="Filter these documents…"></div>
    <div id="shelfList">${Object.entries(byCat).sort((a, b) => a[0].localeCompare(b[0])).map(([cat, ds]) => `<section><h2>${esc(cat)}</h2><div class="doclist">${ds.sort((a, b) => a.Title.localeCompare(b.Title)).map(d =>
      `<a class="docrow" data-k="pdf" href="#" data-u="${esc(d.URL)}" data-t="${esc(d.Title)}" data-s="${esc(s ? s[1] : "")}" data-f="${esc((d.Title + " " + cat + " " + (d.Desc || "")).toLowerCase())}">${icon("file")}<span>${esc(d.Title)}</span><small>${d.Pages > 1 ? d.Pages + " pages" : "PDF"}${d.Desc ? " · " + esc(d.Desc) : ""}</small></a>`).join("")}</div></section>`).join("") || `<div class="empty">No documents indexed for this library.</div>`}</div>
  </div>`;
  $$("[data-u]", v).forEach(a => a.onclick = e => { e.preventDefault(); LB.open(a.dataset.u, a.dataset.t, a.dataset.s); });
  $("#shelfQ").oninput = () => {
    const q = $("#shelfQ").value.trim().toLowerCase();
    $$("#shelfList section", v).forEach(sec => { let any = false; $$(".docrow", sec).forEach(r => { const on = !q || r.dataset.f.includes(q); r.hidden = !on; any = any || on; }); sec.hidden = !any; });
  };
}

window.addEventListener("lb:route", e => {
  const { tab, params, section, arg } = e.detail;
  if (tab === "library" && section === "book") { renderShelf(decodeURIComponent(arg)); return; }
  if (tab === "library") renderLibrary(params);
  if (tab === "read") openReader(params);
});
// opened straight onto a reader URL (e.g. after a reload): open it once everything is wired up
setTimeout(() => { if ((location.hash || "").startsWith("#/read") && !frame.dataset.src) openReader(new URLSearchParams(location.hash.split("?")[1] || "")); }, 50);
})();
