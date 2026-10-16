---
name: dev-canary
description: DEV CANARY — under test claude/polish-pre-release-r13-6bdd49 · hb-20261015-10 · 2026-10-15. Visible only when this plugin is loaded from a dev working tree; removed before merge to main. If invoked, report this token and stop.
---

Load-provenance marker for the /dev-loop workflow. The token above is
rewritten by the builder at each handoff and must match the `Under test:`
line in the repo's dev/FEEDBACK.md. If invoked as a skill: state the
token from the description, then stop.
