// ─────────────────────────────────────────────────────────────────────────────
// trace-engine.mjs — the recording Proxy + the single-deletion closure that
// MEASURE which keys a reader dereferences (CLI-adoption arm, D2, 2026-09-04).
//
// Why measure instead of declare: the fortress watch's item 11 held a hand
// table of reader → payload keys, derived twice by grep, and twice shallow
// (F-011 → F-012 rounds 1 and 2: a grep over local variable names cannot see
// loop variables or helpers). Execution can: wrap the fixture in a Proxy,
// run the reader, and every property read — through any helper, under any
// variable name — lands in the record by construction. That is rung 0 of the
// review-gate ladder for this class: the declaration IS the observation.
//
// What the record is NOT: complete. Coverage is the fixture corpus plus the
// probes below; a branch no fixture and no probe reaches is unobserved, and
// data/reader-shapes.json says so in its `residuals`. Nothing here claims the
// deletion test's "still holds with the sentence removed" — the emitted file
// is a measurement, re-taken on every build.
//
// Path grammar (what data/reader-shapes.json `keys` are spelled in):
//   a.b.c        object keys, dot-joined, from the payload root
//   a.items[]    an array element (index collapsed — every element is one path)
//   a.cfg{}      the object PARSED from the string at a.cfg (embedded JSON —
//                the readers JSON.parse stepJson / config / emailActionJson)
//   a.*          the reader enumerated a.'s keys (Object.keys / entries /
//                spread / JSON.stringify): a WALK, every key under a. is read
//   []           the payload root is itself an array (sc measures, list pages)
//
// Probes, per (reader, fixture):
//   populated  the fixture as the suites use it;
//   deletion   every recorded path that exists in the fixture is deleted in
//              turn and the reader re-run — a `a ?? b ?? c` chain, a
//              wrapped-or-bare envelope test, a `filters.conditions ??
//              conditions` tolerance all reveal their alternates only when the
//              preferred key is ABSENT (a populated fixture never reads `b`).
//              Deletions compound along a lineage (delete a, then b) up to
//              maxDepth so a three-way chain is fully walked;
//   bare       `{}` (and `[]`) — the "no envelope at all" arm.
// Every run is deterministic (sorted paths, fixed budgets), so the emitted
// file is byte-stable and rebuild-and-diff can guard it.
//
// Two consumers, one engine: test/trace-reader-shapes.mjs (in-process, for
// exported readers) and test/fixtures/trace-preload.mjs (a `node --import`
// preload that traces a whole script — relationships-build.mjs exports
// nothing and runs on import, so it is driven as a child process with the
// SAME JSON.parse hook installed before its first line executes).
// No imports, by design: the preload loads this file into an arbitrary
// script's process, and a local import would be a dependency that script
// never declared.
// ─────────────────────────────────────────────────────────────────────────────

/** Object.prototype members a reader may touch that are never payload keys. */
const SKIP = new Set([
  "constructor", "toString", "valueOf", "hasOwnProperty", "toJSON", "__proto__", "then",
  "toLocaleString", "isPrototypeOf", "propertyIsEnumerable",
]);

const isObj = (v) => v !== null && typeof v === "object";

/**
 * @typedef {{
 *   wrap: (value: *, path: string, label: string) => *,
 *   run: <T>(label: string, fn: () => T) => T,
 *   take: (label: string) => string[],
 *   peek: (label: string) => string[],
 *   embeddedPaths: (label: string) => string[],
 *   installParseHook: (opts?: {labelOf?: (s: string) => (string|null)}) => void,
 *   uninstallParseHook: () => void,
 *   labels: () => string[],
 * }} Recorder
 */

