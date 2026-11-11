# About

About fades in as its top edge moves from near the bottom of the viewport to the top of the viewport. The heading, the paragraph, and the photo are one unit. Reduced motion shows About at full opacity the whole time, including while it is still below the fold.

## Sub-features

- `about-fade` is transparent when the section top is at 96% of the viewport, about 0.35 at 57%, about 0.92 at 18%, and fully opaque when the section top reaches the top of the viewport.
- `about-copy` shows the heading `ABOUT ME`, the paragraph that begins `I'm a software engineer interested in ai`, and the photo `Danny holding a pastry`.
- `about-snap` does not hold an 18% target. That scroll lands on the About start, where the section is already fully opaque.
- `about-reduced` keeps opacity at 1, including at the 96% position.

## How to get to it (user POV)

- Open the site and scroll until the About frame fills the screen.
- The hero is the only screen above About. The next screen is the empty Experience stage.

## Driving it with Playwright

Preconditions:

- Doctor printed `READY` for `http://127.0.0.1:5199/`.
- Viewport is 1440x900.
- The heading `ABOUT ME` is in the document. No extra seed data is required.

From the repo root:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs about
```

The command exits 0 only when all of the following are true.

- **Snap.** With snap still on, a scroll that aims for About's top at 18% of the viewport lands within 0.02 of 0, and the rendered opacity is above 0.97. `about-snap-18.png` shows About, not the 18% position. `about.json` records `trapped`.
- **Fade.** After computed `scroll-snap-type` is `none`, these landed positions pass:

  | Section top | Opacity band | Frame |
  | --- | --- | --- |
  | 96% | 0 to 0.08 | `about-top-96.png` |
  | 57% | 0.30 to 0.42 | `about-top-57.png` |
  | 18% | 0.86 to 0.96 | `about-top-18.png` |
  | 0% | 0.97 to 1.01 | `about-top-0.png` |

- **Copy.** At the 0% position the heading is `ABOUT ME`, the paragraph is `I'm a software engineer interested in ai, automating tedious work, and solving tough problems. I enjoy bringing ideas to life, making people's days a little easier, and learning with other curious minds.`, and `Danny holding a pastry` intersects the viewport. `/me.webp` returned 200.
- **Reduced motion.** With `prefers-reduced-motion: reduce` and snap turned off, opacity stays above 0.92 at both 96% and 0%. The frames are `reduced-about-top-96.png` and `reduced-about-top-0.png`.
- The URL stays `http://127.0.0.1:5199/`. There is no console error and no page error.

## Gotchas

- The fade runs from section top at 96% to section top at 0%, with a sine in-out. It does not finish at 18%. A reading of 1.0 at 18% means the scroll snapped to the section start, or the tween end moved. The 18% band rejects both a fully hidden section and a fully opaque one.
- At 96% the heading is still below the fold. `about-top-96.png` shows the hero. The opacity number is the proof. Use `about-top-0.png` to see the section. `reduced-about-top-96.png` has the same framing problem: the section is opaque and still off screen.
- Read the rendered opacity of `#about-title`. The heading's own computed opacity stays 1 while `.about-reveal` fades.
- `npm run test:e2e` still requires opacity at or above 0.92 at 18%. A measured run of this page is 0.9157, so that test fails. This journey is the pass signal. Do not lower the 18% band to make the old suite and this file agree, and do not edit the suite from here.
- The photo and the paragraph fade with the heading. Checking only that the nodes exist at the top of the document does not prove the fade.
