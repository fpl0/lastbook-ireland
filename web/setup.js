/* Lastbook Ireland — Set up offline data: choose what to download, then watch it arrive (runs in the engine). */
(() => {
const { $, $$, esc, icon, toast } = LB;
const GB = 1e9;
const fmtSize = b => b >= 1e9 ? (b / 1e9).toFixed(b >= 1e10 ? 0 : 1) + " GB" : b >= 1e6 ? Math.round(b / 1e6) + " MB" : b > 0 ? Math.max(1, Math.round(b / 1e3)) + " KB" : "—";
const fmtTime = s => !isFinite(s) || s <= 0 ? "" : s < 90 ? Math.round(s) + " s" : s < 5400 ? Math.round(s / 60) + " min" : (s / 3600).toFixed(1) + " h";
const GROUPS = ["Map", "Emergency & medicine", "Survival & preparedness", "Rebuilding: skills, energy & science", "General knowledge", "Guidance & search"];
let state = null, chosen = null, timer = null;
const lastStatus = {};
const isInst = i => i.Status === "installed" || i.Status === "done";
const isBusy = i => ["queued", "active", "verifying"].includes(i.Status);
const counted = i => i.Kind === "guidance" || i.Kind === "index";   // progress in pages, not bytes
// overall progress across the running download, in bytes
function progress(items) {
  const act = items.filter(i => isBusy(i) && !counted(i));
  const tot = act.reduce((n, i) => n + (i.Size || 0), 0), dn = act.reduce((n, i) => n + Math.min(i.Done || 0, i.Size || 0), 0);
  return { tot, dn, pct: tot ? Math.min(99, Math.floor(100 * dn / tot)) : 0 };
}

async function poll() {
  try { state = await fetch("api/setup").then(r => r.json()); } catch { return; }
  if (!chosen) chosen = new Set(state.items.filter(i => !isInst(i) && (i.Selected || i.Default)).map(i => i.ID));
  // when a run ends (paused or with errors), what's left over is selected so "Download" picks up where it stopped
  state.items.forEach(i => { if ((i.Status === "stopped" || i.Status === "error") && lastStatus[i.ID] !== i.Status) chosen.add(i.ID); lastStatus[i.ID] = i.Status; });
  window.dispatchEvent(new CustomEvent("lb:setup", { detail: state }));
  if ($("#view-setup").classList.contains("on")) render();
}
LB.setupState = () => state;

function totals() {
  const sz = i => counted(i) ? (i.Kind === "guidance" ? 15e6 : 0) : (i.Size || 0);
  const pick = state.items.filter(i => chosen.has(i.ID) && !isInst(i));
  const size = pick.reduce((n, i) => n + sz(i), 0);
  const all = state.items.filter(i => !isInst(i)).reduce((n, i) => n + sz(i), 0);
  const ess = state.items.filter(i => i.Default && !isInst(i)).reduce((n, i) => n + sz(i), 0);
  return { pick, size, all, ess };
}

function render() {
  const v = $("#view-setup");
  if (!state) { v.innerHTML = `<div class="page"><div class="skeleton"></div></div>`; return; }
  const { pick, size, all, ess } = totals();
  const installed = state.items.filter(isInst);
  const running = state.running;
  const { tot: totalBytes, dn: doneBytes, pct } = progress(state.items);
  const eta = state.speed > 0 ? (totalBytes - doneBytes) / state.speed : NaN;
  const lowDisk = state.free > 0 && size > state.free - 2 * GB;
  const first = !v.dataset.built;
  const keepScroll = v.scrollTop;
  v.dataset.built = 1;
  v.innerHTML = `<div class="page">
    <div class="eyebrow">Offline data</div>
    <h1>${installed.length ? "Your offline library" : "Download everything you need, once"}</h1>
    <p class="lede">Lastbook keeps its map, libraries and manuals on this Mac so they work with no internet. Download them now, while you have a connection — each library is checked against its published checksum, and interrupted downloads resume where they stopped.</p>

    ${running ? `<div class="setup-run">
      <div class="sr-top"><b>${pct}%</b><span>${esc(state.phase || "Preparing…")}</span><button class="btn sm" id="suStop">Pause</button></div>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="sr-meta">${fmtSize(doneBytes)} of ${fmtSize(totalBytes)} · ${state.speed > 0 ? fmtSize(state.speed) + "/s" : "connecting…"}${fmtTime(eta) ? " · about " + fmtTime(eta) + " left" : ""} · you can keep using Lastbook meanwhile</div>
    </div>` : `<div class="setup-plan">
      <div class="seg" id="suPreset">
        <button data-p="ess">Essentials · ${fmtSize(ess)}</button>
        <button data-p="all">Everything · ${fmtSize(all)}</button>
        <button data-p="none">Clear</button>
      </div>
      <div class="sp-row">
        <div><b>${pick.length ? fmtSize(size) : "Nothing selected"}</b><span>${pick.length} item${pick.length === 1 ? "" : "s"} to download · ${fmtSize(state.free)} free on this Mac</span></div>
        <button class="btn primary" id="suStart" ${pick.length && !lowDisk ? "" : "disabled"}>${icon("check")} ${pick.length ? "Download " + fmtSize(size) : "Download"}</button>
      </div>
      ${lowDisk ? `<div class="callout red">Not enough free space for this selection — free up space or choose fewer libraries.</div>` : ""}
    </div>`}

    ${GROUPS.map((g, gi) => {
      const its = state.items.filter(i => i.Group === g);
      if (!its.length) return "";
      return `<h2>${esc(g)}</h2><div class="su-list">${its.map(row).join("")}</div>`;
    }).join("")}
    <p class="muted" style="font-size:12.5px;margin-top:28px">Stored in <code>${esc(state.dataDir)}</code>. Sources: Kiwix (download.kiwix.org), Protomaps / OpenStreetMap, Mapterhorn, and the official sites listed in the Library. Downloads need internet; everything afterwards works offline.</p>
  </div>`;
  if (!first) v.scrollTop = keepScroll;
  $$("[data-id]", v).forEach(el => {
    const cb = el.querySelector("input");
    if (cb) cb.onchange = () => { cb.checked ? chosen.add(el.dataset.id) : chosen.delete(el.dataset.id); render(); };
  });
  const pre = $("#suPreset");
  if (pre) pre.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    chosen = new Set(b.dataset.p === "none" ? [] : state.items.filter(i => !isInst(i) && (b.dataset.p === "all" || i.Default)).map(i => i.ID));
    render();
  };
  const st = $("#suStart");
  if (st) st.onclick = async () => {
    const ids = [...chosen];
    state = await fetch("api/setup/start", { method: "POST", body: JSON.stringify({ Items: ids }) }).then(r => r.json());
    toast("Downloading — you can keep using Lastbook");
    render(); schedule();
  };
  const sp = $("#suStop");
  if (sp) sp.onclick = async () => { state = await fetch("api/setup/stop", { method: "POST" }).then(r => r.json()); toast("Paused — press Download to continue"); setTimeout(poll, 800); };
}

function row(i) {
  const inst = isInst(i), busy = isBusy(i);
  const pct = i.Size ? Math.min(100, Math.round(100 * (i.Done || 0) / i.Size)) : 0;
  const status = inst ? `<span class="su-ok">${icon("check")} Installed</span>`
    : i.Status === "active" ? `<span>${counted(i) ? (i.Size ? `${i.Done} of ${i.Size} ${i.Kind === "index" ? "files" : "pages"}` : "Starting…") : `${fmtSize(i.Done)} of ${fmtSize(i.Size)}`}</span>`
    : i.Status === "verifying" ? `<span>Checking…</span>`
    : i.Status === "queued" ? `<span class="muted">Waiting</span>`
    : i.Status === "error" ? `<span class="su-err" title="${esc(i.Error || "")}">Failed — select to retry</span>`
    : i.Status === "stopped" ? `<span class="muted">Paused</span>`
    : `<span class="muted">${i.Kind === "index" ? "built here" : i.Kind === "guidance" ? "~15 MB" : fmtSize(i.Size)}</span>`;
  return `<label class="su-row ${inst ? "inst" : ""} ${busy ? "busy" : ""}" data-id="${esc(i.ID)}">
    ${inst || state.running ? `<span class="su-box"></span>` : `<input type="checkbox" ${chosen.has(i.ID) ? "checked" : ""}>`}
    <span class="su-t">${esc(i.Title)}${i.Error && i.Status === "error" ? `<small>${esc(i.Error)}</small>` : ""}</span>
    ${status}
    ${busy && i.Status !== "queued" ? `<span class="su-bar"><span style="width:${pct}%"></span></span>` : ""}
  </label>`;
}

function schedule() {
  clearTimeout(timer);
  const fast = (state && state.running) || $("#view-setup").classList.contains("on");
  timer = setTimeout(async () => { await poll(); schedule(); }, fast ? 1000 : 6000);
}

// top-bar status shows progress while downloading
window.addEventListener("lb:setup", e => {
  const s = e.detail, t = $("#statusText");
  if (!t) return;
  if (s.running) {
    t.textContent = `Downloading · ${progress(s.items).pct}%`;
    $("#status").classList.add("warn");
    LB._wasRunning = true;
  } else if (LB._wasRunning) {
    LB._wasRunning = false;
    const failed = s.items.some(i => i.Status === "error");
    toast(failed ? "Download stopped with errors — open Data to retry" : "Download finished — everything is ready offline");
    const lv = $("#view-library"); if (lv) lv.dataset.built = "";
    LB.refreshStatus().then(() => window.dispatchEvent(new Event("hashchange")));
  }
});

window.addEventListener("lb:route", e => {
  if (e.detail.tab === "setup") { if (!$("#view-setup").dataset.built) render(); poll(); schedule(); }
});
poll().then(schedule);
})();
