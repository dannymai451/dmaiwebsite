# Experience

Experience is a blank stage between About and Projects. A visitor can scroll to it. It has no jobs, dates, or other copy.

## Sub-features

- `experience-present` puts an empty stage in the page after About.

## How to get to it (user POV)

- Scroll past About. The next full screen is Experience.

## Driving it with Playwright

Preconditions:

- Doctor passed for `http://127.0.0.1:5199/`.
- About is already reachable.

- **Reach the stage.** In the open page, find `section.experience` and scroll it to the top of the viewport. The section's box is in the document and has no heading.
- **Proof.** Screenshot the viewport. The shot shows the empty stage, not a list of jobs.

## Gotchas

- A check that expects job titles, dates, or company names fails because that copy is not in the section. Report that failure. Do not skip the section and call a different screen verified.
- The motion spec does not open this section. `npm run test:e2e` passing does not prove Experience.
- The stage uses the same scroll-snap alignment as the hero. Snap can pull the scroll to the section start.