/** @returns {Recorder} */
export function createRecorder() {
  /** @type {Map<string, Set<string>>} */
  const paths = new Map();
  /** label → the paths whose STRING value was later JSON.parsed (embedded JSON roots) */
  /** @type {Map<string, Set<string>>} */
  const embedded = new Map();
  /** string value handed out by a get → where it came from (last writer wins) */
  /** @type {Map<string, {path: string, label: string}>} */
  const strings = new Map();
  /** @type {WeakMap<object, Map<string, object>>} */
  const cache = new WeakMap();
  /** @type {string|null} */
  let current = null;
  const origParse = JSON.parse;
  let hooked = false;

  const note = (label, p) => {
    if (!paths.has(label)) paths.set(label, new Set());
    paths.get(label).add(p);
  };
  const noteEmbedded = (label, p) => {
    if (!embedded.has(label)) embedded.set(label, new Set());
    embedded.get(label).add(p);
  };

  function wrap(v, path, label) {
    if (!isObj(v)) return v;
    let perTarget = cache.get(v);
    if (!perTarget) {
      perTarget = new Map();
      cache.set(v, perTarget);
    }
    const key = `${label}\u0000${path}`;
    const hit = perTarget.get(key);
    if (hit) return hit;
    const isArr = Array.isArray(v);
    const childPath = (k) => (path ? `${path}.${k}` : String(k));
    const proxy = new Proxy(v, {
      get(t, k, r) {
        if (typeof k === "symbol") return Reflect.get(t, k, r);
        if (isArr) {
          if (!/^\d+$/.test(k)) return Reflect.get(t, k, r); // length, map, forEach, …
          return wrap(Reflect.get(t, k, r), `${path}[]`, label);
        }
        if (SKIP.has(k)) return Reflect.get(t, k, r);
        const cp = childPath(k);
        note(label, cp);
        const val = Reflect.get(t, k, r);
        if (typeof val === "string") {
          strings.set(val, { path: cp, label });
          const trimmed = val.trim();
          if (trimmed !== val) strings.set(trimmed, { path: cp, label });
        }
        return wrap(val, cp, label);
      },
      has(t, k) {
        if (typeof k !== "symbol" && !isArr && !SKIP.has(k)) note(label, childPath(k));
        return Reflect.has(t, k);
      },
      ownKeys(t) {
        if (!isArr) note(label, path ? `${path}.*` : "*");
        return Reflect.ownKeys(t);
      },
      getOwnPropertyDescriptor(t, k) {
        if (typeof k !== "symbol" && !isArr && !SKIP.has(k)) note(label, childPath(k));
        return Reflect.getOwnPropertyDescriptor(t, k);
      },
    });
    perTarget.set(key, proxy);
    return proxy;
  }

  /** Root label for a parsed string: an explicit labeller first, then the
   *  string's own provenance (an embedded JSON value handed out by a get),
   *  then the run's current label with the payload root.
   *  @param {{labelOf?: (s: string) => (string|null)}} [opts] */
  function installParseHook({ labelOf = (/** @type {string} */ _s) => null } = {}) {
    if (hooked) return;
    hooked = true;
    JSON.parse = function tracedParse(text, reviver) {
      const v = origParse.call(JSON, text, reviver);
      if (!isObj(v)) return v;
      const s = typeof text === "string" ? text : String(text);
      const explicit = labelOf(s) ?? labelOf(s.trim());
      if (explicit) return wrap(v, "", explicit);
      const emb = strings.get(s) ?? strings.get(s.trim());
      if (emb) {
        noteEmbedded(emb.label, emb.path);
        return wrap(v, `${emb.path}{}`, emb.label);
      }
      if (current !== null) return wrap(v, "", current);
      return v;
    };
  }
  function uninstallParseHook() {
    if (!hooked) return;
    hooked = false;
    JSON.parse = origParse;
  }

  function run(label, fn) {
    const prev = current;
    current = label;
    try {
      return fn();
    } finally {
      current = prev;
    }
  }
  const sorted = (set) => [...(set ?? [])].sort();
  function take(label) {
    const out = sorted(paths.get(label));
    paths.delete(label);
    return out;
  }
  const peek = (label) => sorted(paths.get(label));
  const embeddedPaths = (label) => sorted(embedded.get(label));
  const labels = () => [...new Set([...paths.keys(), ...embedded.keys()])].sort();

  return { wrap, run, take, peek, embeddedPaths, installParseHook, uninstallParseHook, labels };
}

// ── Path grammar ─────────────────────────────────────────────────────────────

/** @typedef {{name: string, ops: string[]}} PathToken */

/**
 * "data.items[].cfg{}.x" → [{name:"data",ops:[]},{name:"items",ops:["[]"]},{name:"cfg",ops:["{}"]},{name:"x",ops:[]}]
 * A leading "[]" (root array) parses as {name:"", ops:["[]"]}.
 * @param {string} path
 * @returns {PathToken[]}
 */
