// Age of Sigmar Helper: state + rendering
const KEY = "aos-helper-v1";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let state = load() || {
  view: "setup", armyIdx: 0, formation: -1, units: [], custom: [],
  round: 1, turn: "mine", phase: 0, used: {},
};
state.enh = state.enh || [];
state.summons = state.summons || [];   // manifestations summoned during the battle: {name, n}
state.sumN = state.sumN || 0;
state.units = (state.units || []).filter((u) => u && u.name);
state.filter = "";
if (!ARMIES[state.armyIdx]) state.armyIdx = 0;
const enhKey = (e) => e.group + "|" + e.name;

function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
const army = () => ARMIES[state.armyIdx] || ARMIES[0];

// Collect every ability the player has, tagged with its source.
function allAbilities() {
  const a = army(), out = [];
  const add = (src, list, id, extra) => (list || []).forEach((ab, i) => out.push({ ...ab, ...extra, src, uid: id + ":" + i }));
  add("Army: " + a.name, a.abilities, "army" + state.armyIdx);
  const f = a.formations[state.formation];
  if (f) add("Formation: " + f.name, f.abilities, "form" + state.armyIdx + "_" + state.formation);
  a.enhancements.forEach((e) => { if (state.enh.includes(enhKey(e))) add(e.group.split(" / ").pop() + ": " + e.name, e.abilities, "enh" + state.armyIdx + "_" + enhKey(e), { lore: /Lore/i.test(e.group) && !/Manifestation/i.test(e.group) }); });
  state.units.forEach((u, n) => {
    const def = a.units.find((x) => x.name === u.name);
    if (def) add(u.name + (u.count > 1 ? " x" + u.count : ""), def.abilities, "unit" + state.armyIdx + "_" + u.name);
  });
  state.summons.forEach((s) => {
    const def = (a.manifestations || []).find((x) => x.name === s.name);
    if (def) add("Summoned: " + s.name + " #" + s.n, def.abilities, "sum" + s.n);
  });
  state.custom.forEach((c, i) => out.push({ ...c, src: "Custom", uid: "cust:" + i }));
  return out;
}

// Does this ability show now? turn = whose turn it is.
function relevant(ab, phaseId) {
  if (!ab.phases.includes(phaseId)) return false;
  return turnOk(ab);
}
function turnOk(ab) {
  if (ab.when === "mine" && state.turn !== "mine") return false;
  if (ab.when === "theirs" && state.turn !== "theirs") return false;
  if (ab.rounds && !ab.rounds.includes(state.round)) return false;
  return true;
}

// "used" key encodes the reset scope.
function usedKey(ab) {
  const scope = ab.limit === "battle" ? "" : ab.limit === "round" ? "r" + state.round : "r" + state.round + state.turn;
  return ab.uid + "|" + scope;
}

const sizeOf = (name) => army().units.find((x) => x.name === name)?.size || 1;

function applyTheme() {
  const t = themeOf(army()), root = document.documentElement;
  root.style.setProperty("--gold", t.color);
  root.style.setProperty("--on", t.on);
  const sym = $("#sym"); if (sym) sym.innerHTML = symbolSvg(army(), 22);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", "#14110f");
}

function render() {
  save();
  applyTheme();
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === state.view));
  const m = $("#main");
  m.innerHTML = state.view === "setup" ? setupView() : state.view === "play" ? playView() : customView();
  bind();
}

const CATS = [["HERO", "Heroes"], ["INFANTRY", "Infantry"], ["CAVALRY", "Cavalry"], ["BEAST", "Beasts"], ["MONSTER", "Monsters"], ["WAR MACHINE", "War machines"], ["FACTION TERRAIN", "Faction terrain"]];
function unitGroups(a) {
  const q = state.filter.toLowerCase();
  const avail = a.units.filter((u) => u.name.toLowerCase().includes(q) && !state.units.some((x) => x.name === u.name));
  const known = CATS.map((c) => c[0]);
  const groups = [...CATS, ["OTHER", "Other"]].map(([key, label]) => [label, avail.filter((u) => (known.includes(u.cat) ? u.cat : "OTHER") === key)]).filter(([, l]) => l.length);
  if (!groups.length) return `<p class="muted">No units found.</p>`;
  return groups.map(([label, list]) => `<details ${q || groups.length === 1 ? "open" : ""}><summary>${label} (${list.length})</summary><div class="chips">${list.map((u) =>
    `<div class="unit"><button data-unit="${esc(u.name)}">${esc(u.name)}<small>${esc([u.size > 1 ? u.size + " models" : "", ...(u.tags || []), u.stats].filter(Boolean).join(" · "))}</small></button></div>`).join("")}</div></details>`).join("");
}

