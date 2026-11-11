import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const SHOTS = path.join('artifacts', 'verify-dmaiwebsite')

const TUCK = [
  { fraction: 0, band: [0.22, 0.4], name: 'hero-scroll-0' },
  { fraction: 0.25, band: [0.55, 0.75], name: 'hero-scroll-25' },
  { fraction: 0.5, band: [0.9, 1.08], name: 'hero-scroll-50' },
]

const ABOUT = [
  { at: 0.96, band: [0, 0.12], name: 'about-top-96' },
  { at: 0.57, band: [0.35, 0.65], name: 'about-top-57' },
  // sine.inOut from top 96% to top 0% is about 0.916 when the section top is at 18%.
  { at: 0.18, band: [0.9, 1.01], name: 'about-top-18' },
]

function installProbe() {
  function renderedOpacity(element) {
    let opacity = 1
    for (let node = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity)
    }
    return opacity
  }

  function hiddenFraction(image) {
    const rect = image.getBoundingClientRect()
    return (rect.bottom - window.innerHeight) / rect.height
  }

  function sample() {
    const intro = document.querySelector('.hero-intro')
    const title = document.querySelector('#about-title')
    const images = [...document.querySelectorAll('.hero-hoptimists img')]
    if (!intro || images.length !== 3) return null
    if (images.some((image) => image.getBoundingClientRect().height < 1)) return null
    if (window.__motionT0 == null) window.__motionT0 = performance.now()
    return {
      t: performance.now() - window.__motionT0,
      greeting: renderedOpacity(intro),
      hidden: images.map(hiddenFraction),
      about: title ? renderedOpacity(title) : null,
    }
  }

  window.__verifySample = sample
  window.__motionLog = []
  const tick = () => {
    const row = sample()
    if (row && row.t <= 4000) window.__motionLog.push(row)
    if (!row || row.t < 4000) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function expectBand(value, [min, max], label) {
  expect(value, label).toBeGreaterThanOrEqual(min)
  expect(value, label).toBeLessThanOrEqual(max)
}

async function openSite(page, { reduced }) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(installProbe)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: 'html { scroll-snap-type: none !important; }' })
  const snap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)
  expect(snap).toBe('none')
  await expect(page.getByRole('heading', { name: "Hey! I'm Danny" })).toBeAttached()
  await expect(page.getByRole('img', { name: 'Blue hoptimist' })).toBeAttached()
  await expect(page.getByRole('img', { name: 'Yellow hoptimist' })).toBeAttached()
  await expect(page.getByRole('img', { name: 'Red hoptimist' })).toBeAttached()
}

async function waitForProbe(page, minT) {
  await page.waitForFunction(
    (minT) => {
      const log = window.__motionLog
      return Boolean(log && log.length > 0 && log[log.length - 1].t >= minT)
    },
    minT,
    { timeout: 20_000 },
  )
}

async function readSample(page) {
  return page.evaluate(() => window.__verifySample())
}

async function scrollHero(page, fraction) {
  const actual = await page.evaluate((fraction) => {
    const hero = document.querySelector('section.hero')
    window.scrollTo(0, hero.offsetHeight * fraction)
    return window.scrollY / hero.offsetHeight
  }, fraction)
  expect(Math.abs(actual - fraction), `hero scroll landed at ${actual}, wanted ${fraction}`).toBeLessThan(0.02)
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
}

async function scrollAbout(page, at) {
  const actual = await page.evaluate((at) => {
    const about = document.querySelector('section.about')
    const top = about.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, Math.max(0, top - at * window.innerHeight))
    return about.getBoundingClientRect().top / window.innerHeight
  }, at)
  expect(Math.abs(actual - at), `about top landed at ${actual}, wanted ${at}`).toBeLessThan(0.02)
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
}

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
}

const consoleErrors = new WeakMap()

