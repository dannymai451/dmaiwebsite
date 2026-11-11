# dmaiwebsite verification map

This directory is the maintained source for verifying what a visitor can do on the page. Read this index, then use the matching feature file.

## Baseline preconditions

- Launch with `npm run dev -- --host 127.0.0.1 --port 5199 --strictPort`.
- Doctor must show HTTP 200, `id="root"`, and a vite command line that contains `5199`.
- Use Chromium at 1440x900. Do not drive a server this run did not start.
- No login and no seed data. The page is the whole product.
- The motion spec turns scroll snap off inside the page it drives. A manual scroll check has to do the same, or the scroll will not stay put.

## Driving conventions

- Start from the top of the page unless the feature file says otherwise.
- Prefer the accessible names in the feature file over element position.
- Run the motion suite with `npm run test:e2e` for the hero and About.
- For a section the suite does not cover, drive it in the same Chromium session and record the command you ran.
- Leave proof files in place during cleanup.

## Proof and skip reporting

- Record the action and the resulting state.
- UI proof is a screenshot plus the number you asserted (opacity or how much of a figure sits below the viewport).
- Keep `artifacts/verify-dmaiwebsite/`, `playwright-report/`, and `test-results/`.
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
- [About](./about.md) covers the fade-in and reduced motion.
- [Experience](./experience.md) covers the empty Experience stage.
- [Projects](./projects.md) covers the empty Projects stage.
- [Footer](./footer.md) covers the empty fixed footer.
