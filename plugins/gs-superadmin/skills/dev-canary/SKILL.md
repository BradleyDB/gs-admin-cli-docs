---
name: dev-canary
description: DEV CANARY — under test round-c1-report-truth · hb-20260915-02 · 2026-09-15. Visible only when this plugin is loaded from a dev working tree; removed before merge to main. If invoked, report this token and stop.
---

Load-provenance marker for the /dev-loop workflow. The token above is
rewritten by the builder at each handoff and must match the `Under test:`
line in the repo's dev/FEEDBACK.md. If invoked as a skill: state the
token from the description, then stop.
