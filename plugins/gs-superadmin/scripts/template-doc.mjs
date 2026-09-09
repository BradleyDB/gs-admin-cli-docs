#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// template-doc.mjs — deterministic compact KB docs for email templates
//
// A `jo email template --id` describe payload carries htmlContent/editorContent:
// entity-escaped HTML averaging ~50 KB per template that is neither readable nor
// worth model context. This script turns one or more captured describe payloads
// into compact markdown docs (metadata + the plain-text body, ~30× smaller),
// so bulk documentation runs never pass the payloads through model context.
// The full HTML stays re-fetchable from the tenant by id.
//
// This is the STANDALONE path — one-off payloads captured outside a batch
// (e.g. recovering list-invisible templates from UI-exported ids). Bulk runs
// go through describe-batch.mjs's template doc-mode instead; both import the
// same renderer from doc-lib.mjs, so the docs are identical either way.
//
// Usage:
//   node template-doc.mjs --out-dir <dir> <describe.json> [<more.json> …]
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
import { runDocGenerator, renderTemplateDoc } from "./doc-lib.mjs";

runDocGenerator({ scriptName: "template-doc.mjs", render: renderTemplateDoc, argv: process.argv.slice(2) });
