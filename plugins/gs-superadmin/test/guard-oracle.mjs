// Shell-as-oracle differential for the mutation guard (F-436, third pass).
//
// Every earlier fix of the guard's tokenizer was judged against a list the
// fixer wrote — and the next tester probe was always one spelling past the
// list: a heredoc word taken as a boundary (F-431), `|` split out of `>|`,
// `{` split out of `{varname}>`. This suite removes the list. It GENERATES
// command lines from the shell's own grammar (the manuals' redirection
// vocabulary × every fd prefix × glued/spaced × leading / interior / trailing /
// before a flag / glued to the binary name / glued to the word before, plus
// nestings, chains, keywords, quoting, comments, prefix commands and the
// names the shell computes), runs each through REAL bash with a `gs-admin`
// shim that records its argv, and holds the guard to these invariants:
//
//     executed ⇒ guarded — if the shell handed the shim the mutating
//       subcommand words, the guard must have asked (or denied — a coaching
//       deny never runs it);
//     status not the call's ⇒ the row is qualified (F-428, F-438);
//     one simple command ⇒ its row is BARE (`mustBeBare`) — the line's status
//       IS the call's there, so a qualifier is a false claim (F-442: `save&>f`
//       was journaled "backgrounded");
//     a row the generator KNOWS executes is judged executed (`mustExecute`),
//       and where it knows the exact argv the shim's recording is judged on
//       that VALUE (`mustArgv`) — the judge's own reading (the shims,
//       executed(), VALUE_FLAGS) cannot silently stop judging, nor misread
//       (F-446: executed() reads three words at the front, so a shim that
//       dropped the last argument stayed "executed"); a row whose only right
//       decision is the ask fails on a coaching deny (`mustAsk` — F-443: a
//       false deny counts as "guarded" to the first invariant and hid a wrong
//       reading).
//
// A line the shell executes and the guard passes in silence is a BYPASS and
// reds this suite, unless the spelling is a documented residual in
// hooks/guard-residuals.json (the accepted, measured set). The other
// direction — the guard asking on a line the shell would not execute — is an
// over-ask and is reported, never failed (tenet 3: recognizing more spellings
// only ever adds asks). PowerShell runs the same way through powershell.exe
// when it is on the machine (Windows legs); the count of skipped legs is
// printed so coverage is never overstated. The proof that this judge can
// fail is its run against an older hook (GUARD_ORACLE_HOOK): the Step 0
// review of 0.37.0 found the pre-scan gate (F-440) and the computed-name
// bypasses (F-441) by adding the positions the first draft never generated;
// the proof that the judge's OWN reading can fail is the .cmd shim with its
// load-bearing space removed, which reds the mustArgv rows (F-446).
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync, chmodSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
// GUARD_ORACLE_HOOK points the harness at another hook (a checkout of an older
// tree) — the harness's own proof: an older hook must go RED here.
const HOOK = process.env.GUARD_ORACLE_HOOK ?? join(HERE, "..", "hooks", "gs-admin-guard.mjs");
const RESIDUALS = JSON.parse(readFileSync(join(HERE, "..", "hooks", "guard-residuals.json"), "utf8")).residuals.map((r) => r.id);
const ROOT = mkdtempSync(join(tmpdir(), "guard-oracle-"));
let failures = 0, passed = 0;
const check = (label, ok, detail) => {
  if (ok) { passed++; console.log(`PASS  ${label}`); }
  else { failures++; console.log(`FAIL  ${label}\n      ${String(detail).slice(0, 600)}`); }
};

// ── the shims ────────────────────────────────────────────────────────────────
const BIN = join(ROOT, "bin");
mkdirSync(BIN, { recursive: true });
const LOG = join(ROOT, "argv.log");
// bash: a POSIX script named exactly `gs-admin`, one argv element per line.
// The shim exits 7: whether the LINE's status is 7 afterwards tells whether
// the shell reported this call's own status (the second invariant below).
const SHIM_EXIT = 7;
writeFileSync(join(BIN, "gs-admin"), `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a" >> "$GS_ORACLE_LOG"; done\nprintf '%s\\n' "--end--" >> "$GS_ORACLE_LOG"\nexit ${SHIM_EXIT}\n`);
try { chmodSync(join(BIN, "gs-admin"), 0o755); } catch { /* windows */ }
// PowerShell: a .cmd shim; %* is the raw argument text, one call per line. The
// space before `>>` is load-bearing (F-446): cmd reads a digit immediately
// before `>>` as a file descriptor, so `echo jo p save 1>>log` wrote `jo p save`
// to the log — the trailing `1` is silently DROPPED from the recorded argv,
// and the three mutating words still lead it, so executed() still says
// "executed" (the reopen: no boolean can see that). The mustArgv rows assert
// the recorded argv WHOLE, and this shim without its space reds them. The
// trailing space is trimmed when the log is read.
writeFileSync(join(BIN, "gs-admin.cmd"), `@echo off\r\necho %* >>"%GS_ORACLE_LOG%"\r\necho --end-- >>"%GS_ORACLE_LOG%"\r\nexit /b ${SHIM_EXIT}\r\n`);

