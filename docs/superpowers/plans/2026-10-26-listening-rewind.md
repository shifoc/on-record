# Listening Rewind Implementation Plan

**Goal:** Add a personal, interactive Wrapped style recap to the existing guided experience.

**Architecture:** Pure aggregation in `src/data/rewind.ts`, rendered by `src/components/Rewind.tsx` as five user paced pages. Dashboard supplies filtered selected plays and filtered all time context. Existing React, CSS tokens, local date helpers and canvas utilities suffice; no new dependencies.

**Approved scope:** Headline recap, previous calendar year comparisons, discoveries, comebacks, monthly soundtracks, plus a downloadable summary image. This implements the direction approved in chat on October 26.

**Constraints:** Browser only; no requests or persistence. Real exports remain ignored and never enter fixtures. At least 30 seconds for recap music plays, local playback start dates, deterministic ties, no global popularity or mood claims. Fit the phone deck at 360 by 600. Reset retained selection with `viewKey`.

## Tasks

- [x] Add tests for empty and podcast only histories, counting thresholds, local year boundaries, new versus known artists, returning discoveries, 90 day comeback qualification, scoped return evidence, quiet months, deterministic ties and previous calendar year comparisons.
- [x] Implement `buildRewind(plays: Play[], all: Play[], year: number | null): Rewind` with shared music ranking and month aggregates. Run the new tests first failing, then passing.
- [x] Build five pages with explicit Previous and Next controls, numbered page buttons, month selector, evidence and sparse history states. Add a canvas recap download. Integrate a new chapter in Dashboard, track navigation, launcher and Tour.
- [x] Update README. Run lint, full tests, non UTC tests and build. Exercise demo and the ignored ZIP locally, inspect desktop and phone layouts, and review the diff for privacy and counting errors.

## Review focus

Partial years must not read as equal coverage. First observed artist is not necessarily a life discovery. A long silence without repeat listening is not a comeback. Quiet months must remain visible. A selected year must not leak listening from another year into totals or comeback evidence.

## Validation

236 tests pass in the local zone and Pacific/Auckland; lint, build and production dependency audit pass. Tested the ignored ZIP locally without remote requests or uploads. Verified all five phone pages at 360 by 600, retained selections, guess reveal and PNG download. Reviewed the exported demo image. React Doctor remains at the baseline score of 78, with two view complexity warnings. Final independent review found a phone export error visibility issue, repaired with an explicit retry label. The production build retains its existing large bundle warning.
