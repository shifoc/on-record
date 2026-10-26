# Music discovery

The user requested music outside their export. Preserve the app's browser only, no network, no persistence constraints by choosing explainable starting songs locally and opening Spotify only on an explicit click. Spotify supplies new catalog music through its documented Go to Radio menu; the app cannot verify that Spotify's suggestions are unheard. Do not label seed songs as new recommendations.

- [x] Test and implement pure discovery seed ranking, skip exclusions, deterministic ties, recent calendar window, supplied filters and safe Spotify URLs.
- [x] Add favorites, recent taste and side road routes to a chapter in the launcher, desktop page, tour and phone deck. Use generated covers and explicit user paced controls. Disable outgoing music links for the fictional demo.
- [x] Verify 360 by 600, real local ZIP without outbound requests, external link destinations without following private links, sparse states, filter reset, lint, tests, timezone tests and build. Update the existing feature PR.

Rules: Count music starts of at least 30 seconds. Exclude artists or representative songs skipped more than half the time. Recent means the 90 local calendar dates ending on the last qualifying play in the selected period. Side roads exclude the three leading eligible artists and need at least three counted plays. A starting song is the artist's most listened eligible song. Keep selections until the existing view key changes. Validate Spotify track URIs before constructing links; encode all fallback search terms.

Reference: [Spotify Radio](https://support.spotify.com/sb/article/spotify-radio/).

Validation: lint, all 243 tests, non UTC tests and production build pass. The ignored ZIP works locally without external requests; no private screenshots or exported fixtures were saved. All routes fit 360 by 600, including synthetic long names. Route selections persist and reset on year changes. Spotify links are verified by destination without opening personal links. The demo has no fake music links. Independent review found no actionable issues. React Doctor stays at 78; the production build retains its existing bundle warning.