export function parsePath(path) {
  if (path === "") return [];
  return path.split(".").map((seg) => {
    const m = /^([^[{]*)((?:\[\]|\{\})*)$/.exec(seg);
    if (!m) throw new Error(`malformed path segment ${JSON.stringify(seg)} in ${JSON.stringify(path)}`);
    const ops = m[2] ? m[2].match(/\[\]|\{\}/g) ?? [] : [];
    return { name: m[1], ops };
  });
}

// ── Expanded fixtures: embedded JSON strings parsed in place so a deletion
// can reach inside them; collapse re-stringifies before each run.
const EMB = "\u0000emb"; // the marker key of an expanded embedded-JSON node

/**
 * Deep-copy `value`, parsing every string whose path is in `embeddedPaths`
 * into an {[EMB]: parsed} node (recursively — an embedded document may embed
 * another, e.g. stepJson{}[].emailActionJson).
 * @param {*} value  @param {Set<string>} embeddedPaths  @param {string} [path]
 */
export function expandFixture(value, embeddedPaths, path = "") {
  if (Array.isArray(value)) return value.map((v) => expandFixture(v, embeddedPaths, `${path}[]`));
  if (isObj(value)) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = expandFixture(value[k], embeddedPaths, path ? `${path}.${k}` : k);
    return out;
  }
  if (typeof value === "string" && embeddedPaths.has(path)) {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      return value;
    }
    if (!isObj(parsed)) return value;
    return { [EMB]: expandFixture(parsed, embeddedPaths, `${path}{}`) };
  }
  return value;
}

/** The inverse of expandFixture: {[EMB]: x} nodes become JSON strings again. */
export function collapseFixture(value) {
  if (Array.isArray(value)) return value.map(collapseFixture);
  if (isObj(value)) {
    if (Object.hasOwn(value, EMB)) return JSON.stringify(collapseFixture(value[EMB]));
    const out = {};
    for (const k of Object.keys(value)) out[k] = collapseFixture(value[k]);
    return out;
  }
  return value;
}

/**
 * Resolve a path against an EXPANDED tree to the (holder, key) pairs its
 * final named segment addresses. Paths whose last token ends in an op
 * ("items[]", "a.*", "cfg{}") name no deletable key and resolve to [].
 * @param {*} node  @param {PathToken[]} tokens  @param {number} [i]
 * @returns {Array<{holder: object, key: string}>}
 */
function resolveHolders(node, tokens, i = 0) {
  if (i >= tokens.length) return [];
  const { name, ops } = tokens[i];
  if (name === "*") return [];
  const last = i === tokens.length - 1;
  /** @type {Array<{holder: ?object, key: ?string, value: *}>} */
  let bases;
  if (name === "") bases = [{ holder: null, key: null, value: node }];
  else if (isObj(node) && !Array.isArray(node) && Object.hasOwn(node, name)) bases = [{ holder: node, key: name, value: node[name] }];
  else bases = [];
  if (last && ops.length === 0) return bases.filter((b) => b.holder !== null).map((b) => ({ holder: /** @type {object} */ (b.holder), key: /** @type {string} */ (b.key) }));
  let values = bases.map((b) => b.value);
  for (const op of ops) {
    const next = [];
    for (const v of values) {
      if (op === "[]" && Array.isArray(v)) next.push(...v);
      else if (op === "{}" && isObj(v) && Object.hasOwn(v, EMB)) next.push(v[EMB]);
    }
    values = next;
  }
  if (last) return [];
  return values.flatMap((v) => resolveHolders(v, tokens, i + 1));
}

/** @param {*} tree  @param {string} path */
export function existsAt(tree, path) {
  return resolveHolders(tree, parsePath(path)).length > 0;
}
/** Delete every instance of `path` in the expanded tree (in place). Returns how many. */
export function deleteAt(tree, path) {
  const holders = resolveHolders(tree, parsePath(path));
  for (const { holder, key } of holders) delete holder[key];
  return holders.length;
}
export const deepClone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ── The closure ──────────────────────────────────────────────────────────────

/**
 * Run `execute(fixture)` on the fixture, then on every single-deletion
 * variant a recorded path admits, compounding along lineages that revealed
 * new paths, then on the bare probes. `execute` must run the reader under
 * `recorder.run(label, …)` (or the parse hook must be installed with the
 * label current) so the reads land on `label`; it may throw — a reader that
 * refuses a sparse payload has still read what it read before refusing.
 *
 * @param {Recorder} recorder
 * @param {string} label
 * @param {*} fixture                        the raw fixture (strings still strings)
 * @param {(fixture: *) => void} execute     runs the reader over ONE fixture
 * @param {{maxDepth?: number, maxRuns?: number, bare?: Array<*>}} [opts]
 * @returns {{keys: string[], concrete: string[], alternates: Record<string, string[]>, probed: string[], embedded: string[], runs: number}}
 */
