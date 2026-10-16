// Converts BSData age-of-sigmar-4th catalogues into armies.js for the app.
const fs = require("fs"), path = require("path");
const { XMLParser } = require("fast-xml-parser");
const DIR = "C:/bs/data";
const OUT = process.argv[2];
const ARMY_NAMES = ["Slaves to Darkness", "Stormcast Eternals", "Sylvaneth", "Seraphon", "Skaven"];

const arrTags = new Set(["selectionEntry", "selectionEntryGroup", "profile", "characteristic", "attribute", "entryLink", "infoLink"]);
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#t", isArray: (n) => arrTags.has(n), processEntities: true });
const parse = (f) => parser.parse(fs.readFileSync(path.join(DIR, f), "utf8")).catalogue;

const ABILITY = { "Ability (Activated)": "active", "Ability (Passive)": "passive", "Ability (Spell)": "spell", "Ability (Command)": "command", "Ability (Prayer)": "prayer" };
const clean = (s) => String(s ?? "").replace(/\^\^/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const ch = (p, name) => { const c = (p.characteristics?.characteristic || []).find((x) => x["@_name"] === name); return clean(c?.["#t"] ?? c ?? ""); };

const PHASE_WORDS = { hero: "hero", movement: "move", shooting: "shoot", charge: "charge", combat: "combat" };
function infer(text) { // phases from rules text, for passives without timing
  const t = text.toLowerCase(), out = [];
  if (/combat attack|melee|fight|pile in|attacks? characteristic|wound roll|hit roll/.test(t)) out.push("combat");
  if (/shoot|missile|ranged/.test(t)) out.push("shoot");
  if (/charge/.test(t)) out.push("charge");
  if (/\brun\b|retreat|\bmove\b|movement|fly/.test(t)) out.push("move");
  if (/battleshock|end of/.test(t)) out.push("end");
  if (/spell|cast|chant|prayer|unbind|dispel|command point|start of/.test(t)) out.push("hero");
  return [...new Set(out)];
}

function convert(p) {
  const typeName = p["@_typeName"], kind = ABILITY[typeName];
  if (!kind) return null;
  const timing = ch(p, "Timing"), tl = timing.toLowerCase();
  const text = [ch(p, "Declare"), ch(p, "Effect")].filter(Boolean).join(" ");
  const ab = { name: clean(p["@_name"]), text, kind };
  if (kind === "spell" && ch(p, "Casting Value")) ab.text = "Casting value " + ch(p, "Casting Value") + ". " + text;
  if (kind === "prayer" && ch(p, "Chanting Value")) ab.text = "Chanting value " + ch(p, "Chanting Value") + ". " + text;
  if (/once per battle round/.test(tl)) ab.limit = "round";
  else if (/once per battle\b/.test(tl)) ab.limit = "battle";
  else if (/once per turn/.test(tl)) ab.limit = "turn";
  const phases = new Set(); let mine = false, theirs = false;
  for (const m of tl.matchAll(/\b(your|enemy|any)\s+(hero|movement|shooting|charge|combat)\s+phase/g)) {
    phases.add(PHASE_WORDS[m[2]]); if (m[1] === "your") mine = true; else if (m[1] === "enemy") theirs = true; else { mine = theirs = true; }
  }
  for (const m of tl.matchAll(/end of (your|enemy|any|the)? ?turn/g)) { phases.add("end"); if (m[1] === "your") mine = true; else if (m[1] === "enemy") theirs = true; else mine = theirs = true; }
  if (/start of (the )?(battle round|your turn|any turn)/.test(tl)) { phases.add("start"); mine = theirs = true; }
  if (/reaction/.test(tl)) { ab.kind = "reaction"; if (!phases.size) infer(timing + " " + text).forEach((x) => phases.add(x)); mine = theirs = true; }
  if (!phases.size) { // passives etc: guess from text; empty means "always on"
    infer(text).forEach((x) => phases.add(x));
    if (!phases.size && /^(your|enemy)/.test(tl)) { /* turn-only timing, keep always */ }
    mine = theirs = true;
    if (/your turn/.test(tl)) theirs = false;
  }
  ab.phases = [...phases];
  ab.when = mine && theirs ? "any" : mine ? "mine" : theirs ? "theirs" : "any";
  if (timing) ab.timing = timing;
  return ab;
}

// Gather abilities under an entry (not into nested selectionEntries of type unit), resolving infoLinks via map.
function collect(node, profMap, out = [], depth = 0) {
  for (const p of node.profiles?.profile || []) { const a = convert(p); if (a) out.push(a); }
  for (const l of node.infoLinks?.infoLink || []) { if (l["@_type"] === "profile" && profMap[l["@_targetId"]]) { const a = convert(profMap[l["@_targetId"]]); if (a) out.push(a); } }
  for (const e of node.selectionEntries?.selectionEntry || []) if (e["@_type"] !== "unit") collect(e, profMap, out, depth + 1);
  for (const g of node.selectionEntryGroups?.selectionEntryGroup || []) collect(g, profMap, out, depth + 1);
  return out;
}
function dedupe(list) { const seen = new Set(); return list.filter((a) => { const k = a.name + "|" + a.text; if (seen.has(k)) return false; seen.add(k); return true; }); }

function allProfiles(node, map) {
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    for (const p of n.profiles?.profile || []) map[p["@_id"]] = p;
    for (const k of Object.keys(n)) if (!k.startsWith("@_") && k !== "profiles") walk(n[k]);
  };
  walk(node);
}