function setupView() {
  const a = army();
  return `
  <h2>Army</h2>
  <div class="armies">${ARMIES.map((x, i) => `<button data-army="${i}" class="${i === state.armyIdx ? "sel" : ""}" style="--c:${themeOf(x).color}">${symbolSvg(x, 28)}<span>${esc(x.name)}</span></button>`).join("")}</div>
  <h2>Formation</h2>
  <div class="forms">${a.formations.map((x, i) => `<div class="form ${i === state.formation ? "sel" : ""}" data-form="${i}">
    <div class="name">${esc(x.name)}</div>${x.abilities.map((ab) => `<div class="fab"><b>${esc(ab.name)}</b>${ab.timing ? ` <i>(${esc(ab.timing)})</i>` : ""}<div class="txt">${esc(ab.text)}</div></div>`).join("") || `<div class="txt muted">No ability text.</div>`}</div>`).join("")}</div>
  <h2>Your army${state.units.length ? " (" + state.units.reduce((n, u) => n + u.count, 0) + " units)" : ""}</h2>
  ${state.units.length ? `<div class="chips">${state.units.map((u) => { const sz = sizeOf(u.name); return `<div class="unit sel"><span class="uname">${esc(u.name)}<small>${sz > 1 ? u.count * sz + " models" : u.count > 1 ? "x" + u.count : ""}</small></span>
    <span class="cnt"><button data-dec="${esc(u.name)}">−${sz > 1 ? sz : ""}</button><button data-inc="${esc(u.name)}">+${sz > 1 ? sz : ""}</button><button data-rm="${esc(u.name)}" title="Remove">✕</button></span></div>`; }).join("")}</div>` : `<p class="muted">No units yet. Search below and tap to add.</p>`}
  <h2>Add units</h2>
  <input id="filter" placeholder="Search units" value="${esc(state.filter)}">
  ${unitGroups(a)}
  <h2>Enhancements, lores, traits${state.enh.length ? " (" + state.enh.length + ")" : ""}</h2>
  ${[...new Set(a.enhancements.map((e) => e.group))].map((g) => `<details><summary>${esc(g)}</summary>${a.enhancements.filter((e) => e.group === g).map((e) =>
    `<label class="enh"><input type="checkbox" data-enh="${esc(enhKey(e))}" ${state.enh.includes(enhKey(e)) ? "checked" : ""}> ${esc(e.name)}</label>`).join("")}</details>`).join("")}
  <button class="big" data-go="play">Start battle</button>
  <button class="link" id="reset">Reset game</button>`;
}

function playView() {
  const ph = PHASES[state.phase];
  const abs = allAbilities().filter((ab) => relevant(ab, ph.id));
  const groups = {};
  abs.forEach((ab) => (groups[ab.src] = groups[ab.src] || []).push(ab));
  return `
  <div class="bar">
    <button data-round="-1">‹</button><b>Battle round ${state.round}</b><button data-round="1">›</button>
    <button class="turn ${state.turn}" id="turn">${state.turn === "mine" ? "Your turn" : "Enemy turn"}</button>
  </div>
  <div class="phases">${PHASES.map((p, i) => `<button data-phase="${i}" class="${i === state.phase ? "on" : ""}">${p.name}</button>`).join("")}</div>
  <h2>${ph.name} phase</h2>
  ${abs.length === 0 ? `<p class="muted">Nothing from your army this phase.</p>` : Object.entries(groups).map(([src, list]) => list[0].lore
    ? `<details class="lore"><summary>${esc(src)} · ${list.length} spells (open if you have a wizard)</summary>${list.map(card).join("")}</details>`
    : `<div class="group"><div class="src">${esc(src)}</div>${list.map(card).join("")}</div>`).join("")}
  ${alwaysOn()}
  ${summonPanel()}
  <div class="nextrow">
    <button data-step="-1">‹ Back</button>
    <button class="big" data-step="1">${state.phase === PHASES.length - 1 ? "Next turn ›" : "Next phase ›"}</button>
  </div>`;
}

