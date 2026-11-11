# dmaiwebsite verification map

This directory is the source for what a visitor can do on the page. Read this index, then the matching feature file.

## Baseline preconditions

- Launch with `.cursor/skills/verify-dmaiwebsite/scripts/launch.sh`.
- Doctor must print `READY` for the pid that launch recorded.
- Chromium at 1440x900. Do not drive a server this run did not start.
- No login and no seed data. The page is the whole product.
- A dev server on port 5173, if one is already running, is not this run. Leave it alone.
- Scroll snap stays on for a normal visit. The driver turns it off only after it has recorded the snap, and only inside the page it opened.

## Driving conventions

- Start from the top of the page unless the feature file says otherwise.
- Prefer the accessible names in the feature file. Experience, Projects, and the footer slot have no accessible name; use the selectors in those files.
- Run one feature with `.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs <feature>`.
- Leave proof files in place during cleanup.

## Proof and skip reporting

- Record the action and the resulting state. The JSON file is that record. The PNG is the matching frame.
- Keep `artifacts/verify-dmaiwebsite/`.
- Name the feature id in the note you attach to the proof.
- If a path cannot be reached, record the command and the missing precondition. Do not mark it verified through a different path.

## Feature entry contract

Each feature file has an H1, one paragraph, then these H2 sections in order.

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with Playwright`
4. `Gotchas`

## Features

- [Hero](./hero.md) covers the greeting, the three figures, scroll tuck, reduced motion, and the contact links.
- [About](./about.md) covers the fade from the hero into the About copy and photo, including reduced motion. `edges.mjs` checks the cutout against the bottom ink.
- [Experience](./experience.md) covers the empty Experience stage.
- [Projects](./projects.md) covers the empty Projects stage.
- [Footer](./footer.md) covers the empty fixed footer.
