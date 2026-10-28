# Sample walkthrough results

Environment: URL `https://example.test`; deployment `dpl_sample`; SHA `0000000`; Chrome `sample`; instrumentation `fixture`; started `2026-09-03T08:00:00+02:00`; ended `2026-09-03T08:03:00+02:00`.

| ID  | Result  | Evidence          | Notes                                       |
| --- | ------- | ----------------- | ------------------------------------------- |
| A1  | PASS    | `evidence/a1.txt` | Literal observable matched.                 |
| A2  | FAIL    | `evidence/a2.txt` | Cause: focus returned to the document body. |
| G1  | BLOCKED | `needs-human.md`  | Delayed reporting window has not elapsed.   |
