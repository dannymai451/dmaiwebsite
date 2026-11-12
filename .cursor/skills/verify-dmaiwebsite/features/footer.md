# Footer

The footer is a fixed layer behind the page. A tall empty slot at the end of the scroll brings that layer into view. The layer has no links and no text. The contact links stay in the hero.

## Sub-features

- `footer-present` reserves a full-viewport slot after Work and shows an empty fixed footer behind the page.

## How to get to it (user POV)

- Scroll to the bottom of the page. The last full screen is the footer.
- There is nothing to click. GitHub, LinkedIn, and Email are in the hero, not here.

## Driving it with Playwright

Preconditions:

- Doctor printed `READY` for `http://127.0.0.1:5199/`.
- Work is already in the document. The footer has no seed links to load.

From the repo root:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs footer
```

The command exits 0 only when all of the following are true.

- **Reach the slot.** `.foot-slot` scrolls so its top is within 2px of the viewport top.
- **Empty landmark.** `getByRole('contentinfo')` has no text and no links.
- **Contact stays in the hero.** The navigation named `Contact` still has 3 links, and the URL is still `http://127.0.0.1:5199/`.
- **Proof.** `footer.png` is that viewport. `footer.json` records the text, the footer link count, the contact link count, and the landed slot top.
- There is no console error and no page error.

## Gotchas

- The footer is `position: fixed` and painted under `.page`. At the top of the document its box already covers the viewport, hidden behind the page. Scroll `.foot-slot`. A screenshot taken at scroll 0 shows the hero, not the footer.
- A check that expects footer links fails because the links are not there. Report that failure. The three contact links in the hero are not a substitute.
- `.foot-slot` is `aria-hidden`. It is not the landmark. The landmark is the `contentinfo` footer.
- `npm run test:e2e` does not scroll to the footer.
- The slot uses scroll-snap alignment. The driver turns snap off, then checks the top actually landed. The slot's start is the bottom of the page, so snap pulls toward this same place.
