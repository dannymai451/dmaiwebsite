---
name: verify-dmaiwebsite
description: >-
  Verify the dmaiwebsite single scrolling page in desktop Chromium.
  Use when changing the hero, About, Work, or footer,
  or when asked to prove the page, its scroll, or its motion.
---

# Verify dmaiwebsite

The only surface is one scrolling page at `/`. There is no router, account, database, or seed data. A visitor gets a hero, then About, a Work + Projects stage, and an empty fixed footer. `three`, React Three Fiber, and `paperlab` are dependencies, and none of them mounts a canvas on this page.

The repo's dev command is `npm run dev` (Vite, default port 5173). Verification uses port 5199 so it can sit beside that server. A normal dev server may already be listening on 5173. Leave it alone. Two app servers can run side by side on different ports. This skill will not start a second process on 5199 and will not drive a process it did not start.

Drive with Playwright's Chromium, headless, at 1440x900. Observe the rendered page: accessible names, scroll position, opacity multiplied through ancestors, and how much of each figure sits below the viewport. Do not read GSAP timelines or CSS variables.

## Launch

From the repo root:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/launch.sh
```

The script installs npm dependencies, installs Playwright's Chromium and WebKit, and starts:

```bash
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort
```

It records that process's pid in `/tmp/verify-dmaiwebsite/pid` and the log in `/tmp/verify-dmaiwebsite/dev.log`.

READY means the script prints `READY pid=<pid> url=http://127.0.0.1:5199/` and `doctor.mjs` has already exited 0. The heading `Hey! I'm Danny` is on screen at rendered opacity above 0.9, and the three figure images have decoded. An HTTP 200 document that only contains `id="root"` is not ready.

If 5199 is taken, or the recorded pid is still alive, the script exits 1 and does not start another server.

Teardown is `scripts/cleanup.sh` in the Cleanup section. Launch does not stop the server.

## Doctor

Run this before the first drive, and again after a failed drive, before you retry. It does not click, scroll, or start a server.

```bash
.cursor/skills/verify-dmaiwebsite/scripts/doctor.mjs
```

Drive only when it prints these lines and exits 0:

- `pid=` the pid from `/tmp/verify-dmaiwebsite/pid`, and that process is alive with `5199` in its command
- `listener=` the process listening on 127.0.0.1:5199
- `ancestor=ok` means the listener is that pid or a child of it
- `build=vite-dev` means the listener's command is Vite (not `vite preview`) and its cwd is this checkout
- `http=200` and `root=ok` mean `/` is the dev document: title `dmaiwebsite`, `id="root"`, `/src/main.jsx`, and `/@vite/client`
- `source=ok` means `/src/components/Hero.jsx` from this server contains `Hey! I'm Danny`
- `render=ok` means Chromium at 1440x900 laid out the heading, decoded the three figure images, and the greeting block's rendered opacity is above 0.9
- the last line is `READY`

If the port is closed, launch again. If the listener is not the recorded pid's process, stop. Do not drive it.

## Drive

Read `features/README.md`, then run one feature:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs hero
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs about
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs work
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs footer
```

The script opens Chromium at 1440x900 against `http://127.0.0.1:5199/`. Handles, in the page:

- heading `Hey! I'm Danny`
- navigation `Contact`
- links `GitHub`, `LinkedIn`, `Email`
- images `Blue hoptimist`, `Yellow hoptimist`, `Red hoptimist`
- heading `ABOUT ME`
- image `Danny holding a pastry`
- heading `WORK + PROJECTS`
- `.foot-slot`, then the footer as the `contentinfo` landmark

`html` uses `scroll-snap-type: y proximity`. Chromium reports the computed value as `y`. At 1440x900 the hero is 900px tall. A scroll to 25% of the hero returns to 0. A scroll that puts About's top at 18% of the viewport snaps to the About start. The 50% hero scroll and the 57% About scroll stay. The driver records the snap-back, then injects `html { scroll-snap-type: none !important }` and requires the computed value `none` before it samples the rest of the curve. Leave the product CSS alone.

Greeting opacity is the product of computed opacity from `.hero-intro` through its ancestors. Figure tuck is `(rect.bottom - innerHeight) / rect.height` on each `.hero-hoptimists img`. About opacity is that same product on `#about-title`.

`npm run test:e2e` is not this harness. `e2e/motion.spec.js` still requires About opacity at or above 0.92 when the section top is at 18% of the viewport. The tween now ends at `top 0%`, and that sample renders at about 0.916, so the first test fails. The reduced-motion test passes. Do not treat a red suite as the verdict, and do not change product code or the suite from this skill.

## Evidence

The driver writes proof to `artifacts/verify-dmaiwebsite/` in the repo. That directory is gitignored. Cleanup does not delete it.

A passing hero run writes:

- `hero-greeting-early.png` during the fade, figures still down
- `hero-settled.png` after the intro, contact links visible
- `hero-snap-25.png` after a 25% scroll snapped back to the top
- `hero-scroll-0.png`, `hero-scroll-25.png`, `hero-scroll-50.png`
- `reduced-hero.png`, `reduced-hero-scroll-50.png`
- `hero.json` and `hero-reduced.json` with the numbers the assertions used

A passing About run writes `about-snap-18.png`, `about-top-96.png`, `about-top-57.png`, `about-top-18.png`, `about-top-0.png`, `reduced-about-top-96.png`, `reduced-about-top-0.png`, `about.json`, and `about-reduced.json`. Work and the footer write `work.png`, `footer.png`, and a matching `.json`.

