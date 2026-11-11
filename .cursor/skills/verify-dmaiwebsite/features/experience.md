# Experience

Experience is a blank stage between About and Projects. A visitor can scroll to it. It has no jobs, dates, or other copy.

## Sub-features

- `experience-present` puts an empty full-viewport stage in the page after About.

## How to get to it (user POV)

- Scroll past About. The next full screen is Experience.
- There is no heading to click and no control on the stage.

## Driving it with Playwright

Preconditions:

- Doctor printed `READY` for `http://127.0.0.1:5199/`.
- About is already in the document. Experience has no seed rows to load.

From the repo root:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs experience
```

The command exits 0 only when all of the following are true.

- **Reach the stage.** `section.experience` scrolls so its top is within 2px of the viewport top, and the section is at least 800px tall.
- **Empty.** The section's text is empty and it contains no heading.
- **Proof.** `experience.png` is that viewport. `experience.json` records the text, the heading count, and the landed top.
- There is no console error and no page error.

## Gotchas

- A check that expects job titles, dates, or company names fails because that copy is not in the section. Report that failure. Do not skip the section and call a different screen verified.
- The section has no accessible name. `section.experience` is the handle. `npm run test:e2e` never scrolls here, and a passing hero or About run does not prove this stage.
- The stage uses scroll-snap alignment. The driver turns snap off, then checks the top actually landed. With snap left on, a nearby scroll can still pull to this section's start, which is the same place.
