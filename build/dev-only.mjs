#!/usr/bin/env node
// dev-only.mjs — the ONE reader of this repo's release strip set (F-469).
//
// The set is declared once, in the bus header (dev/FEEDBACK.md): the `Dev-only:`
// line (written by `dev-utils init --dev-only`) plus the `Canary:` line, because
// `dev-utils release` strips the canary with the declared paths. Every place that
// asks "is this dev-only?" reads it here: build/check-doc-drift.mjs checks 1-4, 17,
// 18 and 24, docs-drift.yml's stripped rehearsal arm and its "No dev-only content"
// step (through the CLI below), and the release cut in dev/RELEASE-CHECKLIST.md §3.
//
// Grammar = dev-utils' (repo.py check_dev_only, as of 0.5.0), so the release tool and
// these checks never disagree on a value: the FIRST `Dev-only:` line above the first
// `## F-` section; repo-relative paths separated by whitespace (Python's str.split
// set), or `none` alone; backslashes read as `/`, empty and `.` segments dropped;
// refused: an absolute path, the repo root, `..`, anything inside `.git`, a repeat.
// Stricter than dev-utils in two places, both toward refusing: a header with no
// `Dev-only:` line is refused (dev-utils reads that as `none`, and a release would
// then ship dev/ — the checks here anchor on the line, the unread-anchor-line
// class), and so is a second `Dev-only:` line (dev-utils takes the first, so the
// second would be read by nobody).
//
// Where the set comes from on a tree the strip already ran on — the bus lives in
// dev/, which the strip removes: the working-tree bus when there is one; else HEAD's
// (docs-drift's rehearsal arm strips the worktree and index and commits nothing);
// else origin/dev's (a release branch, the release PR, main — the answer dev-utils
// release-finish gives too; the CI job fetches dev first). Finding no bus is refused,
// never read as an empty set. Tracked-ness (dev-utils: "a declaration that strips
// nothing is a typo") is checked only when the bus is read from the working tree: a
// stripped tree has nothing to check it against, and the tree that carries the bus
// runs this same check.
//
// CLI: `node build/dev-only.mjs` prints the strip set, one path per line, on stdout
// and names its source on stderr; a refusal prints on stderr and exits 1.
//
// Zero dependencies: Node built-ins only.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, sep } from "node:path";
import { ROOT, isMainModule } from "./lib.mjs";

export const BUS_FILE = "dev/FEEDBACK.md";
/** The git refs a tree without a bus reads it from, in order. */
export const BUS_REFS = ["HEAD", "origin/dev"];

const FIRST_FINDING_RE = /^##[ \t]+F-\S+/;
// Python's str.split() separators (str.isspace), so a value splits exactly as
// dev-utils splits it — JS's \s differs (it takes U+FEFF, and leaves \x1c-\x1f and \x85).
const PY_WS = [[0x09, 0x0d], [0x1c, 0x20], [0x85, 0x85], [0xa0, 0xa0], [0x1680, 0x1680], [0x2000, 0x200a],
  [0x2028, 0x2029], [0x202f, 0x202f], [0x205f, 0x205f], [0x3000, 0x3000]];
/** @param {string} s */
const pySplit = (s) => {
  /** @type {string[]} */
  const words = [];
  let cur = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (PY_WS.some(([a, b]) => c >= a && c <= b)) {
      if (cur) words.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) words.push(cur);
  return words;
};
const ABSOLUTE_RE = /^(?:\/|[A-Za-z]:)/;

/**
 * @typedef {object} DevOnlySet
 * @property {string[]} declared the `Dev-only:` paths, normalized, in line order
 * @property {string} canary what the release removes for the canary (the dev-canary skill dir)
 * @property {string} canaryName the canary skill's directory name
 * @property {string[]} paths the strip set: `declared`, plus `canary` unless a declared path covers it
 * @property {string} source where the bus was read (`dev/FEEDBACK.md`, or `<ref>:dev/FEEDBACK.md`)
 */

/**
 * The `Dev-only:` value grammar (dev-utils' check_dev_only). Returns the
 * normalized paths, `[]` for `none`; throws on a refused value.
 * @param {string} value
 * @param {string} where names the line in a refusal
 * @returns {string[]}
 */
export function parseDevOnlyValue(value, where) {
  const words = pySplit(String(value ?? ""));
  if (!words.length) throw new Error(`\`${where}\` has no value — list the repo-relative paths only dev carries, or \`none\``);
  if (words.length === 1 && words[0].toLowerCase() === "none") return [];
  /** @type {string[]} */
  const out = [];
  for (const raw of words) {
    const path = raw.replace(/\\/g, "/");
    const parts = path.split("/").filter((p) => p !== "" && p !== ".");
    const norm = parts.join("/");
    let why = "";
    if (raw.toLowerCase() === "none") why = "`none` stands alone — it cannot share the line with paths";
    else if (ABSOLUTE_RE.test(path)) why = "is absolute; Dev-only paths are relative to the repo root";
    else if (!parts.length) why = "is the repo root itself";
    else if (parts.includes("..")) why = "climbs out of the repo (`..`)";
    else if (parts.includes(".git")) why = "is inside .git";
    else if (out.includes(norm)) why = "is given twice";
    if (why) throw new Error(`\`${raw}\` on \`${where}\` ${why}`);
    out.push(norm);
  }
  return out;
}

/**
 * Read the strip set out of a bus file's text. Throws on a missing, repeated or
 * refused line.
 * @param {string} text the bus file
 * @param {string} source names the bus in a refusal
 * @returns {DevOnlySet}
 */
