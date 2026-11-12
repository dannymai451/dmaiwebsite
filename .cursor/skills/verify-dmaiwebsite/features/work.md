# Work

Work + Projects is the stage after About. One frame holds the day job and the fun projects. The copy is still placeholder text Danny can replace in one data object.

## Sub-features

- `work-present` shows the heading `WORK + PROJECTS`, the day-job card, the sticky note, and two project cards.
- `work-layout` keeps every card, tape, pin, and line of text inside the frame at phone, iPad, and desktop widths, with fonts loaded and while fonts are still loading. `work-layout.mjs` is that check.

## How to get to it (user POV)

- Scroll past About. The next screen is Work + Projects.
- There is one stage, not a separate Experience screen and a separate Projects screen.
- The words `live` and `github` read as links. They do not go anywhere until a real address is filled in.

## Driving it with Playwright

Preconditions:

- Doctor printed `READY` for `http://127.0.0.1:5199/`.
- Viewport for `drive.mjs` is 1440x900. The layout sweep uses its own widths.

From the repo root:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs work
.cursor/skills/verify-dmaiwebsite/scripts/work-layout.mjs
```

`drive.mjs work` exits 0 only when all of the following are true.

- **Reach the stage.** `section.work` scrolls so its top is within 2px of the viewport top, and the section is at least 800px tall.
- **Copy.** The heading is `WORK + PROJECTS`. The section text includes `the day job`, `[ team photo ]`, `[Company]`, `[role]`, `[25 - now]`, `FULL-TIME`, `what I do`, `[thing you build]`, `[impact / number]`, `[team or stack]`, `stuff I made for fun`, `[ app screenshot ]`, `[Project 1]`, `[what it does, 1 line]`, `[ demo gif ]`, `[Project 2]`, and `more coming soon...`. The words `live` and `github` each appear twice.
- **No destinations yet.** The section contains no anchors.
- **One heading.** The section has one heading.
- **Proof.** `work.png` is that viewport. `work.json` records the heading, the text, the heading count, the anchor count, and the landed top.
- There is no console error and no page error.

`work-layout.mjs` exits 0 only when Chromium and WebKit both pass at 320x568, 375x812, 390x844, 430x932, 768x1024, 1024x768, and 1440x900, once with Caveat loaded and once while the font request is still pending. A pass means the document does not scroll horizontally, text does not overlap other text, polaroids do not overlap each other, and no text, tape, or pin crosses the inner edge of the frame. Tape and pins may overlap the top of their own polaroid. Phones stack the day job above the projects. Widths 768 and up keep the two columns side by side.

## Gotchas

- The old empty stages are gone. `section.experience` and `section.projects` are not in the page.
- Placeholder brackets are the real copy. A check that wants a company name or a project URL fails because that copy is not in the section.
- `npm run test:e2e` never scrolls here. A passing hero or About run does not prove this stage.
- The stage uses scroll-snap alignment. The driver turns snap off, then checks the top actually landed.
