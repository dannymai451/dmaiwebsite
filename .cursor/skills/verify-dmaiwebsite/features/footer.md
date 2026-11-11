# Footer

The footer is a fixed layer behind the page. A tall empty slot at the end of the scroll brings that layer into view. The layer has no links and no text.

## Sub-features

- `footer-present` reserves a full-viewport slot after Projects and shows an empty fixed footer behind the page.

## How to get to it (user POV)

- Scroll to the bottom of the page. The last full screen is the footer.

## Driving it with Playwright

Preconditions:

- Doctor passed for `http://127.0.0.1:5199/`.
- Projects is already reachable.

- **Reach the slot.** In the open page, find `.foot-slot` and scroll it to the top of the viewport. `footer.foot` is in the document and has no links.
- **Proof.** Screenshot the viewport. The shot shows the empty footer, not a contact row. The contact links are in the hero.

## Gotchas

- The footer is `position: fixed` behind the scrolling page. Looking for it in normal flow at the top of the document misses it. Scroll the slot.
- A check that expects footer links fails because the links are not there. Report that failure.
- The motion spec does not scroll to the footer. `npm run test:e2e` passing does not prove the footer.
- `.foot-slot` uses scroll-snap alignment. Snap can pull the scroll to the slot.
