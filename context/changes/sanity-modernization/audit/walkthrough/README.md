# Presentation walkthrough run contract

The immutable record of the sanity-modernization Presentation audit (Phase 11), ported from the lsse-www walkthrough contract. The **main Claude Code session** owns Chrome (Claude in Chrome), the Studio pane, the previewed origin, DOM and Content Lake evidence, verdicts, commits, pushes, `sanity deploy` and retests. A bounded subagent may only implement a non-overlapping repository fix or do a read-only review: never the browser, never the Lake, never a commit.

Lanes: [L] `http://localhost:3333` → `http://localhost:3000`; [D] `https://audiofast.sanity.studio` (app `dlwt2zhgkk7rjx6dj8rdyjfz`) → `https://audiofast.pl`. Lane [S] (Safari, CHIPS) is deferred (D8). Preflight facts: [preflight-2026-10-27/](preflight-2026-10-27/).

## Run layout

```text
run-<n>/
├── results.md
├── fixes.md          # only when this run has FAIL rows
├── needs-human.md    # only for a genuine credential/approval/product-decision blocker
├── done.md           # only when the summariser exits 0 and cleanup is proven
└── evidence/
```

Never edit an earlier run after starting a later one. Run 1 attempts every scenario in [../test-plan.md](../test-plan.md) §4 on its lane. A later run attempts every FAIL of the preceding run plus the plausible regressions named in its `fixes.md`. [D] rows run after the phase-end push + `sanity deploy` + Vercel READY.

## `results.md`

One `Environment:` paragraph (lane, Studio origin, Studio build — local `sanity dev` at `<SHA>` or deployed app `dlwt2zhgkk7rjx6dj8rdyjfz` at `<SHA>`, previewed origin + SHA, Chrome version + "Claude in Chrome", instrumentation, ISO start/end), then exactly one table with the header:

```markdown
| ID | Result | Evidence | Notes |
```

Result is `PASS`, `FAIL` or `BLOCKED`. A FAIL row has a non-empty `Cause:` sentence. Evidence points into that run's `evidence/`.

## `fixes.md`

Per `Cause:` group: scenario ids, diagnosis, any subagent assignment, changed files, plausible regression ids, every gate result, the commit SHA, and the lane confirmation ([L]: the dev server recompiled and the changed observable is quoted; [D]: push, `sanity deploy`, READY deployment id and its source SHA).

## `needs-human.md`

Only for a missing credential, approval or product decision. Each bullet: blocked scenario, missing authority/input, exact action for Oliwier. A handshake delay, an expected behaviour (brief §5) or a repository failure is not a human blocker.

## Evidence

DOM probe output, GROQ transcripts, cookie names (never values), CLI transcripts, redacted request/response excerpts; screenshots only for the human reader. Never store a token or the preview secret. A Lake assertion needs a fresh read with the exact value quoted.

Three anti-false-success rules:

1. **Phases of 5–8 scenarios**, each re-anchored to a named URL and `_id`; budget exhaustion is BLOCKED for the rest of the phase, never a retry from memory.
2. **PASS only with a pasted artifact** quoted in Notes. A PASS without one is rewritten as BLOCKED before the summariser runs.
3. **INCONCLUSIVE is BLOCKED**, never PASS, never dropped.

```bash
bun scripts/walkthrough/summarize-results.ts context/changes/sanity-modernization/audit/walkthrough/run-<n>/results.md
```

Exit 0 means zero FAIL rows. BLOCKED is reported but never spawns a fixer.