export function closure(recorder, label, fixture, execute, { maxDepth = 3, maxRuns = 400, bare = [{}, []] } = {}) {
  let runs = 0;
  const union = new Set();
  const embeddedAll = new Set();
  /** paths recorded in a run where they were ABSENT from the fixture — an explicit
   *  dereference (`p.k`, `"k" in p`, Object.hasOwn), never an enumeration result */
  const concrete = new Set();
  /** deleting path p revealed paths its OWN baseline run did not record — p's fallbacks.
   *  Credited against the baseline of the lineage state the deletion was made in, never a
   *  global union (F-390 round 2, mechanism ii: a parent deleted first would otherwise take
   *  the credit its child needed — `filters` claiming `conditions` while `filters.conditions`
   *  read as a hard break). */
  /** @type {Record<string, string[]>} */
  const alternates = {};
  /** every path deleted at least once — a key never here has NO alternates MEASUREMENT (F-390 round 2, mechanism iii) */
  const probed = new Set();
  const embSet = () => new Set(embeddedAll);
  const observe = (fx) => {
    runs++;
    recorder.take(label); // drop anything stale before the run
    try {
      recorder.run(label, () => execute(fx));
    } catch {
      /* a refusal is a read too — keep what was recorded before the throw */
    }
    const got = recorder.take(label);
    for (const p of recorder.embeddedPaths(label)) embeddedAll.add(p);
    const tree = expandFixture(fx, embSet());
    for (const p of got) if (!isWalkOrOp(p) && !existsAt(tree, p)) concrete.add(p);
    return got;
  };
  // populated
  const base = observe(fixture);
  for (const p of base) union.add(p);
  // deletion lineages (BFS; a child state is spawned only when its deletion revealed a new path)
  /** @type {Array<{tree: *, depth: number, probed: Set<string>, observed: Set<string>}>} */
  const frontier = [{ tree: expandFixture(fixture, embSet()), depth: 0, probed: new Set(), observed: new Set(base) }];
  const seenVariants = new Set();
  while (frontier.length && runs < maxRuns) {
    const state = /** @type {{tree: *, depth: number, probed: Set<string>, observed: Set<string>}} */ (frontier.shift());
    const candidates = [...union].sort().filter((p) => !state.probed.has(p) && existsAt(state.tree, p));
    for (const p of candidates) {
      if (runs >= maxRuns) break;
      state.probed.add(p);
      probed.add(p);
      const variant = deepClone(state.tree);
      deleteAt(variant, p);
      const sig = JSON.stringify(variant);
      if (seenVariants.has(sig)) continue;
      seenVariants.add(sig);
      // One collapse per variant (Gate 2 for 0.36.2 — it used to be walked
      // twice on the revealing branch). The lineage below re-expands it, and
      // expandFixture deep-copies, so the reader run's object never becomes
      // the next state's tree even if a reader mutated its payload.
      const collapsed = collapseFixture(variant);
      const got = observe(collapsed);
      for (const q of got) union.add(q);
      // p's fallbacks: what this run read that the STATE's own baseline did not
      const revealed = got.filter((q) => !state.observed.has(q) && !isWalkOrOp(q) && q !== p);
      if (revealed.length) alternates[p] = [...new Set([...(alternates[p] ?? []), ...revealed])].sort();
      if (revealed.length && state.depth + 1 < maxDepth) {
        // a lineage: the next deletions are measured against THIS run's reads (re-expanded — new embedded roots may have appeared)
        frontier.push({ tree: expandFixture(collapsed, embSet()), depth: state.depth + 1, probed: new Set(state.probed), observed: new Set(got) });
      }
    }
  }
  // bare probes — the "no envelope" arms
  for (const b of bare) {
    if (runs >= maxRuns) break;
    for (const q of observe(deepClone(b))) union.add(q);
  }
  return { keys: [...union].sort(), concrete: [...concrete].sort(), alternates, probed: [...probed].sort(), embedded: [...embeddedAll].sort(), runs };
}

/**
 * Substitute caller-supplied names for their symbolic placeholders (F-390 round 2: a
 * `--items-path` argument the TRACER passed became a payload key — `data.liteObjects` — because
 * a computed-key dereference is indistinguishable from a literal one to the Proxy). Two rules:
 * `prefix` replaces a path that IS the prefix or continues below it; `segment` replaces every
 * token named exactly so. Placeholders are spelled `<name>` (pathGrammar).
 * @param {string} path  @param {Array<{prefix?: string, segment?: string, as: string}>} symbols
 */
export function applySymbols(path, symbols) {
  let out = path;
  for (const s of symbols) {
    if (s.prefix !== undefined) {
      if (out === s.prefix) out = s.as;
      else if (out.startsWith(`${s.prefix}.`) || out.startsWith(`${s.prefix}[`) || out.startsWith(`${s.prefix}{`)) out = s.as + out.slice(s.prefix.length);
    }
    if (s.segment !== undefined) {
      out = parsePath(out).map(({ name, ops }) => (name === s.segment ? s.as : name) + ops.join("")).join(".");
    }
  }
  return out;
}