test.beforeEach(async ({ page }) => {
  const errors = []
  consoleErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(async ({ page }) => {
  const errors = consoleErrors.get(page) ?? []
  expect(errors, errors.join('\n')).toEqual([])
})

test('hero fades in, figures tuck on scroll, and about fades in', async ({ page }, testInfo) => {
  await openSite(page, { reduced: false })
  await waitForProbe(page, 150)
  await shot(page, 'hero-greeting-early')
  await waitForProbe(page, 3200)
  await shot(page, 'hero-settled')

  const log = await page.evaluate(() => window.__motionLog)
  const greetingMin = Math.min(...log.map((row) => row.greeting))
  const settled = log.filter((row) => row.t >= 3000)
  const end = settled[settled.length - 1]
  const staggerGap = Math.max(
    ...log.filter((row) => row.greeting > 0.85 && row.t < 3000).map((row) => row.hidden[2] - row.hidden[0]),
    0,
  )

  expect(greetingMin, 'greeting starts transparent').toBeLessThan(0.25)
  expect(end.greeting, 'greeting finishes opaque').toBeGreaterThan(0.92)
  end.hidden.forEach((value, index) => expectBand(value, [0.22, 0.4], `figure ${index} settled`))
  expect(staggerGap, 'later figures trail the first during the pop').toBeGreaterThanOrEqual(0.15)

  const tuck = []
  for (const row of TUCK) {
    await scrollHero(page, row.fraction)
    const sample = await readSample(page)
    sample.hidden.forEach((value, index) =>
      expectBand(value, row.band, `figure ${index} at hero scroll ${row.fraction}`),
    )
    await shot(page, row.name)
    tuck.push({ fraction: row.fraction, hidden: sample.hidden })
  }

  const about = []
  for (const row of ABOUT) {
    await scrollAbout(page, row.at)
    const sample = await readSample(page)
    expectBand(sample.about, row.band, `about opacity at top ${row.at}`)
    await shot(page, row.name)
    about.push({ at: row.at, opacity: sample.about })
  }

  fs.mkdirSync(SHOTS, { recursive: true })
  fs.writeFileSync(
    path.join(SHOTS, 'motion.json'),
    JSON.stringify({ greetingMin, settled: end, staggerGap, tuck, about }, null, 2),
  )
  await testInfo.attach('motion.json', {
    path: path.join(SHOTS, 'motion.json'),
    contentType: 'application/json',
  })
})

test('reduced motion is settled immediately, still tucks, and about stays visible', async ({ page }) => {
  await openSite(page, { reduced: true })
  await waitForProbe(page, 400)
  await shot(page, 'reduced-hero')

  const log = await page.evaluate(() => window.__motionLog)
  const early = log.filter((row) => row.t >= 80 && row.t <= 400)
  expect(early.length).toBeGreaterThan(0)
  for (const row of early) {
    expect(row.greeting, `reduced greeting at ${row.t.toFixed(0)}ms`).toBeGreaterThan(0.9)
    row.hidden.forEach((value, index) => expectBand(value, [0.22, 0.4], `reduced figure ${index}`))
  }

  const tuck = []
  for (const row of TUCK) {
    await scrollHero(page, row.fraction)
    const sample = await readSample(page)
    sample.hidden.forEach((value, index) =>
      expectBand(value, row.band, `reduced figure ${index} at hero scroll ${row.fraction}`),
    )
    tuck.push({ fraction: row.fraction, hidden: sample.hidden })
  }
  await shot(page, 'reduced-hero-scroll-50')

  await scrollAbout(page, 0.96)
  const about = await readSample(page)
  expect(about.about, 'reduced about stays visible').toBeGreaterThan(0.92)
  await shot(page, 'reduced-about-top-96')
  await scrollAbout(page, 0.18)
  await shot(page, 'reduced-about-top-18')

  fs.mkdirSync(SHOTS, { recursive: true })
  fs.writeFileSync(
    path.join(SHOTS, 'motion-reduced.json'),
    JSON.stringify({ early: early[0], tuck, aboutAt96: about.about }, null, 2),
  )
})
