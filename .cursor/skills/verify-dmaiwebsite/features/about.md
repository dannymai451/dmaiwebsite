# About

About fades in as its top edge moves from near the bottom of the viewport to near the top. Reduced motion shows About at full opacity the whole time.

## Sub-features

- `about-fade` is transparent when the section top is at 96% of the viewport, about half visible at 57%, and fully visible at 18% and higher.
- `about-copy` shows the heading `ABOUT ME` and one paragraph once the section is on screen.
- `about-reduced` keeps opacity at 1, including at the 96% position where the fade would otherwise be transparent.

## How to get to it (user POV)

- Open the site and scroll until the About frame fills the screen.
- The hero is the only screen above About.

## Driving it with Playwright

Preconditions:

- Doctor passed for `http://127.0.0.1:5199/`.
- Viewport is 1440x900.
- Scroll snap is off for this page.

- **Fade.** Run `npm run test:e2e`. In `motion.json`, the `about` rows are opacity 0 at 0.96, 0.5 at 0.57, and 1 at 0.18.
- **Copy.** After the 18% position, the heading `ABOUT ME` is visible and the paragraph begins `I'm a software engineer interested in ai`.
- **Reduced motion.** In `motion-reduced.json`, `aboutAt96` is 1.
- **Proof.** Keep `about-top-96.png`, `about-top-57.png`, `about-top-18.png`, `reduced-about-top-96.png`, and `reduced-about-top-18.png`.

## Gotchas

- At the 96% position the heading is still below the fold. The screenshot shows the hero. The opacity number is the proof. Use `about-top-18.png` to see the section.
- Read the rendered opacity of `#about-title` (the element times each ancestor). The heading's own computed opacity stays 1 while a wrapper fades.
- `scroll-snap-align: start` is on the About section. At 1440x900 with snap left on, the 96% target returns to the top of the page and the 18% target snaps to the About start. The 57% target stays. Turn snap off, or those two opacity checks measure the wrong place.
- The photo and the paragraph are one unit. Fading the heading's rendered opacity is the check that the section faded.