Hero numbers on a correct run: greeting opacity moves from below 0.25 to 1, the later figure trails the first by at least 0.15 during the pop, and the hidden fractions are 0.30, 0.65, and 1.00 at the three snap-off scrolls. With snap left on, the 25% scroll lands at 0. About, with snap off: opacity 0 at 96%, about 0.355 at 57%, about 0.916 at 18%, and 1 when the section top is at the top of the viewport. Reduced motion keeps the greeting at 1, the figures at 0.30 until the scroll tuck, and About at 1 even at 96%.

`about-top-96.png` shows the hero, because the title is still below the fold. The opacity number is the proof there. `about-top-0.png` shows About on screen. The same split holds for the reduced-motion pair: `reduced-about-top-96.png` is still the hero.

Each JSON file records the action and the resulting state: the scroll that was requested, where it landed, the opacity or hidden fraction, the final URL, image responses, and console errors. The screenshots are the matching frames. The contact check reads the hrefs and does not follow them. Work is proven by the heading `WORK + PROJECTS`, the placeholder copy, and the screenshot after scrolling that stage to the top. The footer is proven by an empty accessible name plus its screenshot. There is no test-only endpoint and no mocked network. The only injected style is the snap override, and the JSON's landed scroll shows whether a sample was taken at the position it claims.

The driver fails the run on any console error or page error.

## Phone bars

Desktop `drive.mjs` cannot see the phone-toolbar bugs. In this Playwright Chromium and WebKit, `100lvh`, `100dvh`, `100svh`, and `innerHeight` are one length, so `bottom: calc(100lvh - 100dvh)` computes to 0. Run this after any change to the hero anchor, on the same server:

```bash
npx playwright install webkit
.cursor/skills/verify-dmaiwebsite/scripts/phone-bars.mjs pass
```

`pass` exits 0 only when Chromium and WebKit both keep the row on the visible bottom with a 70% peek in four simulated conditions, and the desktop page at 1440x900 is still 315px tall with the figure top at 679.5. The script rewrites `100lvh`, `100dvh`, and `100svh` as each stylesheet is inserted. That is the viewport-unit override. It also lays a translucent bar over the page and replaces `visualViewport.offsetTop`.

1. Brave, solid toolbar. The visible viewport is 789px and `100lvh` is 844px, so `lvh - dvh` is 55px. The layout bottom is the visible bottom.
2. Safari, translucent toolbar. A 55px overlay sits on the bottom of an 844px viewport and the figures paint under it. The row stays on the screen bottom; the lower part of the heads shows through the bar.
3. Rubber-band. `visualViewport.offsetTop` is `-90`, and a scroll event is dispatched. The row does not move.
4. Scroll down to 40% of the hero, then back to the top. The row stays on the bottom while the tuck hides more of the figures. At the top, the peek is 70% again.

Evidence lands in `artifacts/verify-dmaiwebsite/phone-bars/`. `phone-bars.mjs fail-brave` is the harness check: with the `0b5947b` anchor served, it exits 0 only when that rule lifts the row by about 55px. Do not leave that CSS in the working tree.

## Edges

One script covers the greeting and the About photo. It does not start a server. `VERIFY_URL` overrides `http://127.0.0.1:5199/`.

```bash
.cursor/skills/verify-dmaiwebsite/scripts/edges.mjs
```

The greeting check opens WebKit, then Chromium, at 320, 375, 390, 393, 430, an iPad size of 768×1024, and 1440×900. Each width runs twice: once with Caveat loaded, and once with the Google Fonts request aborted so the fallback face is on screen. It waits until the greeting has faded in.

The measurement is the painted ink. The border is hidden for a second screenshot, the dark pixels of the greeting are found, and those pixels are compared with the inner edge of the border on the first screenshot. A case fails when that gap is under 26px on either side, when the contact links cross the white fill, or when a figure crosses the left or right of the viewport. The figures are meant to hang below the bottom edge.

The same case measures the font's ink box against the greeting's own padding edge. Caveat's y extends past the advance width, and WebKit drops that ink when it sticks out of the text box. A case fails when the ink extends more than half a pixel past the padding.

The About half is the photo meeting the stroke. Its pass rule is `about-tuck` in `features/about.md`. It uses Chromium and WebKit.

The script prints one line per case, writes `artifacts/verify-dmaiwebsite/edges/edges.json`, and exits 1 when any case fails. A blocked font request is not a page error.

## Cleanup

Stop only the pid launch recorded.

```bash
.cursor/skills/verify-dmaiwebsite/scripts/cleanup.sh
```

The script checks that the pid's command still contains `5199`, kills that process and its children, and waits until nothing is listening on 5199. It does not kill by process name. It does not touch port 5173. It removes `/tmp/verify-dmaiwebsite` and leaves `artifacts/verify-dmaiwebsite/` in place.

If `npm run test:e2e` started its own server because 5199 was free, that suite stops it. This skill's cleanup does not know that pid. Prefer launching first so the suite is not required.

## Helpers

All six scripts live in `.cursor/skills/verify-dmaiwebsite/scripts/` and are executable. Run them from the repo root:

```bash
.cursor/skills/verify-dmaiwebsite/scripts/launch.sh
.cursor/skills/verify-dmaiwebsite/scripts/doctor.mjs
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs hero
.cursor/skills/verify-dmaiwebsite/scripts/drive.mjs work
.cursor/skills/verify-dmaiwebsite/scripts/edges.mjs
.cursor/skills/verify-dmaiwebsite/scripts/work-layout.mjs
.cursor/skills/verify-dmaiwebsite/scripts/phone-bars.mjs pass
.cursor/skills/verify-dmaiwebsite/scripts/cleanup.sh
```

`drive.mjs` takes one of `hero`, `about`, `work`, or `footer`. The feature file for that argument is the pass contract. `work-layout.mjs` checks the Work frame at phone, iPad, and desktop widths in Chromium and WebKit.
