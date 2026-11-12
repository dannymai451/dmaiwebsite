# Hero

The hero greets the visitor, then three figures hop up along the bottom edge, blue, then yellow, then red. Each one springs past its rest position and bounces across it, each pass smaller than the last, then settles about 30% below the edge. Scrolling the hero lowers those figures until they are gone. With the page's scroll snap left on, a small scroll springs back to the top. Reduced motion shows the settled hero immediately, and scrolling still lowers the figures.

## Sub-features

- `hero-fade` fades the greeting and the contact links from transparent to opaque.
- `hero-pop` brings in the blue figure, then the yellow, then the red. Each figure starts 0.24s after the one before it, rises, springs past rest, and crosses rest again with each crest and trough smaller than the one before. It settles about 30% below the bottom edge.
- `hero-snap` sends a scroll of 25% of the hero back to the top at 1440x900.
- `hero-tuck` lowers the figures as the hero scrolls. At a quarter of the hero they are about 65% below the edge. At half they are fully below it. With snap left on, the quarter scroll returns to the top, so that sample is taken after snap is off.
- `hero-reduced` shows the opaque greeting and the settled figures immediately, and `hero-tuck` still applies.
- `hero-contact` offers GitHub, LinkedIn, and Email. The proof is the href. The links are not followed.

## How to get to it (user POV)

- Open the site. The hero is the first screen.
- Scroll down to tuck the figures. A short scroll snaps back to the greeting. A longer scroll holds and the figures leave the screen.
- Scroll back to the top to see them settled again.

## Driving it with Playwright

Preconditions:

- Doctor printed `READY` for `http://127.0.0.1:5199/`.
- Viewport is 1440x900.

From the repo root:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs hero
```

The command exits 0 only when all of the following are true.

- **Fade.** The greeting block's rendered opacity (its own opacity times each ancestor) starts below 0.25 and is above 0.92 by 3 seconds. `hero-greeting-early.png` is the early frame. `hero-settled.png` is the settled frame.
- **Pop.** While the greeting is already above 0.85, the red figure is at least 0.15 more hidden than the blue figure in some sample. After 3 seconds each figure's hidden fraction is between 0.22 and 0.40. The images are named `Blue hoptimist`, `Yellow hoptimist`, and `Red hoptimist`.
- **Hop order.** `edges.mjs` records each figure's `translateY` on the fonts pass, including a `pointer: coarse` page at the same widths. Blue starts first, then yellow, then red. The two gaps fall between 0.18s and 0.30s. Each figure travels at least 2% of its height above the rest position, then settles within 1.25px of 30% of its height. After that first crest, a later crest still clears rest by at least 2.5% of the height, and each later crest is under 80% of the one before it. At the first crest the image top stays inside the 40px clip.
- **Snap.** With snap still on, scrolling to 25% of `section.hero` lands at 0. `hero-snap-25.png` matches the settled hero. `hero.json` records that landed fraction.
- **Tuck.** After the page's computed `scroll-snap-type` is `none`, scrolls to 0%, 25%, and 50% of the hero each land within 0.02 of the target. Hidden fractions fall in 0.22–0.40, 0.55–0.75, and 0.90–1.08. The screenshots are `hero-scroll-0.png`, `hero-scroll-25.png`, and `hero-scroll-50.png`.
- **Contact.** `getByRole('navigation', { name: 'Contact' })` has three links. GitHub is `https://github.com/dannymai451` and opens in a new tab. LinkedIn is `https://www.linkedin.com` and opens in a new tab. Email is `mailto:dannymai451@gmail.com` and stays in this tab. The URL is still `http://127.0.0.1:5199/`. The three `/hoptimist-*.webp` responses are 200.
- **Reduced motion.** A second page with `prefers-reduced-motion: reduce` stays above greeting opacity 0.9 and in the 0.22–0.40 figure band from 80ms to 400ms. The same three tuck rows then pass. `reduced-hero.png` and `reduced-hero-scroll-50.png` are the frames. `hero-reduced.json` holds the numbers.
- There is no console error and no page error.

## Gotchas

- The heading's own computed opacity stays 1. The fade is on `.hero-intro`. Multiply ancestor opacities, or a settled reading of the heading hides a fade that never ran.
- The figures are `position: fixed` to the viewport bottom. Scrolling does not move them except through the tuck. Measure the box. A CSS variable named `--tuck` or `--pop` is not the proof.
- At 1440x900 with snap left on, the 25% sample returns to 0 and the figures stay at about 0.30. The 50% sample stays and the figures are fully below the edge. Turn snap off before the 25% tuck sample, or that sample is a picture of the top of the page.
- Following a contact link leaves the site. LinkedIn points at the LinkedIn home page, which is the href in the product.
- The hero is 900px tall at this viewport. Hidden fractions of 0.30, 0.65, and 1.00 are the centers of the pass bands.
