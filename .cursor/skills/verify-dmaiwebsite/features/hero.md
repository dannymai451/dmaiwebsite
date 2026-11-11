# Hero

The hero greets the visitor, then three figures rise along the bottom edge. Scrolling the hero lowers those figures until they are gone. Reduced motion shows the settled hero immediately, and scrolling still lowers the figures.

## Sub-features

- `hero-fade` fades the greeting and the contact links from transparent to opaque.
- `hero-pop` brings in the blue, yellow, and red figures one after another, then leaves each about 30% below the bottom edge.
- `hero-tuck` lowers the figures as the hero scrolls away. At a quarter of the hero they are about 65% below the edge. At half they are fully below it.
- `hero-reduced` shows the opaque greeting and the settled figures immediately, and `hero-tuck` still applies.
- `hero-contact` offers GitHub, LinkedIn, and Email.

## How to get to it (user POV)

- Open the site. The hero is the first screen.
- Scroll down to tuck the figures. Scroll back to the top to see them settled again.

## Driving it with Playwright

Preconditions:

- Doctor passed for `http://127.0.0.1:5199/`.
- Viewport is 1440x900.
- Scroll snap is off for this page. The motion spec does that itself.

- **Run the suite.** From the repo root, run `npm run test:e2e`. The test named `hero fades in, figures tuck on scroll, and about fades in` passes, and `motion.json` shows greeting opacity moving from 0 to 1, a stagger gap of at least 0.15, and hidden fractions about 0.30, 0.65, and 1.00.
- **Reduced motion.** The test named `reduced motion is settled immediately, still tucks, and about stays visible` passes. `motion-reduced.json` shows greeting opacity 1 and hidden fraction 0.30 within the first fraction of a second, then 0.30, 0.65, and 1.00 as the hero scrolls.
- **Contact links.** In the same page, `getByRole('link', { name: 'GitHub' })` has href `https://github.com/dannymai451`, `LinkedIn` has href `https://www.linkedin.com`, and `Email` has href `mailto:dannymai451@gmail.com`. Do not follow the links.
- **Proof.** Keep `hero-greeting-early.png`, `hero-settled.png`, `hero-scroll-0.png`, `hero-scroll-25.png`, `hero-scroll-50.png`, `reduced-hero.png`, and `reduced-hero-scroll-50.png`.

## Gotchas

- The greeting's own computed opacity stays 1. The fade is on the block that wraps the greeting and the links. Multiply ancestor opacities.
- The figures are `position: fixed` to the viewport bottom. Scrolling does not move them except through the tuck. Measure the box, not a CSS variable.
- `scroll-snap-type: y proximity` is on for a normal visit. At 1440x900, a scroll to 25% of the hero returns to 0. A scroll to 50% stays. Turn snap off anyway, then check the scroll actually landed, or the 25% sample is the top of the page.
- The three images are named `Blue hoptimist`, `Yellow hoptimist`, and `Red hoptimist`. The blue one leads the pop.
- Following a contact link leaves the site. The proof is the href.
