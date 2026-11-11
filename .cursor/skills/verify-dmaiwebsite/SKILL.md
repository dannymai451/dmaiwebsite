---
name: verify-dmaiwebsite
description: Drive the dmaiwebsite page in Chromium and prove the hero intro, figure tuck, and About fade. Use when changing motion or scroll, or when asked to verify the site.
---

# Verify dmaiwebsite

The site is one scrolling page. A visitor sees a greeting, three figures along the bottom, then an About section that fades in. Experience, Projects, and the footer are empty shells. There is no router, no account, and no database.

Drive only an instance this run started on port 5199. Leave a dev server on port 5173 alone.

## Launch

Install once from the repo root.

```bash
npm install
npx playwright install chromium
```

Install Chromium only. Do not install Firefox or WebKit.

Start the site with the repo's dev script and record the pid.

```bash
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort
```

Ready when the log prints `Local:` with `http://127.0.0.1:5199/` and the doctor check below returns 200. There is no seed step. The page is usable when that URL serves the document that contains `id="root"`.

`npm run test:e2e` starts the same command when nothing is already answering on 5199, and reuses the server when this section already started it.

## Doctor

Run this before the first drive, and again after a failed drive, before you retry.

```bash
curl -sf -o /tmp/dmaiwebsite-doctor.html -w '%{http_code}\n' http://127.0.0.1:5199/
grep -q 'id="root"' /tmp/dmaiwebsite-doctor.html && echo root-ok
pid=$(lsof -tiTCP:5199 -sTCP:LISTEN | head -1)
echo "pid=$pid"
tr '\0' ' ' < /proc/$pid/cmdline; echo
```

Drive only when every line is true.

- The status is `200`.
- `root-ok` printed.
- `cmdline` contains both `vite` and `5199`.

If the port is closed, launch again. If the pid is not this run's vite, stop. Do not drive it.

On a healthy server, `src/index.css` sets `scroll-snap-type: y proximity` on `html`. Chromium's computed value is `y`, because `proximity` is the default strictness and the computed style omits it. Check that only when you need to confirm the snap override still has a reason.

```bash
node --input-type=module -e "
import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5199/')
console.log(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType))
await browser.close()
"
```

Expect `y`. A value of `y mandatory` means the stylesheet changed. At 1440x900, `window.scrollTo(0, heroHeight * 0.25)` does not stay there while snap is on. It stays after the page sets `scroll-snap-type` to `none`.

## Drive

Run the motion suite from the repo root. It opens Chromium at 1440x900.

```bash
npm run test:e2e
```

`npx playwright test` is the same command. The suite is `e2e/motion.spec.js`.

`html` uses `scroll-snap-type: y proximity`, and the hero, About, and footer slot use `scroll-snap-align: start`. Chromium reports the computed value as `y`. At 1440x900 with snap left on, three samples do not land. Hero scroll 225px (25% of the hero) returns to 0. About top at 96% (36px) returns to 0. About top at 18% (738px) snaps to the About start at 900px, so the top fraction becomes 0. Hero scroll 450px (50%) and About at 57% (387px) stay. Those two samples are not enough. The 25% sample is the middle of the tuck curve. The stolen About samples would report opacity 0 and opacity 1 at the wrong scroll. The spec injects `html { scroll-snap-type: none !important }` after load, then requires the computed value `none` and a landed scroll within 0.02 of the target. Leave the product CSS alone.

Read what a visitor can see.

- Greeting opacity is the product of computed opacity from `.hero-intro` through its ancestors. A child's own computed opacity stays 1 when a parent is faded.
- Figure tuck is `(rect.bottom - innerHeight) / rect.height` on each `.hero-hoptimists img`. 0.30 means about 30% of the figure sits below the viewport. 1 means it is fully below.
- About opacity is that same product on `#about-title`.

Do not read animation-library state, CSS variable values, or timeline settings. The spec's pass bands are the contract.

| Moment | Pass band |
| --- | --- |
| Greeting, earliest sample | below 0.25 |
| Greeting, at 3s after the intro exists | above 0.92 |
| Figures after the intro, and at 0% of the hero height | 0.22 to 0.40 |
| Figures at 25% of the hero height | 0.55 to 0.75 |
| Figures at 50% of the hero height | 0.90 to 1.08 |
| About, section top at 96% of the viewport | 0 to 0.12 |
| About, section top at 57% of the viewport | 0.35 to 0.65 |
| About, section top at 18% of the viewport | 0.92 to 1.01 |

During the pop, the last figure is more hidden than the first by at least 0.15 at some sample. That is the stagger.

With `prefers-reduced-motion: reduce`, from 80ms to 400ms after the intro exists, the greeting stays above 0.9 and the figures stay in the 0.22 to 0.40 band. Scroll tuck still uses the three hero rows. About opacity at the 96% position stays above 0.92.

The bands have a gap on purpose. A figure stuck at 0.30 cannot pass the 25% or 50% row. About stuck at 0 or at 1 cannot pass all three rows.

Handles, in DOM order: heading `Hey! I'm Danny`, images `Blue hoptimist`, `Yellow hoptimist`, `Red hoptimist`, nav `Contact`, links `GitHub`, `LinkedIn`, `Email`, `section.about`, `#about-title`, `section.experience`, `section.projects`, `footer.foot`.

Drive one feature from `features/` when you are not running the whole suite. The motion spec covers the hero and About, including reduced motion. Experience, Projects, and the footer have no spec. Follow their feature files and stop when the file says the section is empty.

## Evidence

Write proof under `artifacts/verify-dmaiwebsite/`. The motion spec writes these files itself.

- `hero-greeting-early.png` during the fade, figures still down
- `hero-settled.png` after the intro
- `hero-scroll-0.png`, `hero-scroll-25.png`, `hero-scroll-50.png`
- `about-top-96.png`, `about-top-57.png`, `about-top-18.png`
- `reduced-hero.png`, `reduced-hero-scroll-50.png`, `reduced-about-top-96.png`, `reduced-about-top-18.png`
- `motion.json` and `motion-reduced.json` with the numbers the assertions used

Also keep `playwright-report/index.html` and `test-results/**/trace.zip`.

A correct run shows hidden fractions 0.30, 0.65, and 1.00 at the three hero scrolls, and About opacity 0, 0.5, and 1 at 96%, 57%, and 18%. Reduced motion shows greeting 1, figures 0.30, and About opacity 1 at the 96% position. Compare a new run to those values. The pass bands above are wider than one clean run, because a pixel of layout error should still pass.

At the 96% About position the title is still below the fold. `about-top-96.png` shows the hero. The opacity number is the proof there. `about-top-18.png` shows the section on screen. The same split holds for the reduced-motion pair.

Capture the action and the resulting state. The JSON rows are the state. The screenshots are the matching frames. Do not mock the page. Do not call internal setters. There is no test-only endpoint.

The suite fails the run on any console error or page error.

## Cleanup

Stop only the vite pid this run started.

```bash
kill "$pid"
```

Wait until `lsof -tiTCP:5199 -sTCP:LISTEN` prints nothing. If `npm run test:e2e` started the server itself, it already stopped that process. Confirm the port is closed anyway.

Do not kill by process name. Do not delete `artifacts/verify-dmaiwebsite/`, `playwright-report/`, or `test-results/`. Those files are the proof.

## Helpers

The helper is the Playwright spec.

```bash
npm run test:e2e
```

Feature recipes live in `features/`. Read `features/README.md` before a drive that is not the motion suite.
