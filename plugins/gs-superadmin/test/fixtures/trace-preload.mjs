// ─────────────────────────────────────────────────────────────────────────────
// trace-preload.mjs — `node --import` preload that traces a WHOLE SCRIPT's
// payload reads (CLI-adoption arm, D2). scripts/relationships-build.mjs
// exports nothing and runs on import, so test/trace-reader-shapes.mjs drives
// it as a child process with this file loaded first: the JSON.parse hook is
// installed before the script's first line, every fenced-JSON parse whose
// text matches a labelled KB doc is wrapped in the recording Proxy under that
// doc's label (its CLI command), and the record is written on exit.
//
//   TRACE_LABELS  path to a JSON file: { "<exact fence text>": "<label>", … }
//   TRACE_OUT     path PREFIX the record is written to on process exit, as
//                 `<TRACE_OUT>.<pid>.json` — every process in a spawn tree
//                 (NODE_OPTIONS=--import inherits into children) writes its
//                 own file and the tracer merges them:
//                 { "<label>": ["<path>", …], "<label> embedded": [...] }
//
// Parses whose text is neither a labelled doc nor a string handed out by a
// traced object (a manifest, an inventory file) are returned untouched and
// recorded nowhere — this preload never guesses what a script is reading.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { createRecorder } from "./trace-engine.mjs";

const labelsPath = process.env.TRACE_LABELS;
const outPath = process.env.TRACE_OUT;
if (!labelsPath || !outPath) throw new Error("trace-preload: TRACE_LABELS and TRACE_OUT must both be set");
/** @type {Record<string, string>} */
const labels = JSON.parse(readFileSync(labelsPath, "utf8"));

const recorder = createRecorder();
recorder.installParseHook({ labelOf: (s) => (Object.hasOwn(labels, s) ? labels[s] : null) });

process.on("exit", () => {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const label of recorder.labels()) {
    out[label] = recorder.peek(label);
    const emb = recorder.embeddedPaths(label);
    if (emb.length) out[`${label} embedded`] = emb;
  }
  if (Object.keys(out).length) writeFileSync(`${outPath}.${process.pid}.json`, JSON.stringify(out), "utf8");
});