const armies = [];
const stats = {};
for (const name of ARMY_NAMES) {
  const files = [name + ".cat", name + " - Library.cat"].filter((f) => fs.existsSync(path.join(DIR, f)));
  const cats = files.map(parse);
  const profMap = {};
  cats.forEach((c) => allProfiles(c, profMap));
  // include the game system's shared profiles too
  const army = { name, abilities: [], formations: [], enhancements: [], units: [] };
  for (const c of cats) {
    // units
    const walkUnits = (node) => {
      for (const e of node.selectionEntries?.selectionEntry || []) {
        if (e["@_type"] === "unit") {
          const unitProf = (e.profiles?.profile || []).find((p) => p["@_typeName"] === "Unit");
          const abilities = dedupe(collect(e, profMap));
          const stat = unitProf ? `Move ${ch(unitProf, "Move")} · Health ${ch(unitProf, "Health")} · Save ${ch(unitProf, "Save")} · Control ${ch(unitProf, "Control")}` : "";
          if (!army.units.find((u) => u.name === clean(e["@_name"])))
            army.units.push({ name: clean(e["@_name"]), stats: stat, abilities });
        }
        walkUnits(e);
      }
      for (const g of node.selectionEntryGroups?.selectionEntryGroup || []) walkUnits(g);
    };
    walkUnits({ selectionEntries: c.sharedSelectionEntries, selectionEntryGroups: c.sharedSelectionEntryGroups });
    walkUnits({ selectionEntries: c.selectionEntries, selectionEntryGroups: c.selectionEntryGroups });
    // army-level: battle traits, formations, enhancements
    for (const e of c.sharedSelectionEntries?.selectionEntry || []) {
      if (/^Battle Traits/i.test(e["@_name"])) army.abilities.push(...dedupe(collect(e, profMap)));
    }
    const walkGroups = (groups, parent) => {
      for (const g of groups || []) {
        const gname = clean(g["@_name"]);
        if (/Battle Formations/i.test(gname) || /Battle Formations/i.test(parent || "")) {
          for (const e of g.selectionEntries?.selectionEntry || []) army.formations.push({ name: clean(e["@_name"]), abilities: dedupe(collect(e, profMap)) });
          walkGroups(g.selectionEntryGroups?.selectionEntryGroup, gname);
        } else if (/Battle Wounds|Paths$|^Scars/i.test(gname)) {
        } else {
          for (const e of g.selectionEntries?.selectionEntry || []) {
            const abs = dedupe(collect(e, profMap));
            if (abs.length) army.enhancements.push({ group: parent && parent !== gname ? parent + " / " + gname : gname, name: clean(e["@_name"]), abilities: abs });
          }
          walkGroups(g.selectionEntryGroups?.selectionEntryGroup, gname);
        }
      }
    };
    walkGroups(c.sharedSelectionEntryGroups?.selectionEntryGroup, "");
  }
  army.units.sort((a, b) => a.name.localeCompare(b.name));
  army.formations = army.formations.filter((f, i, a) => a.findIndex((x) => x.name === f.name) === i);
  army.enhancements = army.enhancements.filter((f, i, a) => a.findIndex((x) => x.name === f.name && x.group === f.group) === i);
  armies.push(army);
  const all = [...army.abilities, ...army.formations.flatMap((f) => f.abilities), ...army.enhancements.flatMap((f) => f.abilities), ...army.units.flatMap((u) => u.abilities)];
  stats[name] = { units: army.units.length, unitsWithAbilities: army.units.filter((u) => u.abilities.length).length, formations: army.formations.length, enhancements: army.enhancements.length, armyAbilities: army.abilities.length, abilities: all.length, noPhase: all.filter((a) => !a.phases.length).length };
}
const strip = (a) => JSON.stringify(a);
fs.writeFileSync(OUT, "// GENERATED from BSData age-of-sigmar-4th by convert.js. Do not edit by hand.\nconst ARMIES = " + JSON.stringify(armies) + ";\n");
console.table(stats);
