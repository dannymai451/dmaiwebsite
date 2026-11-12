#!/usr/bin/env node
// Drive one mapped feature in headless Chromium and write evidence under artifacts/verify-dmaiwebsite/.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const shots = path.join(root, 'artifacts', 'verify-dmaiwebsite')
const url = 'http://127.0.0.1:5199/'
const features = ['hero', 'about', 'work', 'footer']

function band(value, [min, max], label) {
  if (!(value >= min && value <= max)) {
    throw new Error(`${label}: ${value} is outside [${min}, ${max}]`)
  }
}

function track(page) {
  const errors = []
  const statuses = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    const parsed = new URL(response.url())
    if (parsed.port === '5199') statuses.push({ path: parsed.pathname, status: response.status() })
  })
  return { errors, statuses }
}

function assertQuiet(errors) {
  if (errors.length) throw new Error(`console or page errors:\n${errors.join('\n')}`)
}

function assertStatus(statuses, pathname) {
  const hit = statuses.find((row) => row.path === pathname)
  if (!hit || hit.status !== 200) {
    throw new Error(`${pathname} did not return 200 (${hit ? hit.status : 'no response'})`)
  }
}

async function shot(page, name) {
  fs.mkdirSync(shots, { recursive: true })
  await page.screenshot({ path: path.join(shots, `${name}.png`) })
}

function writeJson(name, value) {
  fs.mkdirSync(shots, { recursive: true })
  fs.writeFileSync(path.join(shots, name), JSON.stringify(value, null, 2))
}

async function frames(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
}

async function disableSnap(page) {
  await page.addStyleTag({ content: 'html { scroll-snap-type: none !important; }' })
  const snap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)
  if (snap !== 'none') throw new Error(`scroll-snap-type is ${snap}, expected none`)
  return snap
}

async function installProbe(page) {
  await page.addInitScript(() => {
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
  })
}

async function waitForProbe(page, minT) {
  await page.waitForFunction(
    (min) => {
      const log = window.__motionLog
      return Boolean(log && log.length > 0 && log[log.length - 1].t >= min)
    },
    minT,
    { timeout: 20000 },
  )
}

async function readSample(page) {
  const sample = await page.evaluate(() => window.__verifySample())
  if (!sample) throw new Error('page probe had nothing to measure')
  return sample
}

async function scrollHero(page, fraction) {
  await page.evaluate((target) => {
    const hero = document.querySelector('section.hero')
    window.scrollTo(0, hero.offsetHeight * target)
  }, fraction)
  await frames(page)
  return page.evaluate(() => {
    const hero = document.querySelector('section.hero')
    return {
      landed: window.scrollY / hero.offsetHeight,
      scrollY: window.scrollY,
      heroH: hero.offsetHeight,
    }
  })
}

async function scrollAbout(page, at) {
  await page.evaluate((target) => {
    const about = document.querySelector('section.about')
    const top = about.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, Math.max(0, top - target * window.innerHeight))
  }, at)
  await frames(page)
  return page.evaluate(() => {
    const title = document.querySelector('#about-title')
    let opacity = 1
    for (let node = title; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity)
    }
    const about = document.querySelector('section.about')
    return {
      landed: about.getBoundingClientRect().top / window.innerHeight,
      opacity,
      scrollY: window.scrollY,
    }
  })
}

async function scrollToTop(page, selector) {
  await page.evaluate((sel) => {
    const element = document.querySelector(sel)
    const top = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, top)
  }, selector)
  await frames(page)
  return page.evaluate((sel) => {
    const rect = document.querySelector(sel).getBoundingClientRect()
    return { top: rect.top, height: rect.height, scrollY: window.scrollY }
  }, selector)
}

function assertLanded(actual, target, label) {
  if (Math.abs(actual - target) > 0.02) {
    throw new Error(`${label} landed at ${actual}, wanted ${target}`)
  }
}

async function openHero(page, { reduced }) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await installProbe(page)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: "Hey! I'm Danny", level: 1 }).waitFor({ state: 'attached' })
  await page.getByRole('img', { name: 'Blue hoptimist' }).waitFor({ state: 'attached' })
  await page.getByRole('img', { name: 'Yellow hoptimist' }).waitFor({ state: 'attached' })
  await page.getByRole('img', { name: 'Red hoptimist' }).waitFor({ state: 'attached' })
}

