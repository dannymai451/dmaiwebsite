# Projects

Projects is a blank stage after Experience. A visitor can scroll to it. It has no project names, links, or descriptions.

## Sub-features

- `projects-present` puts an empty stage in the page after Experience.

## How to get to it (user POV)

- Scroll past Experience. The next full screen is Projects.

## Driving it with Playwright

Preconditions:

- Doctor passed for `http://127.0.0.1:5199/`.
- Experience is already reachable.

- **Reach the stage.** In the open page, find `section.projects` and scroll it to the top of the viewport. The section's box is in the document and has no heading.
- **Proof.** Screenshot the viewport. The shot shows the empty stage, not a list of projects.

## Gotchas

- A check that expects project titles or links fails because that copy is not in the section. Report that failure. Do not treat the empty box as a pass for content that is not there.
- The motion spec does not open this section. `npm run test:e2e` passing does not prove Projects.
- The stage uses scroll-snap alignment. Snap can pull the scroll to the section start.
