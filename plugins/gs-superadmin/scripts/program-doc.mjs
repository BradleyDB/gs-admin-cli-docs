#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// program-doc.mjs — deterministic compact KB docs for journey programs
//
// A `jo p describe --id` payload runs ~287 KB per program, dominated by
// flow-canvas geometry inside the embedded step JSON (node coordinates,
// transforms, UI state) that carries no admin semantics. This script turns one
// or more captured describe payloads into compact markdown docs — the semantic
// skeleton (node types/names, branch conditions, participant source with the
// PowerList config verbatim, email-template references, timers/waits) with the
// geometry dropped — so bulk documentation runs never pass the payloads
// through model context. The full payload stays re-fetchable from the tenant
// by id. Payload-shape assumptions are v1.0.4-scoped and documented in
// doc-lib.mjs; the compaction is a conservative drop-list (unknown keys are
// always kept).
//
// This is the STANDALONE path — one-off payloads captured outside a batch.
// Bulk runs go through describe-batch.mjs's program doc-mode instead; both
// import the same renderer from doc-lib.mjs, so the docs are identical either
// way (same pattern as template-doc.mjs for email templates).
//
// Usage:
//   node program-doc.mjs --out-dir <dir> <describe.json> [<more.json> …]
//
// Per-file failures are collected, not fatal. Output: one JSON summary
// { ok, written: [{id, path, bytes}], failed: [{file, error}] }.
// No manifest writes — mark assets documented via manifest.mjs as usual.
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
// The main lives ONCE in doc-lib (runDocGenerator — GP-B5 W10): this file and
// its sibling were byte-identical around the render call, and both ended
// with a stdout write followed by process.exit, which truncates the summary
// on a macOS pipe past ~8 KB (F-356's mechanism, F-360). Usage/summary/exit
// contract unchanged; the exit code rides process.exitCode so the write
// flushes before the process ends.
import { runDocGenerator, renderProgramDoc } from "./doc-lib.mjs";

runDocGenerator({ scriptName: "program-doc.mjs", render: renderProgramDoc, argv: process.argv.slice(2) });