async function driveHero() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const { errors, statuses } = track(page)
    await openHero(page, { reduced: false })
    await waitForProbe(page, 150)
    await shot(page, 'hero-greeting-early')
    await waitForProbe(page, 3200)
    await shot(page, 'hero-settled')

    const log = await page.evaluate(() => window.__motionLog)
    const greetingMin = Math.min(...log.map((row) => row.greeting))
    const settledRows = log.filter((row) => row.t >= 3000)
    const settled = settledRows[settledRows.length - 1]
    const staggerGap = Math.max(
      0,
      ...log
        .filter((row) => row.greeting > 0.85 && row.t < 3000)
        .map((row) => row.hidden[2] - row.hidden[0]),
    )
    if (!(greetingMin < 0.25)) throw new Error(`greeting never started transparent (${greetingMin})`)
    if (!settled || !(settled.greeting > 0.92)) throw new Error('greeting did not finish opaque')
    settled.hidden.forEach((value, index) => band(value, [0.22, 0.4], `figure ${index} settled`))
    if (staggerGap < 0.15) throw new Error(`pop did not stagger (${staggerGap})`)

    const snapBack = await scrollHero(page, 0.25)
    if (snapBack.landed > 0.02) {
      throw new Error(`with snap on, 25% of the hero stayed at ${snapBack.landed}`)
    }
    const snapped = await readSample(page)
    snapped.hidden.forEach((value, index) => band(value, [0.22, 0.4], `figure ${index} after snap-back`))
    await shot(page, 'hero-snap-25')

    await disableSnap(page)
    const tuck = []
    for (const row of [
      { fraction: 0, range: [0.22, 0.4], name: 'hero-scroll-0' },
      { fraction: 0.25, range: [0.55, 0.75], name: 'hero-scroll-25' },
      { fraction: 0.5, range: [0.9, 1.08], name: 'hero-scroll-50' },
    ]) {
      const landed = await scrollHero(page, row.fraction)
      assertLanded(landed.landed, row.fraction, `hero scroll ${row.fraction}`)
      const sample = await readSample(page)
      sample.hidden.forEach((value, index) => band(value, row.range, `figure ${index} at ${row.fraction}`))
      await shot(page, row.name)
      tuck.push({ fraction: row.fraction, landed: landed.landed, hidden: sample.hidden })
    }

    const links = await page.getByRole('navigation', { name: 'Contact' }).getByRole('link').evaluateAll((anchors) =>
      anchors.map((anchor) => ({
        name: anchor.getAttribute('aria-label'),
        href: anchor.getAttribute('href'),
        target: anchor.getAttribute('target'),
        rel: anchor.getAttribute('rel'),
      })),
    )
    const expectedLinks = [
      { name: 'GitHub', href: 'https://github.com/dannymai451', target: '_blank', rel: 'noreferrer' },
      { name: 'LinkedIn', href: 'https://www.linkedin.com', target: '_blank', rel: 'noreferrer' },
      { name: 'Email', href: 'mailto:dannymai451@gmail.com', target: null, rel: null },
    ]
    if (JSON.stringify(links) !== JSON.stringify(expectedLinks)) {
      throw new Error(`contact links were ${JSON.stringify(links)}`)
    }
    if (page.url() !== url) throw new Error(`navigation left the page for ${page.url()}`)
    assertStatus(statuses, '/')
    assertStatus(statuses, '/hoptimist-1.webp')
    assertStatus(statuses, '/hoptimist-2.webp')
    assertStatus(statuses, '/hoptimist-3.webp')
    assertQuiet(errors)
    writeJson('hero.json', {
      feature: 'hero',
      viewport: { width: 1440, height: 900 },
      greetingMin,
      settled,
      staggerGap,
      snapBack,
      tuck,
      links,
      finalUrl: page.url(),
      consoleErrors: errors,
    })
    await page.close()

    const reducedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const reducedTrack = track(reducedPage)
    await openHero(reducedPage, { reduced: true })
    await waitForProbe(reducedPage, 400)
    await shot(reducedPage, 'reduced-hero')
    const reducedLog = await reducedPage.evaluate(() => window.__motionLog)
    const early = reducedLog.filter((row) => row.t >= 80 && row.t <= 400)
    if (!early.length) throw new Error('reduced-motion log had no sample between 80ms and 400ms')
    for (const row of early) {
      if (!(row.greeting > 0.9)) throw new Error(`reduced greeting at ${row.t} was ${row.greeting}`)
      row.hidden.forEach((value, index) => band(value, [0.22, 0.4], `reduced figure ${index}`))
    }
    await disableSnap(reducedPage)
    const reducedTuck = []
    for (const row of [
      { fraction: 0, range: [0.22, 0.4] },
      { fraction: 0.25, range: [0.55, 0.75] },
      { fraction: 0.5, range: [0.9, 1.08] },
    ]) {
      const landed = await scrollHero(reducedPage, row.fraction)
      assertLanded(landed.landed, row.fraction, `reduced hero scroll ${row.fraction}`)
      const sample = await readSample(reducedPage)
      sample.hidden.forEach((value, index) => band(value, row.range, `reduced figure ${index} at ${row.fraction}`))
      reducedTuck.push({ fraction: row.fraction, landed: landed.landed, hidden: sample.hidden })
    }
    await shot(reducedPage, 'reduced-hero-scroll-50')
    assertQuiet(reducedTrack.errors)
    writeJson('hero-reduced.json', {
      feature: 'hero-reduced',
      early: early[0],
      tuck: reducedTuck,
      consoleErrors: reducedTrack.errors,
    })
    console.log('hero ok')
  } finally {
    await browser.close()
  }
}

