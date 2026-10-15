// shell-words.mjs — POSIX shell words, as bash reads a line the native-report verbs print (NAT-1): unquoted runs,
// single-quoted runs (no escapes inside), and a backslash-escaped character between them. An UNQUOTED shell
// metacharacter is kept but marked (MARK before it), so a check can refuse one and find the `>` redirection.
// One reader for the suites that judge those lines (test/dashboard-native.mjs, test/dashboard.mjs).
// Not a runner: it lives under test/fixtures/, which the battery enumeration never lists.
export const MARK = String.fromCharCode(0);
const META = "|&;<>()$`\"*?[]#~";
/** @param {string} line @returns {string[]} */
export function shellWords(line) {
  const words = [];
  let w = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === " ") { if (w !== null) words.push(w); w = null; continue; }
    w ??= "";
    if (c === "'") { const end = line.indexOf("'", i + 1); if (end < 0) throw new Error("unterminated quote"); w += line.slice(i + 1, end); i = end; continue; }
    if (c === "\\") { w += line[i + 1]; i++; continue; }
    w += META.includes(c) ? `${MARK}${c}` : c;
  }
  if (w !== null) words.push(w);
  return words;
}
/** The words before the line's unquoted `>`, and the file after it (null when the line redirects nothing). */
export function splitRedirect(line) {
  const words = shellWords(line);
  const at = words.indexOf(`${MARK}>`);
  return at < 0 ? { argv: words, file: null } : { argv: words.slice(0, at), file: words[at + 1] ?? null };
}