export function parseDevOnlySet(text, source) {
  const lines = String(text).split("\n");
  const end = lines.findIndex((l) => FIRST_FINDING_RE.test(l));
  const header = end === -1 ? lines : lines.slice(0, end);
  /** @param {string} key */
  const keyed = (key) =>
    header.flatMap((l, i) => (l.startsWith(key + ":") ? [{ n: i + 1, value: l.slice(key.length + 1).replace(/^[ \t]*/, "") }] : []));
  const devOnly = keyed("Dev-only");
  if (!devOnly.length)
    throw new Error(
      `${source} declares no \`Dev-only:\` line above its first \`## F-\` section — the release strip set is declared ` +
        `there (write it with \`dev-utils init --dev-only "<paths>"\`), and every reader of the set reads that line`,
    );
  if (devOnly.length > 1)
    throw new Error(`${source}:${devOnly[1].n}: a second \`Dev-only:\` line — dev-utils reads the first (line ${devOnly[0].n}), so this one is read by nobody; keep one`);
  const declared = parseDevOnlyValue(devOnly[0].value, `${source}:${devOnly[0].n} Dev-only:`);

  const profile = keyed("Profile")[0]?.value.trim();
  if (profile && profile !== "plugin")
    throw new Error(`${source} declares \`Profile: ${profile}\` — this reader knows the plugin profile's canary (a skill directory) only`);
  const canaryLine = keyed("Canary")[0];
  const canaryFile = pySplit(canaryLine?.value ?? "")[0]?.replace(/\\/g, "/") ?? "";
  const canaryParts = canaryFile.split("/").filter((p) => p !== "" && p !== ".");
  if (canaryParts.length < 2 || ABSOLUTE_RE.test(canaryFile) || canaryParts.includes(".."))
    throw new Error(
      `${source} declares no repo-relative \`Canary:\` path inside a skill directory — the release strips the canary ` +
        `with the Dev-only paths, so the set needs it`,
    );
  // dev-utils' plugin strip (profiles.strip_canary): the canary's skill directory
  // when it is named dev-canary, else the canary file alone.
  const canaryDirParts = canaryParts.slice(0, -1);
  const canaryName = canaryDirParts[canaryDirParts.length - 1] ?? "";
  const canary = canaryName === "dev-canary" ? canaryDirParts.join("/") : canaryParts.join("/");
  const paths = declared.some((p) => covers(p, canary)) ? [...declared] : [...declared, canary];
  return { declared, canary, canaryName, paths, source };
}

/**
 * Does strip path `p` (repo-relative, normalized) cover repo-relative `rel`?
 * @param {string} p
 * @param {string} rel
 */
export const covers = (p, rel) => rel === p || rel.startsWith(p + "/");

/**
 * Is repo-relative `rel` inside the strip set?
 * @param {DevOnlySet} set
 * @param {string} rel
 */
export const isDevOnly = (set, rel) => set.paths.some((p) => covers(p, rel));

/** @param {string} root @param {string[]} args */
const git = (root, args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });

/**
 * The bus text the tree at `root` declares its strip set in: the working tree's,
 * else the first of BUS_REFS that carries one (see the file comment). Throws when
 * none does.
 * @param {string} [root]
 * @returns {{ text: string, source: string }}
 */
export function readBus(root = ROOT) {
  const file = join(root, BUS_FILE);
  if (existsSync(file)) return { text: readFileSync(file, "utf8"), source: BUS_FILE };
  for (const ref of BUS_REFS) {
    const shown = git(root, ["show", `${ref}:${BUS_FILE}`]);
    if (shown.status === 0) return { text: shown.stdout, source: `${ref}:${BUS_FILE}` };
  }
  throw new Error(
    `no bus to read the Dev-only: line from — ${BUS_FILE} is absent from the working tree, and ` +
      `${BUS_REFS.map((r) => `${r}:${BUS_FILE}`).join(" and ")} could not be read. On a tree the release strip ` +
      `already ran on, fetch dev first: git fetch origin dev`,
  );
}

/**
 * The strip set for the tree at `root`, read from wherever its bus is (see the
 * file comment). Throws with the refusal.
 * @param {string} [root]
 * @returns {DevOnlySet}
 */
export function readDevOnlySet(root = ROOT) {
  const { text, source } = readBus(root);
  const set = parseDevOnlySet(text, source);
  if (source === BUS_FILE) {
    for (const rel of set.declared) {
      const ls = git(root, ["--literal-pathspecs", "ls-files", "--", rel]);
      if (ls.status !== 0) throw new Error(`could not list \`${rel}\` from the Dev-only: line with git ls-files: ${String(ls.stderr).trim()}`);
      if (!ls.stdout.trim())
        throw new Error(`\`${rel}\` on ${BUS_FILE}'s Dev-only: line is not tracked here — a declaration that strips nothing is a typo; fix the line`);
      const abs = join(root, rel);
      if (existsSync(abs)) {
        const real = realpathSync(abs);
        const top = realpathSync(root);
        if (real !== top && !real.startsWith(top + sep)) throw new Error(`\`${rel}\` on ${BUS_FILE}'s Dev-only: line resolves outside the repo (${real})`);
      }
    }
  }
  return set;
}

if (isMainModule(import.meta.url)) {
  try {
    const set = readDevOnlySet();
    process.stderr.write(`dev-only set (from ${set.source}): ${set.paths.join(" ")}\n`);
    process.stdout.write(set.paths.map((p) => p + "\n").join(""));
  } catch (e) {
    process.stderr.write(`dev-only: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}
