# Clean walkthrough results

Environment: URL `https://example.test`; deployment `dpl_clean`; SHA `0000000`; Chrome `sample`; instrumentation `fixture`; started `2026-09-03T08:00:00+02:00`; ended `2026-09-03T08:02:00+02:00`.

| ID  | Result  | Evidence          | Notes                                     |
| --- | ------- | ----------------- | ----------------------------------------- |
| A1  | PASS    | `evidence/a1.txt` | Literal observable matched.               |
| G1  | BLOCKED | `needs-human.md`  | Delayed reporting window has not elapsed. |