const ABOUT = [
  { at: 0.96, range: [0, 0.08], name: 'about-top-96' },
  { at: 0.57, range: [0.3, 0.42], name: 'about-top-57' },
  { at: 0.18, range: [0.86, 0.96], name: 'about-top-18' },
  { at: 0, range: [0.97, 1.01], name: 'about-top-0' },
]

const ABOUT_COPY =
  "I'm a software engineer interested in ai, automating tedious work, and solving tough problems. I enjoy bringing ideas to life, making people's days a little easier, and learning with other curious minds."

async function driveAbout() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const { errors, statuses } = track(page)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'ABOUT ME', level: 2 }).waitFor({ state: 'attached' })
    await page.waitForFunction(() => (document.querySelector('section.about')?.offsetHeight || 0) > 100)

    const trapped = await scrollAbout(page, 0.18)
    if (trapped.landed > 0.02) throw new Error(`snap left the 18% about target at ${trapped.landed}`)
    if (!(trapped.opacity > 0.97)) throw new Error(`snap-stolen about opacity was ${trapped.opacity}`)
    await shot(page, 'about-snap-18')

    await disableSnap(page)
    const rows = []
    for (const row of ABOUT) {
      const sample = await scrollAbout(page, row.at)
      assertLanded(sample.landed, row.at, `about top ${row.at}`)
      band(sample.opacity, row.range, `about opacity at ${row.at}`)
      await shot(page, row.name)
      rows.push({ at: row.at, landed: sample.landed, opacity: sample.opacity })
    }

    const copy = (await page.locator('section.about p').innerText()).replace(/\s+/g, ' ').trim()
    if (copy !== ABOUT_COPY) throw new Error(`about copy was ${copy}`)
    const photo = page.getByRole('img', { name: 'Danny holding a pastry' })
    const photoBox = await photo.boundingBox()
    if (!photoBox || photoBox.y > 900 || photoBox.y + photoBox.height < 0 || photoBox.height < 1) {
      throw new Error('about photo is not in the viewport at the top of the section')
    }
    if (page.url() !== url) throw new Error(`navigation left the page for ${page.url()}`)
    assertStatus(statuses, '/me.webp')
    assertQuiet(errors)
    writeJson('about.json', { feature: 'about', trapped, rows, copy, consoleErrors: errors })
    await page.close()

    const reducedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const reducedTrack = track(reducedPage)
    await reducedPage.emulateMedia({ reducedMotion: 'reduce' })
    await reducedPage.goto(url, { waitUntil: 'domcontentloaded' })
    await disableSnap(reducedPage)
    const reducedRows = []
    for (const at of [0.96, 0]) {
      const sample = await scrollAbout(reducedPage, at)
      assertLanded(sample.landed, at, `reduced about top ${at}`)
      if (!(sample.opacity > 0.92)) throw new Error(`reduced about opacity at ${at} was ${sample.opacity}`)
      await shot(reducedPage, at === 0.96 ? 'reduced-about-top-96' : 'reduced-about-top-0')
      reducedRows.push({ at, opacity: sample.opacity, landed: sample.landed })
    }
    assertQuiet(reducedTrack.errors)
    writeJson('about-reduced.json', { feature: 'about-reduced', rows: reducedRows, consoleErrors: reducedTrack.errors })
    console.log('about ok')
  } finally {
    await browser.close()
  }
}