/** A walk marker (`a.*`, `*`) or an op-terminated path (`a[]`, `a{}`) names no key of its own. */
export const isWalkOrOp = (p) => p === "*" || p.endsWith(".*") || p.endsWith("[]") || p.endsWith("{}");

/**
 * Collapse walk-derived segments. A key reached only through an enumeration
 * (Object.keys / entries / spread / JSON.stringify — the parent carries a `.*`
 * walk marker) and never dereferenced explicitly (not in `concrete`) is a
 * FIXTURE accident, not a contract: `data.dependents.RULE[].entityId` becomes
 * `data.dependents.*[].entityId`, and the fixture keys the walk touched are
 * reported beside the walk under `enumerated` so a reader sees them without
 * mistaking them for keys the code names.
 * @param {string[]} keys  @param {Iterable<string>} concrete
 * @returns {{keys: string[], enumerated: Record<string, string[]>, collapser: ReturnType<typeof makeCollapser>}}
 */
export function collapseWalks(keys, concrete) {
  const c = makeCollapser(keys, concrete);
  const out = new Set(keys.map(c.collapse));
  // The collapser rides along so the one caller that needs it for further
  // paths (the tracer's finalize) folds through THIS function rather than
  // re-spelling the fold — one home, exercised by the engine self-checks
  // (Gate 2 for 0.36.2: the fold used to exist twice, and the self-checks
  // pinned the copy the emission never ran).
  return { keys: [...out].sort(), enumerated: c.enumerated(), collapser: c };
}

/**
 * The collapse as a reusable function: ONE rule for keys, alternates (both sides), probed
 * paths and embedded roots, so every field of a row is spelled the same way and joins by
 * string equality (F-390 round 2, mechanism i: keys were collapsed and alternates were not,
 * so 11 pairs dangled and fixture names crept back into the contract through the neighbour).
 * @param {string[]} keys  the RAW recorded paths (walk markers included)  @param {Iterable<string>} concrete
 */
export function makeCollapser(keys, concrete) {
  const isConcrete = new Set(concrete);
  const walks = new Set(keys.filter((k) => k === "*" || k.endsWith(".*")));
  /** @type {Record<string, Set<string>>} */
  const enumerated = {};
  const collapse = (k) => {
    const tokens = parsePath(k);
    let origPrefix = "";
    let newPrefix = "";
    for (const { name, ops } of tokens) {
      const walkOfParent = origPrefix === "" ? "*" : `${origPrefix}.*`;
      const origThis = origPrefix === "" ? name : `${origPrefix}.${name}`;
      let newName = name;
      if (name !== "*" && name !== "" && walks.has(walkOfParent) && !isConcrete.has(origThis)) {
        newName = "*";
        // keyed by the COLLAPSED walk path, so a consumer joins it against `keys`
        (enumerated[newPrefix === "" ? "*" : `${newPrefix}.*`] ??= new Set()).add(name);
      }
      const seg = newName + ops.join("");
      newPrefix = newPrefix === "" ? seg : `${newPrefix}.${seg}`;
      origPrefix = origThis + ops.join("");
    }
    return newPrefix;
  };
  return {
    collapse,
    enumerated: () => Object.fromEntries(Object.keys(enumerated).sort().map((w) => [w, [...enumerated[w]].sort()])),
  };
}

/**
 * Is a floor path — spelled naturally, `data.totalPages` — satisfied by a
 * collapsed row? A segment the reader reached only by enumeration collapses
 * to `*` in `keys` and appears by name under `enumerated`; the floor may name
 * it either way. Every mix of spellings is tried; one hit satisfies.
 * @param {string} floor  @param {string[]} keys  @param {Record<string, string[]>} enumerated
 */
export function floorSatisfied(floor, keys, enumerated) {
  const have = new Set(keys);
  if (have.has(floor)) return true;
  const tokens = parsePath(floor);
  /** @type {string[]} */
  let prefixes = [""];
  for (const { name, ops } of tokens) {
    const next = [];
    for (const pre of prefixes) {
      const walk = pre === "" ? "*" : `${pre}.*`;
      const spellings = name !== "*" && name !== "" && (enumerated[walk] ?? []).includes(name) ? [name, "*"] : [name];
      for (const s of spellings) {
        const seg = s + ops.join("");
        next.push(pre === "" ? seg : `${pre}.${seg}`);
      }
    }
    prefixes = next;
  }
  return prefixes.some((p) => have.has(p));
}