function summonPanel() {
  const man = army().manifestations || [];
  return `<details class="always"><summary>Summoned manifestations (${state.summons.length})</summary>
    ${state.summons.map((s) => `<div class="unit sel"><span class="uname">${esc(s.name)} #${s.n}</span><button data-unsummon="${s.n}">Banished ✕</button></div>`).join("")}
    ${man.length ? `<div class="src">Summon one</div>` + man.map((m) => `<div class="unit"><button data-summon="${esc(m.name)}">+ ${esc(m.name)}<small>${esc(m.stats)}</small></button></div>`).join("") : `<p class="muted">This army has no manifestations in the data.</p>`}</details>`;
}

function alwaysOn() {
  const list = allAbilities().filter((ab) => !ab.phases.length && turnOk(ab));
  if (!list.length) return "";
  const groups = {};
  list.forEach((ab) => (groups[ab.src] = groups[ab.src] || []).push(ab));
  return `<details class="always"><summary>Always on / no fixed phase (${list.length})</summary>${Object.entries(groups).map(([src, l]) =>
    `<div class="src">${esc(src)}</div>${l.map(card).join("")}`).join("")}</details>`;
}

function card(ab) {
  const k = usedKey(ab), used = !!state.used[k];
  return `<div class="card ${ab.kind || "passive"} ${used ? "used" : ""}">
    <div class="ctop"><span class="tag">${esc(ab.kind || "passive")}${ab.when === "theirs" ? " · enemy turn" : ""}</span>
    ${ab.limit ? `<label><input type="checkbox" data-used="${esc(k)}" ${used ? "checked" : ""}> used (${ab.limit})</label>` : ""}</div>
    <div class="name">${esc(ab.name)}</div><div class="txt">${esc(ab.text)}</div></div>`;
}

function customView() {
  return `
  <h2>Add a custom ability</h2>
  <p class="muted">For anything not in the built-in data: type it in once and it appears in the right phases.</p>
  <form id="cf">
    <input name="name" placeholder="Name" required>
    <textarea name="text" placeholder="Rules text" rows="3"></textarea>
    <div class="label">Phases</div>
    <div class="chk">${PHASES.map((p) => `<label><input type="checkbox" name="ph" value="${p.id}"> ${p.name}</label>`).join("")}</div>
    <select name="when"><option value="mine">Your turn</option><option value="theirs">Enemy turn</option><option value="any">Any turn</option></select>
    <select name="kind"><option>passive</option><option>active</option><option>reaction</option><option>spell</option></select>
    <select name="limit"><option value="">No limit</option><option value="turn">Once per turn</option><option value="round">Once per round</option><option value="battle">Once per battle</option></select>
    <button class="big">Add</button>
  </form>
  <h2>Your custom abilities</h2>
  ${state.custom.length ? state.custom.map((c, i) => `<div class="card"><div class="name">${esc(c.name)}</div><div class="txt">${esc(c.text)}</div>
    <button class="link" data-del="${i}">Delete</button></div>`).join("") : `<p class="muted">None yet.</p>`}`;
}

function bind() {
  const on = (sel, fn) => document.querySelectorAll(sel).forEach(fn);
  const flt = $("#filter"); if (flt) flt.oninput = () => { state.filter = flt.value; const p = flt.selectionStart; render(); const f = $("#filter"); f.focus(); f.setSelectionRange(p, p); };
  on("[data-enh]", (c) => c.onchange = () => { const k = c.dataset.enh, i = state.enh.indexOf(k); if (i >= 0) state.enh.splice(i, 1); else state.enh.push(k); save(); });
  on("[data-army]", (b) => b.onclick = () => { const i = +b.dataset.army; if (i === state.armyIdx) return; state.armyIdx = i; state.formation = -1; state.units = []; state.enh = []; state.summons = []; render(); });
  on("[data-form]", (d) => d.onclick = () => { state.formation = state.formation === +d.dataset.form ? -1 : +d.dataset.form; render(); });
  on("[data-unit]", (b) => b.onclick = () => { state.units.push({ name: b.dataset.unit, count: 1 }); state.filter = ""; render(); });
  on("[data-inc]", (b) => b.onclick = () => { state.units.find((u) => u.name === b.dataset.inc).count++; render(); });
  on("[data-dec]", (b) => b.onclick = () => { const u = state.units.find((u) => u.name === b.dataset.dec); if (--u.count < 1) state.units = state.units.filter((x) => x !== u); render(); });
  on("[data-rm]", (b) => b.onclick = () => { state.units = state.units.filter((u) => u.name !== b.dataset.rm); render(); });
  on("[data-summon]", (b) => b.onclick = () => { state.sumN++; state.summons.push({ name: b.dataset.summon, n: state.sumN }); render(); });
  on("[data-unsummon]", (b) => b.onclick = () => { state.summons = state.summons.filter((s) => s.n !== +b.dataset.unsummon); render(); });
  on("[data-go]", (b) => b.onclick = () => { state.view = "play"; render(); });
  const reset = $("#reset"); if (reset) reset.onclick = () => { state.round = 1; state.turn = "mine"; state.phase = 0; state.used = {}; state.summons = []; render(); };
  on("[data-round]", (b) => b.onclick = () => { state.round = Math.max(1, state.round + +b.dataset.round); render(); });
  const turn = $("#turn"); if (turn) turn.onclick = () => { state.turn = state.turn === "mine" ? "theirs" : "mine"; state.phase = 0; render(); };
  on("[data-phase]", (b) => b.onclick = () => { state.phase = +b.dataset.phase; render(); });
  on("[data-step]", (b) => b.onclick = () => {
    const d = +b.dataset.step;
    state.phase += d;
    if (state.phase >= PHASES.length) { // turn over: swap sides; new round after both have gone
      state.phase = 0;
      if (state.turn === "theirs") state.round++;
      state.turn = state.turn === "mine" ? "theirs" : "mine";
    } else if (state.phase < 0) state.phase = 0;
    render(); scrollTo(0, 0);
  });
  on("[data-used]", (c) => c.onchange = () => { state.used[c.dataset.used] = c.checked; render(); });
  const cf = $("#cf");
  if (cf) cf.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(cf), phases = f.getAll("ph");
    if (!phases.length) return alert("Pick at least one phase");
    state.custom.push({ name: f.get("name"), text: f.get("text"), phases, when: f.get("when"), kind: f.get("kind"), limit: f.get("limit") || undefined });
    render();
  };
  on("[data-del]", (b) => b.onclick = () => { state.custom.splice(+b.dataset.del, 1); render(); });
}

document.querySelectorAll("nav button").forEach((b) => b.onclick = () => { state.view = b.dataset.v; render(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
render();