async function driveWork() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const { errors } = track(page)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const section = page.locator('section.work')
    await section.waitFor({ state: 'attached' })
    await page.waitForFunction(() => (document.querySelector('section.work')?.offsetHeight || 0) > 100)
    await disableSnap(page)
    const place = await scrollToTop(page, 'section.work')
    if (Math.abs(place.top) > 2) throw new Error(`work top landed at ${place.top}`)
    if (place.height < 800) throw new Error(`work is ${place.height}px tall`)
    const heading = (await page.locator('#work-title').innerText()).replace(/\s+/g, ' ').trim()
    if (heading !== 'WORK + PROJECTS') throw new Error(`work heading was ${heading}`)
    const text = (await section.innerText()).replace(/\s+/g, ' ').trim()
    const required = [
      'the day job',
      '[ team photo ]',
      '[Company]',
      '[role]',
      '[25 - now]',
      'FULL-TIME',
      'what I do',
      '[thing you build]',
      '[impact / number]',
      '[team or stack]',
      'stuff I made for fun',
      '[ app screenshot ]',
      '[Project 1]',
      '[what it does, 1 line]',
      '[ demo gif ]',
      '[Project 2]',
      'more coming soon...',
    ]
    for (const line of required) {
      if (!text.includes(line)) throw new Error(`work is missing ${line}`)
    }
    const live = await section.getByText('live', { exact: true }).count()
    const github = await section.getByText('github', { exact: true }).count()
    if (live !== 2 || github !== 2) throw new Error(`work links rendered live=${live} github=${github}`)
    const anchors = await section.locator('a').count()
    if (anchors !== 0) throw new Error(`work rendered ${anchors} anchors`)
    const headings = await section.getByRole('heading').count()
    if (headings !== 1) throw new Error(`work rendered ${headings} headings`)
    await shot(page, 'work')
    assertQuiet(errors)
    writeJson('work.json', {
      feature: 'work',
      selector: 'section.work',
      heading,
      text,
      headings,
      anchors,
      top: place.top,
      height: place.height,
      scrollY: place.scrollY,
      consoleErrors: errors,
    })
    console.log('work ok')
  } finally {
    await browser.close()
  }
}

async function driveFooter() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const { errors } = track(page)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.locator('.foot-slot').waitFor({ state: 'attached' })
    await page.waitForFunction(() => (document.querySelector('.foot-slot')?.offsetHeight || 0) > 100)
    await disableSnap(page)
    const place = await scrollToTop(page, '.foot-slot')
    if (Math.abs(place.top) > 2) throw new Error(`footer slot top landed at ${place.top}`)
    const footer = page.getByRole('contentinfo')
    const text = (await footer.innerText()).trim()
    const links = await footer.getByRole('link').count()
    const contact = await page.getByRole('navigation', { name: 'Contact' }).getByRole('link').count()
    if (text !== '') throw new Error(`footer rendered copy: ${text}`)
    if (links !== 0) throw new Error(`footer rendered ${links} links`)
    if (contact !== 3) throw new Error(`contact navigation has ${contact} links`)
    if (page.url() !== url) throw new Error(`navigation left the page for ${page.url()}`)
    await shot(page, 'footer')
    assertQuiet(errors)
    writeJson('footer.json', {
      feature: 'footer',
      text,
      links,
      contactLinks: contact,
      slotTop: place.top,
      slotHeight: place.height,
      scrollY: place.scrollY,
      consoleErrors: errors,
    })
    console.log('footer ok')
  } finally {
    await browser.close()
  }
}

const feature = process.argv[2]
if (!features.includes(feature)) {
  console.error(`usage: drive.mjs <${features.join('|')}>`)
  process.exit(2)
}

const runs = {
  hero: driveHero,
  about: driveAbout,
  work: driveWork,
  footer: driveFooter,
}

runs[feature]().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