const WS = join(ROOT, "ws");
mkdirSync(join(WS, ".gs-superadmin"), { recursive: true });
mkdirSync(join(WS, "acme-prod"), { recursive: true });
writeFileSync(join(WS, "acme-prod", "_manifest.json"), JSON.stringify({ slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" }));
// Input files the `<`-family redirections read, so those lines EXECUTE and are
// judged rather than failing on a missing file and hiding whether they are guarded.
for (const f of ["f", "g", "in.txt"]) writeFileSync(join(WS, f), "x\n");
// A script file carrying the mutation — the stdin-payload residual's rows.
writeFileSync(join(WS, "s.sh"), "gs-admin jo p save\n");

const bashExe = spawnSync("bash", ["-c", "echo ok"], { encoding: "utf8" }).stdout?.trim() === "ok" ? "bash" : null;
if (!bashExe) { console.error("guard-oracle: bash is required (every CI leg runs steps under bash)"); process.exit(2); }
// The bash major version decides which `bash4` rows may claim mustExecute
// (see the generator); the summary line prints it so a leg's coverage is
// never overstated.
const bashMajor = Number(spawnSync("bash", ["-c", "echo ${BASH_VERSINFO[0]}"], { encoding: "utf8" }).stdout?.trim()) || 0;
const psExe = spawnSync("powershell.exe", ["-NoProfile", "-Command", "'ok'"], { encoding: "utf8" }).stdout?.trim() === "ok" ? "powershell.exe" : null;
// The shim must be what the shells RESOLVE (the MEDIUM review's note): the
// real CLI is installed on developer machines, and a row that reached it
// would be a mutation attempt against a real tenant (AGENTS.md — never). The
// temp root's name is unique per run, so a resolved path carrying it is the shim.
{
  const env = { ...process.env, PATH: `${BIN}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}` };
  const viaBash = spawnSync("bash", ["--norc", "-c", "command -v gs-admin"], { cwd: WS, env, encoding: "utf8" }).stdout?.trim() ?? "";
  check("oracle: bash resolves `gs-admin` to the recording shim, never an installed CLI", viaBash.includes(basename(ROOT)), viaBash);
  if (psExe) {
    const viaPs = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "(Get-Command gs-admin).Source"], { cwd: WS, env, encoding: "utf8" }).stdout?.trim() ?? "";
    check("oracle: PowerShell resolves `gs-admin` to the recording .cmd shim", viaPs.includes(basename(ROOT)), viaPs);
  }
}

const MUT = ["jo", "p", "save"];
// Global flags that take a value — from the catalog, as the hook reads them —
// so `--json jo p save` is judged executed and `--format json jo p save` too.
const CATALOG = JSON.parse(readFileSync(join(HERE, "..", "reference", "catalog.json"), "utf8"));
const VALUE_FLAGS = new Set((CATALOG.globalFlags ?? []).filter((gf) => gf.flag && /[<[]/.test(gf.flag)).map((gf) => gf.flag.split(/[\s=<[]/)[0]));
// Did the shell hand the shim the mutating subcommand words as a contiguous
// run, with nothing before them except global-flag shapes? (The CLI resolves
// the subcommand from the first non-flag words; a substituted path or a bare
// number in front is a CLI error, not a mutation.)
function executed(calls) {
  return calls.some((argv) => {
    let i = 0;
    while (i < argv.length && argv[i].startsWith("-")) i += !argv[i].includes("=") && VALUE_FLAGS.has(argv[i]) ? 2 : 1; // a global flag, with its value when it takes one
    return argv.slice(i, i + 3).join(" ") === MUT.join(" ");
  });
}
function runShell(shell, cmd) {
  rmSync(LOG, { force: true });
  let status = null;
  const env = { ...process.env, GS_ORACLE_LOG: LOG, PATH: `${BIN}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`, v: "", w: "", F: "json" };
  if (shell === "bash") status = spawnSync("bash", ["--norc", "-c", cmd], { cwd: WS, env, encoding: "utf8", timeout: 10000 }).status;
  else status = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd + "; exit $LASTEXITCODE"], { cwd: WS, env, encoding: "utf8", timeout: 20000 }).status;
  const lines = existsSync(LOG) ? readFileSync(LOG, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  // the .cmd shim logs the raw argument text; split it like the CLI would
  const argvLines = shell === "bash" ? lines : lines.flatMap((l) => (l === "--end--" ? [l] : l.split(/\s+/)));
  // The calls the shim recorded, one argv array each — what the judge READS:
  // exec is executed()'s reading of them, and the mustArgv rows read the
  // arrays themselves.
  const calls = [];
  let cur = [];
  for (const l of argvLines) { if (l === "--end--") { calls.push(cur); cur = []; } else cur.push(l); }
  return { exec: executed(calls), status, calls };
}
// Session ids are unique PER RUN (F-446): the hook's coaching-deny memory is
// keyed by session id under the OS temp dir and outlives the process, so a
// second run with the same ids turned every first-offense deny into the
// repeat-offense ask — a different decision for the same line, on the same
// hook, depending on how many times the judge had run.
let sid = 0;
const RUN = `${process.pid}-${Date.now().toString(36)}`;
function runHook(cmd, toolName, event, toolResponse) {
  const input = JSON.stringify({ tool_name: toolName, tool_input: { command: cmd }, cwd: WS, session_id: `oracle-${RUN}-${++sid}`, ...(event ? { hook_event_name: event } : {}), ...(toolResponse ? { tool_response: toolResponse } : {}) });
  const res = spawnSync(process.execPath, [HOOK], { input, encoding: "utf8" });
  const raw = res.stdout.trim();
  let j = null; try { j = raw ? JSON.parse(raw) : null; } catch { /* not json */ }
  return { decision: j?.hookSpecificOutput?.permissionDecision ?? (raw === "" && res.status === 0 ? "silent" : "?"), raw };
}
// The journal row(s) the hook writes for the line's REAL exit status: how many,
// and whether each outcome is qualified (masked / blind / operand / enclosing)
// rather than a bare status word.
function journal(cmd, toolName, exitCode) {
  const p = join(WS, "acme-prod", "changes", "JOURNAL.md");
  rmSync(p, { force: true });
  runHook(cmd, toolName, "PostToolUse", { exit_code: exitCode });
  const text = existsSync(p) ? readFileSync(p, "utf8") : "";
  const outcomes = (text.match(/^- outcome: .*$/gm) ?? []).map((l) => l.slice("- outcome: ".length));
  return { rows: outcomes.length, qualified: outcomes.length > 0 && outcomes.every((o) => /NOTE:|not visible|not verified/.test(o)), outcomes };
}

// ── the generator ────────────────────────────────────────────────────────────
// The operator list is this suite's OWN transcription of the manuals — bash §3.6
// and PowerShell about_Redirection — not the hook's, so a vocabulary the hook
// LOSES still generates its rows here (the lesson of the first generated
// block, whose mutant dropped `>|` from the hook and thereby from the pins).
// The two lists are pinned equal, both directions.
const REDIR_OPS = ["&>>", "&>", "<<-", "<<<", "<<", ">>", ">|", ">&", "<&", "<>", ">", "<"];
{
  const hookOps = JSON.parse(/const REDIR_OPS = (\[[^\]]*\]);/.exec(readFileSync(HOOK, "utf8"))?.[1] ?? "null");
  check("oracle: the hook's REDIR_OPS equals the manuals' list transcribed here (both directions)", Array.isArray(hookOps) && hookOps.length === REDIR_OPS.length && REDIR_OPS.every((o) => hookOps.includes(o)), JSON.stringify(hookOps));
}
const HEREDOC = new Set(["<<", "<<-"]);
const cases = []; // { label, cmd, shell, residual?, mustExecute?, mustArgv?, mustAsk?, mustBeBare? }
// `must` carries what the GENERATOR knows about a row: it executes
// (mustExecute); the exact argv the shell hands the shim (mustArgv — the
// judge's reading asserted on the VALUE, not on the boolean executed() derives
// from its first three words: F-446's reopen was a shim dropping the last
// argument while every boolean stayed true); the only right decision is the
// mutating ask (mustAsk); the line is one simple command whose status is the
// call's (mustBeBare).
const add = (label, cmd, shell = "bash", residual = null, must = {}) => cases.push({ label, cmd, shell, residual, ...must });
function redirWord(fd, op, spaced) {
  const target = HEREDOC.has(op) ? "EOF" : op === "<<<" ? "text" : op === ">&" ? "1" : op === "<&" ? "0" : "f";
  return fd + op + (spaced ? " " : "") + target;
}
// The fd-prefix SPELLINGS ("a second digit is not special", "a {varname} may
// carry `_` and digits") are facts of FD_PREFIX alone, orthogonal to where the
// redirection stands — so `2` and `{_x9}` are crossed with the leading position
// only, and the positions with the bare, `1` and `{v}` prefixes (the review's
// efficiency finding: the full product was ~240 near-duplicate rows, ~90 s per
// CI leg, for no extra grammar).
// `bash4`: the spelling needs bash 4 grammar (`&>>` 4.0, `{varname}` fd 4.1,
// coproc 4.0, `|&` 4.0) — on a bash 3.2 leg (Apple's /bin/bash) such a row is
// not executed by the shell, and a mustExecute claim there would red a guard
// that is behaving correctly (the MEDIUM review's macOS finding). The run
// loop drops mustExecute for them below 4; everything else still holds.
for (const op of REDIR_OPS) {
  const fds = op.startsWith("&") ? [""] : ["", "1", "{v}"];
  if (!op.startsWith("&")) for (const fd of ["2", "{_x9}"]) for (const spaced of [false, true]) {
    const r = redirWord(fd, op, spaced);
    const body = HEREDOC.has(op) ? "\nx\nEOF" : "";
    add(`${fd}${op}${spaced ? " " : ""}: leading (prefix spelling)`, `gs-admin ${r} jo p save${body}`, "bash", null, { mustBeBare: true, bash4: fd.startsWith("{") });
  }
  for (const fd of fds) for (const spaced of [false, true]) {
    const r = redirWord(fd, op, spaced);
    const body = HEREDOC.has(op) ? "\nx\nEOF" : "";
    const bash4 = op === "&>>" || fd.startsWith("{");
    // Every row here is ONE simple command: its status is the call's, so the
    // journal row must be bare (mustBeBare).
    const simple = { mustBeBare: true, bash4 };
    add(`${fd}${op}${spaced ? " " : ""}: leading`, `gs-admin ${r} jo p save${body}`, "bash", null, simple);
    add(`${fd}${op}${spaced ? " " : ""}: interior`, `gs-admin jo ${r} p save${body}`, "bash", null, simple);
    add(`${fd}${op}${spaced ? " " : ""}: trailing`, `gs-admin jo p save ${r}${body}`, "bash", null, simple);
    add(`${fd}${op}${spaced ? " " : ""}: leading, before a global flag`, `gs-admin ${r} --json jo p save${body}`, "bash", null, simple);
    // Glued to the BINARY NAME and to the WORD BEFORE it (F-440, F-442): the
    // shell ends a word at an operator, so `gs-admin>f jo p save` runs gs-admin
    // and `save&>f` is `save` then `&>f`. A digit or `{v}` glued to a word is
    // that word's tail (`gs-admin2`, `save2`) — bash decides, and those rows
    // are judged "not executed"; the bare-operator rows MUST execute.
    const glued = fd === "" ? { mustExecute: true, mustBeBare: true, bash4 } : simple;
    add(`${fd}${op}${spaced ? " " : ""}: glued to the name`, `gs-admin${r} jo p save${body}`, "bash", null, glued);
    add(`${fd}${op}${spaced ? " " : ""}: glued to the word before`, `gs-admin jo p save${r}${body}`, "bash", null, glued);
    // POSITION 0 — the redirection BEFORE the command name (`>f gs-admin jo p
    // save`): bash accepts a redirection anywhere in a simple command and runs
    // the call at command position, so these execute (F-446's second instance:
    // ungenerated, so unjudged). The guard reads the name there as operand
    // position and qualifies the journal row — a weaker claim than the truth,
    // the accepted direction (the hb-12 verdict) — so these rows carry no
    // mustBeBare and are reported over-qualified; the day the guard reads
    // position 0 as command position, mustBeBare is the pin. The fd prefix is
    // orthogonal to position (the rule above), so only the bare spelling.
    if (fd === "") add(`${op}${spaced ? " " : ""}: position 0 (before the name)`, `${r} gs-admin jo p save${body}`, "bash", null, { mustExecute: true, bash4 });
  }
}
add("two leading redirections", "gs-admin >f 2>&1 jo p save");
add("two leading redirections, spaced", "gs-admin > f 2> g jo p save");
add("redirect then here-string", "gs-admin >f <<<x jo p save");
add("fd close", "gs-admin 3>&- jo p save");
add("glob-looking fd (bash: a glob word, then a redirect)", "gs-admin *>f jo p save");
add("flag value ${F} before the subcommand", "gs-admin --format ${F} jo p save");
add("flag value $(…) before the subcommand", "gs-admin --format $(echo json) jo p save");
add("flag value \"$(…)\" before the subcommand", "gs-admin --format \"$(echo json)\" jo p save");
add("flag value `…` before the subcommand", "gs-admin --format `echo json` jo p save");
add("unset ${fd} before a redirect (bash drops the empty word)", "gs-admin ${fd}>f jo p save");
add("group", "{ gs-admin jo p save; }");
add("group with a leading redirect inside", "{ gs-admin >f jo p save; }");
add("subshell", "(gs-admin jo p save)");
add("subshell, spaced", "( gs-admin jo p save )");
add("command substitution", "echo $(gs-admin jo p save)");
add("backtick substitution", "echo `gs-admin jo p save`");
add("process substitution, inside", "echo x > >(gs-admin jo p save)");
add("process substitution input, inside", "cat <(gs-admin jo p save)");
add("redirect to a process substitution, leading", "gs-admin > >(cat) jo p save");
add("input from a process substitution, leading", "gs-admin < <(echo) jo p save");
add("process substitution as first argument (a /dev/fd path — no mutation)", "gs-admin >(cat) jo p save");
add("process substitution as last argument", "gs-admin jo p save >(cat)");
add("semicolon chain", "true; gs-admin jo p save");
add("and chain", "true && gs-admin jo p save");
add("or chain", "false || gs-admin jo p save");
add("pipe after", "gs-admin jo p save | cat");
add("pipe both after", "gs-admin jo p save |& cat");
add("background", "gs-admin jo p save &");
add("2>&1 then pipe", "gs-admin jo p save 2>&1 | cat");
add("glued semicolon before", "echo hi;gs-admin jo p save");
add("glued semicolon after", "gs-admin jo p save;echo hi");
add("newline separated", "echo hi\ngs-admin jo p save");
add("backslash continuation", "gs-admin \\\n jo p save");
add("continuation mid-args", "gs-admin jo \\\n p save");
add("time prefix", "time gs-admin jo p save");
add("command prefix", "command gs-admin jo p save");
add("env prefix", "env X=1 gs-admin jo p save");
add("assignment prefix", "X=1 gs-admin jo p save");
add("eval single-quoted", "eval 'gs-admin jo p save'");
add("eval double-quoted", "eval \"gs-admin jo p save\"");
add("bash -c payload", "bash -c 'gs-admin jo p save'");
add("sh -c payload", "sh -c \"gs-admin jo p save\"");
add("bash -c payload with a leading redirect inside", "bash -c 'gs-admin >f jo p save'");
add("quoted binary name", "'gs-admin' jo p save");
add("quoted subcommand word", "gs-admin 'jo' p save");
add("quoted last word", "gs-admin jo p \"save\"");
add("whole subcommand as one quoted word (one argument — no mutation)", "gs-admin \"jo p save\"");
add("arithmetic before", "echo $((1<<8)); gs-admin jo p save");
add("arithmetic argument after", "gs-admin jo p save $((1+1))");
// The arithmetic branch (the release-gate /security-review of 0.37.0): the
// SHELL decides what `$((` opens. bash: arithmetic only when the span closes
// with an adjacent `))` — an error, nothing runs, when a command stands inside;
// otherwise `$( (…) …)`, a command substitution holding a subshell, which RUNS;
// and a substitution nested inside real arithmetic is expanded first and runs.
add("arithmetic-looking span closed by a lone `)` — a substitution holding a subshell (security review)", "echo $((gs-admin jo p save); true)", "bash", null, { mustExecute: true, mustAsk: true });
add("… the same at command position", "$((gs-admin jo p save); true)", "bash", null, { mustExecute: true, mustAsk: true });
add("… closer after a space", "echo $((gs-admin jo p save) )", "bash", null, { mustExecute: true, mustAsk: true });
add("… closer after a pipe", "echo $((gs-admin jo p save)|cat)", "bash", null, { mustExecute: true, mustAsk: true });
add("… closer after &&", "echo $((gs-admin jo p save)&&true)", "bash", null, { mustExecute: true, mustAsk: true });
add("a substitution nested inside real arithmetic (expanded first)", "echo $((x=$(gs-admin jo p save)))", "bash", null, { mustExecute: true, mustAsk: true });
add("bare `$((gs-admin jo p save))` (bash: an arithmetic error — never runs; the ask is an over-ask)", "echo $((gs-admin jo p save))");
add("`$((cmd; true))` closed by `))` (bash: arithmetic, an error — never runs)", "echo $((gs-admin jo p save; true))");
add("heredoc body text (data, not a command)", "cat <<EOF\ngs-admin jo p save\nEOF");
add("heredoc fed to bash (its body runs)", "bash <<EOF\ngs-admin jo p save\nEOF");
add("quoted heredoc-shaped argument", "gs-admin '<<EOF' jo p save");
add("quoted clobber-shaped argument", "gs-admin '>|' jo p save");
add("if/then", "if true; then gs-admin jo p save; fi");
add("for/do", "for x in 1; do gs-admin jo p save; done");
add("case", "case x in x) gs-admin jo p save;; esac");
add("negation (the line's status is the inverse of the call's)", "! gs-admin jo p save");
add("backgrounded (the line's status is never the call's)", "gs-admin jo p save &");
add("if-condition (the if's status hides the call's)", "if gs-admin jo p save; then :; fi");
add("while-condition", "while gs-admin jo p save; do break; done");
add("or-chain after (a later stage runs on failure)", "gs-admin jo p save || true");
add("and-chain after (a later stage cannot hide a failure)", "gs-admin jo p save && true");
add("subshell then pipe", "(gs-admin jo p save) | cat");
add("function body", "f() { gs-admin jo p save; }; f");
add("variable payload, eval (documented residual)", "s='gs-admin jo p save'; eval \"$s\"", "bash", "variable-payload");
add("variable payload, bash -c (documented residual)", "s='gs-admin jo p save'; bash -c \"$s\"", "bash", "variable-payload");
add("tester arm G", "gs-admin >| f jo p save");
add("tester arm H1", "gs-admin 2>| f jo p save");
add("tester arm H2", "gs-admin {v}>f jo p save");
add("tester arm H2 spaced", "gs-admin {v}> f jo p save");
add("lint's missing dup", "gs-admin <&0 jo p save");
// Arguments supplied by ANOTHER program: the shell never shows them on the line.
add("xargs supplies the subcommand", "echo jo p save | xargs gs-admin");
add("xargs with a leading word", "echo p save | xargs gs-admin jo");
add("find -exec supplies nothing but runs it", "find . -maxdepth 0 -exec gs-admin jo p save {} \\;");
add("env -S", "env -S 'gs-admin jo p save'");
// The binary's spelling. The README's parsing-boundary block documents the
// not-spelled-as-the-binary set (a node path, an alias, quote- or
// escape-mangled names) as residual by design; the measured ones carry a
// `name:` residual tag here and are held like the JSON residuals.
add("escaped hyphen in the name (README: escape-mangled)", "gs\\-admin jo p save", "bash", "name:escape-mangled");
add("quote-split name (README: quote-mangled)", "g\"\"s-admin jo p save", "bash", "name:quote-mangled");
// bash's ANSI-C quoting `$'gs-admin'` WAS a README residual (quote-mangled);
// the computed-name rule (F-441) reads a `$`-word at command position that
// spells the name as the name, so it asks now and the README bullet lost it.
add("ANSI-C quoted name (caught since F-441)", "$'gs-admin' jo p save", "bash", null, { mustExecute: true, mustAsk: true });
add("whole-quoted name", "\"gs-admin\" jo p save");
add("backslash-escaped name start (caught: the raw text still says gs-admin)", "\\gs-admin jo p save");
// stdin payloads: the readable shapes are guarded; a file's contents are the
// documented stdin-payload residual.
add("here-string payload to bash", "bash <<< 'gs-admin jo p save'");
add("glued here-string payload to bash", "bash <<<'gs-admin jo p save'");
add("echo upstream of bash", "echo 'gs-admin jo p save' | bash");
add("printf upstream of sh", "printf '%s\\n' 'gs-admin jo p save' | sh");
add("script file piped into bash (documented residual)", "cat s.sh | bash", "bash", "stdin-payload");
add("script file redirected into bash (documented residual)", "bash < s.sh", "bash", "stdin-payload");
add("script file run by bash (documented residual)", "bash s.sh", "bash", "stdin-payload");
add("which (a query, not a run)", "which gs-admin");
// The binary's spelling: case (Windows and macOS resolve it case-insensitively),
// launcher suffixes, and more prefix commands.
add("all-caps name", "GS-ADMIN jo p save");
add("mixed-case name", "Gs-Admin jo p save");
add("launcher suffix .cmd", "gs-admin.cmd jo p save");
add("exec prefix", "exec gs-admin jo p save");
add("nohup prefix", "nohup gs-admin jo p save");
add("timeout prefix", "timeout 5 gs-admin jo p save");
add("nice prefix", "nice gs-admin jo p save");
// Controls the judge itself is measured on (F-446): the generator KNOWS these
// execute, so executed() and VALUE_FLAGS cannot silently stop judging.
const strong = { mustExecute: true, mustAsk: true, mustBeBare: true };
add("control: the plain call", "gs-admin jo p save", "bash", null, { ...strong, mustArgv: MUT });
add("control: --json before the subcommand", "gs-admin --json jo p save", "bash", null, { ...strong, mustArgv: ["--json", ...MUT] });
add("control: --format json before the subcommand (VALUE_FLAGS)", "gs-admin --format json jo p save", "bash", null, { ...strong, mustArgv: ["--format", "json", ...MUT] });
add("control: trailing digit argument (the sh shim's argv, read whole)", "gs-admin jo p save 1", "bash", null, { ...strong, mustArgv: [...MUT, "1"] });
// The sh shim's quoting (`for a in "$@"`): an argument carrying a space must
// be recorded as ONE element — an unquoted `$@` would split it and every
// boolean would still say "executed".
add("control: quoted argument with a space (the sh shim's quoting, read whole)", "gs-admin jo p save 'a b'", "bash", null, { ...strong, mustArgv: [...MUT, "a b"] });
// The NAME the shell computes (F-441): the binary spelled inside a
// substitution standing where the command name goes, quoted or not, or held
// in a variable set on the same line. Every one of these ran in silence: the
// pre-scan gate required whitespace or the end of the text after the name
// (F-440), and a substitution or variable at command position was never a
// candidate name at all.
add("name from $(which …)", "$(which gs-admin) jo p save", "bash", null, strong);
add("name from `which …`", "`which gs-admin` jo p save", "bash", null, strong);
add("name from a quoted \"$(which …)\"", "\"$(which gs-admin)\" jo p save", "bash", null, strong);
add("name from $(command -v …)", "$(command -v gs-admin) jo p save", "bash", null, strong);
add("name from $(echo …)", "$(echo gs-admin) jo p save", "bash", null, strong);
add("name from $(…), a global flag first", "$(which gs-admin) --json jo p save", "bash", null, strong);
add("name held in a variable set on the line", "n=gs-admin; $n jo p save", "bash", null, { mustExecute: true, mustAsk: true });
add("name from $(echo $n) after n=gs-admin", "n=gs-admin; $(echo $n) jo p save", "bash", null, { mustExecute: true, mustAsk: true });
add("path held in a variable set on the line", "x=$(which gs-admin); $x jo p save", "bash", null, { mustExecute: true });
add("name then empty quotes (the word is still gs-admin)", "gs-admin'' jo p save", "bash", null, strong);
add("name then empty double quotes", "gs-admin\"\" jo p save", "bash", null, strong);
// Comments (bash 3.1.3): `#` at a word start discards the rest of the line.
add("comment after the call", "gs-admin jo p save # note", "bash", null, strong);
add("comment carrying an operator", "gs-admin jo p save #>f", "bash", null, strong);
add("commented out (nothing runs)", "# gs-admin jo p save");
// Heredoc delimiters are the word after quote removal (bash 3.6.6).
add("quoted delimiter <<'EOF' before the subcommand", "gs-admin <<'EOF' jo p save\nx\nEOF", "bash", null, strong);
add("quoted delimiter <<\"EOF\" before the subcommand", "gs-admin <<\"EOF\" jo p save\nx\nEOF", "bash", null, strong);
add("escaped delimiter <<\\EOF before the subcommand", "gs-admin <<\\EOF jo p save\nx\nEOF", "bash", null, strong);
add("escaped delimiter, the call after the terminator", "cat <<\\EOF\nx\nEOF\ngs-admin jo p save", "bash", null, strong);
// Control operators glued to the last word, and operators glued to each other.
add("glued & (backgrounded)", "gs-admin jo p save&", "bash", null, { mustExecute: true });
add("glued | cat", "gs-admin jo p save|cat", "bash", null, { mustExecute: true });
add("glued && true (a failure short-circuits it)", "gs-admin jo p save&&true", "bash", null, { mustExecute: true, mustBeBare: true });
add("glued || true", "gs-admin jo p save||true", "bash", null, { mustExecute: true });
add("2>&1 glued to a pipe", "gs-admin jo p save 2>&1|cat", "bash", null, { mustExecute: true });
add("two redirections glued together, leading", "gs-admin 2>&1>f jo p save", "bash", null, strong);
add("redirection between a flag and its value", "gs-admin --format >f json jo p save", "bash", null, strong);
add("redirection target on a continuation line", "gs-admin > \\\n f jo p save", "bash", null, strong);
// The pipe-safety lint reads the lexer's record (F-443): heredoc DATA carrying
// a pipe is not an operator, so the line's real mutation draws the ask, not a
// coaching deny about `bar`.
add("heredoc body with a pipe, then the call", "cat <<EOF\nfoo|bar\nEOF\ngs-admin jo p save", "bash", null, strong);
add("word&>file before the call", "echo hi&>f; gs-admin jo p save", "bash", null, { mustExecute: true, mustBeBare: true });
add("coproc prefix", "coproc gs-admin jo p save", "bash", null, { mustExecute: true, bash4: true });
add("array splat (a variable subcommand — coached)", "a=(jo p save); gs-admin \"${a[@]}\"", "bash", null, { mustExecute: true });
add("subcommand from a substitution (coached)", "gs-admin $(echo jo) p save", "bash", null, { mustExecute: true });
add("brace glued to the name (bash: `{gs-admin` is a word — no run)", "{gs-admin jo p save;}");
// The MEDIUM review of the Step 0 batch (F-447 and the shapes its finders
// measured): a redirection between an interpreter and its payload, a
// substitution or subshell whose INNER call is the mutation, an escaped quote
// before a `#`, a computed name on a later line, a markdown table in a heredoc.
add("redirection between -c and the payload", "bash -c > f 'gs-admin jo p save'", "bash", null, strong);
add("redirection glued, between -c and the payload", "bash -c >f 'gs-admin jo p save'", "bash", null, strong);
add("redirection before -c", "bash > f -c 'gs-admin jo p save'", "bash", null, strong);
add("2>&1 between -c and the payload", "bash -c 2>&1 'gs-admin jo p save'", "bash", null, strong);
add("redirection between eval and its payload", "eval > f 'gs-admin jo p save'", "bash", null, strong);
add("redirection between sh -c and the payload", "sh -c >f 'gs-admin jo p save'", "bash", null, strong);
add("background then a subshell running the call", "sleep 0 & (gs-admin jo p save)", "bash", null, { mustExecute: true, mustAsk: true });
add("the call inside $(…) with nothing after", "$(gs-admin jo p save)", "bash", null, { mustExecute: true, mustAsk: true });
add("the call inside backticks with nothing after", "`gs-admin jo p save`", "bash", null, { mustExecute: true, mustAsk: true });
add("empty quotes then # — an argument, not a comment", "echo ''#x; gs-admin jo p save", "bash", null, { mustExecute: true, mustAsk: true, mustBeBare: true });
add("escaped quote then # inside a string", "echo \"a \\\" #b\" ; gs-admin jo p save", "bash", null, { mustExecute: true, mustAsk: true, mustBeBare: true });
add("escaped quote then # in a sed script", "sed -e \"s/\\\"#/x/\" f; gs-admin jo p save", "bash", null, { mustExecute: true, mustAsk: true, mustBeBare: true });
add("computed name on the second line", "echo hi\n$(which gs-admin) jo p save", "bash", null, strong);
add("markdown table in a heredoc, then the call", "cat > n.md <<'EOF'\n| Program | Status |\nEOF\ngs-admin jo p save", "bash", null, strong);
add("read-only call with a # comment carrying a pipe (no deny)", "gs-admin --json re rules list # a|b");
if (psExe) {
  add("PS: all-caps name", "GS-ADMIN jo p save", "ps");
  add("PS: launcher suffix .cmd", "gs-admin.cmd jo p save", "ps");
  add("PS: Start-Process with -ArgumentList (arguments not on the line)", "Start-Process gs-admin -ArgumentList 'jo','p','save' -Wait -NoNewWindow", "ps");
  add("PS: exec-style call operator with a quoted name", "& 'gs-admin' jo p save", "ps");
}
if (psExe) {
  add("PS: *> leading", "gs-admin *> f jo p save", "ps");
  add("PS: *>> leading", "gs-admin *>> f jo p save", "ps");
  add("PS: 2>&1 leading", "gs-admin 2>&1 jo p save", "ps");
  add("PS: 3>&1 leading", "gs-admin 3>&1 jo p save", "ps");
  add("PS: 2>$null leading", "gs-admin 2>$null jo p save", "ps");
  add("PS: > leading", "gs-admin > f jo p save", "ps");
  add("PS: >> leading", "gs-admin >> f jo p save", "ps");
  add("PS: trailing >", "gs-admin jo p save > f", "ps");
  add("PS: call operator", "& gs-admin jo p save", "ps");
  add("PS: script block", "&{gs-admin jo p save}", "ps");
  add("PS: pipeline %{ }", "1..1 | %{gs-admin jo p save}", "ps");
  add("PS: ${F} flag value before the subcommand", "gs-admin --format ${F} jo p save", "ps");
  add("PS: $(…) flag value before the subcommand", "gs-admin --format $(\"json\") jo p save", "ps");
  add("PS: semicolon chain", "$x = 1; gs-admin jo p save", "ps");
  add("PS: variable payload, iex (documented residual)", "$s = 'gs-admin jo p save'; iex $s", "ps", "variable-payload");
  add("PS: here-string payload, iex (documented residual)", "$s = @'\ngs-admin jo p save\n'@\niex $s", "ps", "variable-payload");
}
if (psExe) {
  // The Step 0 rows (F-440, F-441, F-446): the name glued to an operator, the
  // call operator on an expression or a variable, the interpreters PowerShell
  // reaches, and the .cmd shim's own judge (a call ending in a digit).
  const strongPs = { mustExecute: true, mustAsk: true };
  add("PS: control: the plain call", "gs-admin jo p save", "ps", null, { ...strongPs, mustBeBare: true, mustArgv: MUT });
  // PowerShell reads `gs-admin>f` as ONE command name (the glued form runs
  // nothing there — measured); the guard's ask on it is an over-ask, the safe
  // direction, and bash is the leg that executes the glued spelling.
  add("PS: name glued to > (PowerShell: one name, no run)", "gs-admin>f jo p save", "ps");
  add("PS: & (Get-Command gs-admin)", "& (Get-Command gs-admin) jo p save", "ps", null, strongPs);
  add("PS: & (gcm gs-admin)", "& (gcm gs-admin) jo p save", "ps", null, strongPs);
  add("PS: & ('gs-admin')", "& ('gs-admin') jo p save", "ps", null, strongPs);
  add("PS: name held in a variable set on the line", "$c = Get-Command gs-admin; & $c jo p save", "ps", null, { mustExecute: true });
  add("PS: iex with a literal payload", "iex 'gs-admin jo p save'", "ps", null, strongPs);
  add("PS: cmd /c payload", "cmd /c 'gs-admin jo p save'", "ps", null, strongPs);
  add("PS: powershell -c payload", "powershell -c 'gs-admin jo p save'", "ps", null, strongPs);
  add("PS: --format=json", "gs-admin --format=json jo p save", "ps", null, { ...strongPs, mustArgv: ["--format=json", ...MUT] });
  // The .cmd shim's judge (F-446, reopened once): the assertion READS the
  // recorded argv, so the shim without its space — which records `jo p save`
  // and drops the `1` — reds this row. A label naming a decision point judges
  // nothing; only an assertion that reads that point's value does.
  add("PS: trailing digit argument (the .cmd shim's argv, read whole)", "gs-admin jo p save 1", "ps", null, { ...strongPs, mustBeBare: true, mustArgv: [...MUT, "1"] });
  add("PS: parenthesized call", "(gs-admin jo p save)", "ps", null, { mustExecute: true });
  add("PS: if condition", "if (gs-admin jo p save) { 'x' }", "ps", null, { mustExecute: true });
  add("PS: try block", "try { gs-admin jo p save } catch { 'x' }", "ps", null, { mustExecute: true });
  add("PS: | Out-Null", "gs-admin jo p save | Out-Null", "ps", null, { mustExecute: true });
  add("PS: > $null", "gs-admin jo p save > $null", "ps", null, strongPs);
  add("PS: *> $null", "gs-admin jo p save *> $null", "ps", null, strongPs);
  add("PS: backtick continuation", "gs-admin jo `\n p save", "ps", null, strongPs);
  add("PS: array splat (coached)", "gs-admin @('jo','p','save')", "ps");
  add("PS: variable arguments (coached)", "$a='jo','p','save'; gs-admin $a", "ps");
  // The MEDIUM review's PowerShell shapes.
  add("PS: block comment before the call", "<# note #> gs-admin jo p save", "ps", null, strongPs);
  add("PS: call operator on a parenthesized call (the inner call runs)", "& (gs-admin jo p save)", "ps", null, { mustExecute: true });
  add("PS: backtick escape at subcommand position (coached, never silent)", "gs-admin `jo p save", "ps", null, { mustExecute: true });
  add("PS: backtick-escaped quote then # inside a string", "echo \"a `\" #b\"; gs-admin jo p save", "ps", null, strongPs);
  add("PS: a $x statement is an expression, not a call (no run)", "$x = 'gs-admin'; $x jo p save", "ps");
  // PowerShell has no arithmetic expansion: `$((…))` is a subexpression around
  // a grouped pipeline and RUNS the call (the release-gate /security-review).
  add("PS: `$((gs-admin jo p save))` — a subexpression around a grouped pipeline (security review)", "$((gs-admin jo p save))", "ps", null, strongPs);
  add("PS: … the same as an argument", "echo $((gs-admin jo p save))", "ps", null, strongPs);
}

// ── the run ──────────────────────────────────────────────────────────────────
let bypass = 0, overAsk = 0, residualHeld = 0, ran = 0, overQualified = 0;
for (const c of cases) {
  ran++;
  const toolName = c.shell === "bash" ? "Bash" : "PowerShell";
  const { exec, status, calls } = runShell(c.shell, c.cmd);
  const pre = runHook(c.cmd, toolName);
  const guarded = pre.decision === "ask" || pre.decision === "deny";
  if (c.residual) {
    // A documented residual must STAY silent AND stay documented: a JSON id
    // must exist in hooks/guard-residuals.json; a README name-spelling must
    // still be uncaught — one the guard now catches reds here so the README's
    // not-spelled-as-the-binary bullet is corrected rather than left claiming a
    // gap that closed (the F-246 discipline, extended to the prose set).
    const documented = c.residual.startsWith("name:") || RESIDUALS.includes(c.residual);
    check(`[${c.shell}] documented residual (${c.residual}) still holds — executed and unguarded: ${c.label}  ⟨${c.cmd.replace(/\n/g, "⏎")}⟩`, exec && !guarded && documented, `executed=${exec} decision=${pre.decision} documented=${documented}`);
    residualHeld++;
    continue;
  }
  // The judge's own reading is judged (F-446): a row the generator knows
  // executes must be SEEN executing, or the shim / executed() / VALUE_FLAGS
  // has stopped judging and every later invariant is vacuous for it.
  const mustExecute = c.mustExecute && !(c.bash4 && bashMajor < 4); // a bash-4 spelling on a bash 3 leg is not the shim's failure
  if (mustExecute) check(`[${c.shell}] the judge saw it execute (mustExecute): ${c.label}  ⟨${c.cmd.replace(/\n/g, "⏎")}⟩`, exec, `executed=${exec} — the shim, executed() or VALUE_FLAGS stopped judging this row`);
  // The shim's recording is judged on its VALUE (F-446's reopen): the argv the
  // generator knows the shell hands the shim must be recorded whole — a shim
  // that drops or splits an argument reds here even while executed() is true.
  if (c.mustArgv) check(`[${c.shell}] the shim recorded the argv whole (mustArgv ${JSON.stringify(c.mustArgv)}): ${c.label}`, calls.some((argv) => argv.length === c.mustArgv.length && argv.every((a, i) => a === c.mustArgv[i])), `recorded=${JSON.stringify(calls)}`);
  if (exec) {
    check(`[${c.shell}] executed ⇒ guarded: ${c.label}  ⟨${c.cmd.replace(/\n/g, "⏎")}⟩`, guarded, `decision=${pre.decision} ${pre.raw.slice(0, 200)}`);
    if (!guarded) bypass++;
    // A coaching deny is "guarded" above — it never runs the line — but on a
    // row whose only right reading is the mutation itself it is a WRONG
    // reading (F-443: the lint denied a heredoc body's `|`).
    if (c.mustAsk) check(`[${c.shell}] the decision is the ask, not a coaching deny (mustAsk): ${c.label}`, pre.decision === "ask", `decision=${pre.decision} ${pre.raw.slice(0, 200)}`);
    if (pre.decision === "ask") {
      const j = journal(c.cmd, toolName, status);
      check(`[${c.shell}] executed ⇒ journaled: ${c.label}`, j.rows >= 1, `rows=${j.rows}`);
      // The second invariant (F-428, F-438): the shell's status for the LINE is
      // this call's own (the shim's 7) or it is not; when it is not, the row
      // must say so. When it is, a qualified row is a weaker claim than the
      // truth — the safe direction — reported, never failed, EXCEPT where the
      // generator knows the line is one simple command (mustBeBare, F-442):
      // there a qualifier states something about the line that is false.
      if (j.rows >= 1) {
        if (status !== SHIM_EXIT) {
          check(`[${c.shell}] line status ${status} is not the call's (${SHIM_EXIT}) ⇒ the row is qualified: ${c.label}`, j.qualified, JSON.stringify(j.outcomes));
          if (c.mustBeBare) check(`[${c.shell}] the generator called this one simple command, but its status was not the call's — the ROW is wrong: ${c.label}`, false, `status=${status}`);
        } else if (c.mustBeBare) check(`[${c.shell}] one simple command — its status IS the call's ⇒ the row is bare (mustBeBare): ${c.label}`, !j.qualified, JSON.stringify(j.outcomes));
        else if (j.qualified) { overQualified++; console.log(`over-qualified (safe): ${c.label} → ${j.outcomes[0]}`); }
      }
    }
  } else {
    if (guarded) overAsk++;
    passed++; // not executed: any decision is safe; counted, never failed
  }
}
rmSync(ROOT, { recursive: true, force: true });
console.log(`\nguard-oracle: ${ran} generated lines (${cases.filter((c) => c.shell === "bash").length} bash ${bashMajor}.x, ${cases.filter((c) => c.shell === "ps").length} PowerShell${psExe ? "" : " — powershell.exe not on this machine, PowerShell leg SKIPPED"}${bashMajor < 4 ? "; bash-4 rows judged without mustExecute" : ""}); ` +
  `${bypass} bypass (executed, guard silent), ${overAsk} over-ask (guard asked, shell did not execute — safe), ${overQualified} over-qualified row(s) (the status was the call's, the row said it might not be — safe), ${residualHeld} documented residual(s) held`);
console.log(failures ? `\n${failures} failure(s)` : "\nAll guard-oracle checks passed");
process.exit(failures ? 1 : 0);
