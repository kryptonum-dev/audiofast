---
date: 2026-09-20T07:22:15+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings live verification
tags: [research, sanity, embeddings, live-verification]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: Added follow-up research for confirmed decisions and live Sanity inspection
---

# Legacy query baseline

Captured: 2026-09-20T05:18:25.365Z

25 curated queries based on published article titles plus conceptual/unrelated examples. These are not production user analytics. Expected IDs are title-derived candidate expectations, not human relevance judgments. All queries used legacy blog search, maxResults=5, and the application filter shape.

All 25 requests returned HTTP 200. Title-derived candidate present in top five: 22/23. Observed single-run request latency: 295–530 ms, median 385 ms. This is a local comparison snapshot, not a production performance benchmark.

| Query | Candidate in top five | Top result |
| --- | --- | --- |
| AudioShow 2018 | yes | AudioShow 2018 |
| AudioShow 2019 | yes | AudioShow 2018 |
| Bricasti Design | yes |  Prezentacja wideo - Bricasti Design |
| Grimm Audio MU2 | yes | Nagroda Roku 2026 - Hifi i Muzyka dla Grimm Audio MU2 |
| Grimm LS1 MU1 | yes | Grimm Audio LS1 i MU1 – minimum sprzętu, maksimum muzyki |
| USHER SD-501 | yes | Usher Diamond SD-500 - Wyróżnienia roku 2026 - Monitory w magazynie HiFi i Muzyka |
| Usher Diamond SD-500 | yes | Usher Diamond SD-500 - Wyróżnienia roku 2026 - Monitory w magazynie HiFi i Muzyka |
| Rogue Audio Sphinx V3 Magnum | yes | Rogue Audio Sphinx V3 Magnum – Wyróżnienia roku 2026 – Wzmacniacze zintegrowane |
| STROMTANK | yes | STROMTANK w ofercie AUDIFOAST |
| Oladra Nowa Zelandia | yes | Nowa marka referencyjnych źródeł cyfrowych Oladra z Nowej Zelandii w ofercie Audiofast |
| R_volution oprogramowanie | yes | Nowe oprogramowanie R_volution |
| Pendulum Roon Ready | yes | Pendulum z certyfikatem Roon Ready |
| bezpieczniki Synergistic Research | yes | Porady na temat doboru bezpieczników Synergistic Research |
| dCS Lina Network DAC | yes | Wewnątrz przetwornika cyfrowo-analogowego dCS Lina Network DAC |
| Gryphon Audio Designs | yes | Październik z Gryphon Audio Designs |
| Dan D’Agostino Progression Integrated | yes | Premierowe prezentacje integry Dan D'Agostino Progression Integrated |
| Wilson Audio Sabrina X | yes | Premierowe prezentacje Wilson Audio Sabrina X i Audio Research |
| EISA 2026 2027 | yes | Nagrody EISA 2026–2027 dla Wilson Audio i R_volution |
| Golden Ear 2024 | yes | Nagrody Golden Ear 2024 The Absolute Sound |
| jak dobrać bezpiecznik do sprzętu audio | no | Grimm Audio LS1 i MU1 – minimum sprzętu, maksimum muzyki |
| kolumny z diamentową kopułką | yes | USHER SD-501 i SD-502 – kolumny podłogowe z diamentową kopułką DMD |
| źródła cyfrowe z Nowej Zelandii | yes | Nowa marka referencyjnych źródeł cyfrowych Oladra z Nowej Zelandii w ofercie Audiofast |
| audio video show relacja 2022 | yes | Refleksje po Audio Video Show 2022 |
| wzmacniacz lampowy | n/a | STROMTANK w ofercie AUDIFOAST |
| przepis na zupę pomidorową | n/a | Grimm Audio LS1 i MU1 – minimum sprzętu, maksimum muzyki |

The conceptual fuse-selection query missed the title-derived fuse article in the top five. The unrelated tomato-soup query still returned audio articles, so irrelevant queries already do not reliably produce an empty state on the old backend. Compare the new backend without imposing a guessed numeric threshold.

Next: replay these fixtures after enablement, add category/year permutations, review top results and any missing relevant document, and replace or augment synthetic inputs with actual search analytics if available. The current 25-article corpus cannot reproduce >50 candidate starvation, so that edge case needs a controlled fixture.

[Machine-readable inputs and results](legacy-query-baseline.json) · [Live verification](live-verification.md)
