# Projects

Projects is a blank stage after Experience. A visitor can scroll to it. It has no project names, links, or descriptions.

## Sub-features

- `projects-present` puts an empty full-viewport stage in the page after Experience.

## How to get to it (user POV)

- Scroll past Experience. The next full screen is Projects.
- There is no card, title, or link to activate.

## Driving it with Playwright

Preconditions:

- Doctor printed `READY` for `http://127.0.0.1:5199/`.
- Experience is already in the document. Projects has no seed rows to load.

From the repo root:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs projects
```

The command exits 0 only when all of the following are true.

- **Reach the stage.** `section.projects` scrolls so its top is within 2px of the viewport top, and the section is at least 800px tall.
- **Empty.** The section's text is empty and it contains no heading.
- **Proof.** `projects.png` is that viewport. `projects.json` records the text, the heading count, and the landed top.
- There is no console error and no page error.

## Gotchas

- A check that expects project titles or links fails because that copy is not in the section. Report that failure. Do not treat the empty box as a pass for content that is not there.
- The section has no accessible name. `section.projects` is the handle. `npm run test:e2e` never scrolls here.
- The stage uses scroll-snap alignment. The driver turns snap off, then checks the top actually landed.
