#!/usr/bin/env node
// Phone chrome that Playwright does not emulate.
//
// Chromium and WebKit here resolve 100lvh, 100dvh, 100svh, and innerHeight to
// the same pixel, so a rule like bottom: calc(100lvh - 100dvh) is always 0 and
// the Brave gap never appears. This script rewrites those three units while
// stylesheets are inserted. A solid toolbar is a visible viewport shorter than
// lvh. A translucent toolbar is an overlay the page draws under. Rubber-band
// is a negative visualViewport.offsetTop.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const shots = path.join(root, 'artifacts', 'verify-dmaiwebsite', 'phone-bars')
const publishDir = '/opt/cursor/artifacts'
const url = 'http://127.0.0.1:5199/'
const mode = process.argv[2]
const toolbar = 55
const large = 844
const visible = large - toolbar

if (mode !== 'pass' && mode !== 'fail-brave') {
  console.error('usage: phone-bars.mjs pass|fail-brave')
  process.exit(1)
}

fs.mkdirSync(shots, { recursive: true })
fs.mkdirSync(publishDir, { recursive: true })

function near(actual, expected, tolerance, label) {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${label}: ${actual} is not within ${tolerance} of ${expected}`)
  }
}

function installUnits(page, units) {
  return page.addInitScript((lengths) => {
    const sub = (value) => String(value)
      .replaceAll('100lvh', `${lengths.lvh}px`)
      .replaceAll('100dvh', `${lengths.dvh}px`)
      .replaceAll('100svh', `${lengths.svh}px`)
    const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')
    Object.defineProperty(HTMLStyleElement.prototype, 'textContent', {
      configurable: true,
      get() {
        return desc.get.call(this)
      },
      set(value) {
        desc.set.call(this, typeof value === 'string' ? sub(value) : value)
      },
    })
  }, units)
}

async function settle(page) {
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('.hero-hoptimists img')]
    if (imgs.length !== 3) return false
    if (imgs.some((img) => !img.complete || img.naturalWidth === 0)) return false
    return imgs.every((img) => Number(getComputedStyle(img).getPropertyValue('--pop')) > 0.999)
  }, null, { timeout: 10000 })
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
}

async function readRow(page) {
  return page.evaluate(() => {
    const row = document.querySelector('.hero-hoptimists')
    const mid = row.querySelector('img:nth-child(2)').getBoundingClientRect()
    const rowBox = row.getBoundingClientRect()
    const lvh = document.querySelector('.verify-lvh').getBoundingClientRect().height
    const dvh = document.querySelector('.verify-dvh').getBoundingClientRect().height
    const visibleBottom = window.innerHeight
    return {
      rowBottom: rowBox.bottom,
      visibleBottom,
      gap: visibleBottom - rowBox.bottom,
      peek: (visibleBottom - mid.top) / mid.height,
      height: mid.height,
      top: mid.top,
      bottomCss: getComputedStyle(row).bottom,
      lvh,
      dvh,
      inner: window.innerHeight,
      width: window.innerWidth,
      offsetTop: window.visualViewport.offsetTop,
      coarse: matchMedia('(pointer: coarse)').matches,
      scrollY: window.scrollY,
    }
  })
}

async function openPhone(browser, { height, lvh, dvh }) {
  const page = await browser.newPage({
    viewport: { width: 390, height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await installUnits(page, { lvh, dvh, svh: dvh })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent = '.verify-lvh{position:absolute;width:0;height:100lvh}.verify-dvh{position:absolute;width:0;height:100dvh}'
    document.head.appendChild(style)
    for (const name of ['verify-lvh', 'verify-dvh']) {
      const probe = document.createElement('div')
      probe.className = name
      document.body.appendChild(probe)
    }
  })
  await settle(page)
  return { page, errors }
}

async function shot(page, name) {
  const file = path.join(shots, `${name}.png`)
  await page.screenshot({ path: file })
  fs.copyFileSync(file, path.join(publishDir, `${name}.png`))
  return file
}

function assertGlued(sample, label) {
  near(sample.gap, 0, 1.5, `${label} row gap`)
  near(sample.peek, 0.7, 0.02, `${label} peek`)
  near(Number.parseFloat(sample.bottomCss), 0, 0.5, `${label} bottom`)
  if (!sample.coarse) throw new Error(`${label} did not match pointer: coarse`)
  near(sample.height, sample.width * 0.4, 2, `${label} figure height`)
}

function assertSplit(sample, label) {
  if (!(sample.lvh > sample.inner + 40)) {
    throw new Error(`${label} visible viewport is not shorter than lvh (${sample.lvh} vs ${sample.inner})`)
  }
  near(sample.lvh - sample.dvh, toolbar, 1, `${label} lvh - dvh`)
  near(sample.dvh, sample.inner, 1, `${label} dvh`)
}

async function scenarioBrave(browser, engine) {
  const { page, errors } = await openPhone(browser, { height: visible, lvh: large, dvh: visible })
  try {
    const sample = await readRow(page)
    await shot(page, `bars-${mode === 'fail-brave' ? 'fail-' : ''}brave-${engine}`)
    return { sample, errors }
  } finally {
    await page.close()
  }
}

async function scenarioSafari(browser, engine) {
  const { page, errors } = await openPhone(browser, { height: large, lvh: large, dvh: large })
  try {
    await page.evaluate((barHeight) => {
      const bar = document.createElement('div')
      bar.id = 'verify-safari-bar'
      bar.style.cssText = [
        'position:fixed',
        'left:0',
        'right:0',
        'bottom:0',
        `height:${barHeight}px`,
        'z-index:30',
        'pointer-events:none',
        'background:rgba(242,242,247,0.62)',
        'border-top:1px solid rgba(60,60,67,0.35)',
        'backdrop-filter:blur(8px)',
      ].join(';')
      document.body.appendChild(bar)
    }, toolbar)
    const sample = await readRow(page)
    const bar = await page.evaluate(() => {
      const box = document.getElementById('verify-safari-bar').getBoundingClientRect()
      const img = document.querySelector('.hero-hoptimists img:nth-child(2)').getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, height: box.height, imgTop: img.top, imgBottom: img.bottom }
    })
    sample.bar = bar
    await shot(page, `bars-safari-${engine}`)
    return { sample, errors }
  } finally {
    await page.close()
  }
}

async function scenarioRubber(browser, engine) {
  const { page, errors } = await openPhone(browser, { height: large, lvh: large, dvh: large })
  try {
    const shimmed = await page.evaluate(() => {
      const vv = window.visualViewport
      const height = vv.height
      try {
        Object.defineProperty(vv, 'offsetTop', { configurable: true, get() { return -90 } })
        Object.defineProperty(vv, 'height', { configurable: true, get() { return height } })
      } catch (error) {
        return { ok: false, error: error.message }
      }
      vv.dispatchEvent(new Event('scroll'))
      vv.dispatchEvent(new Event('resize'))
      const label = document.createElement('div')
      label.textContent = 'visualViewport.offsetTop = -90'
      label.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:30;padding:8px 12px;font:600 13px sans-serif;color:#1a1a1a;background:rgba(255,214,10,0.92)'
      document.body.appendChild(label)
      return { ok: true, offsetTop: vv.offsetTop }
    })
    const sample = await readRow(page)
    sample.shimmed = shimmed
    await shot(page, `bars-rubber-${engine}`)
    return { sample, errors }
  } finally {
    await page.close()
  }
}

async function scenarioScroll(browser, engine) {
  const { page, errors } = await openPhone(browser, { height: large, lvh: large, dvh: large })
  try {
    await page.addStyleTag({ content: 'html { scroll-snap-type: none !important }' })
    const down = await page.evaluate(() => {
      const hero = document.querySelector('section.hero')
      window.scrollTo(0, hero.offsetHeight * 0.4)
      return window.scrollY
    })
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    }))
    const mid = await readRow(page)
    mid.requestedScroll = down
    await shot(page, `bars-scroll-down-${engine}`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    }))
    const back = await readRow(page)
    await shot(page, `bars-scroll-up-${engine}`)
    return { mid, back, errors }
  } finally {
    await page.close()
  }
}

async function scenarioDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  await settle(page)
  const sample = await page.evaluate(() => {
    const row = document.querySelector('.hero-hoptimists')
    const mid = row.querySelector('img:nth-child(2)').getBoundingClientRect()
    return {
      height: mid.height,
      top: mid.top,
      rowBottom: row.getBoundingClientRect().bottom,
      bottomCss: getComputedStyle(row).bottom,
      inner: window.innerHeight,
      coarse: matchMedia('(pointer: coarse)').matches,
    }
  })
  await shot(page, 'bars-desktop')
  await page.close()
  return { sample, errors }
}

function quiet(errors, label) {
  if (errors.length) throw new Error(`${label} console or page errors:\n${errors.join('\n')}`)
}

function round(sample) {
  const out = {}
  for (const [key, value] of Object.entries(sample)) {
    if (typeof value === 'number') out[key] = Math.round(value * 100) / 100
    else out[key] = value
  }
  return out
}

async function runEngine(browser, engine) {
  if (mode === 'fail-brave') {
    const brave = await scenarioBrave(browser, engine)
    quiet(brave.errors, `${engine} brave`)
    assertSplit(brave.sample, `${engine} brave`)
    near(brave.sample.gap, toolbar, 2, `${engine} old row gap`)
    if (Math.abs(brave.sample.peek - 0.7) <= 0.02) {
      throw new Error(`${engine} old peek stayed 0.7, so the harness did not catch the float`)
    }
    return { brave: round(brave.sample) }
  }

  const brave = await scenarioBrave(browser, engine)
  const safari = await scenarioSafari(browser, engine)
  const rubber = await scenarioRubber(browser, engine)
  const scroll = await scenarioScroll(browser, engine)
  quiet(brave.errors, `${engine} brave`)
  quiet(safari.errors, `${engine} safari`)
  quiet(rubber.errors, `${engine} rubber`)
  quiet(scroll.errors, `${engine} scroll`)

  assertSplit(brave.sample, `${engine} brave`)
  assertGlued(brave.sample, `${engine} brave`)

  near(safari.sample.lvh, safari.sample.inner, 1, `${engine} safari lvh`)
  near(safari.sample.dvh, safari.sample.inner, 1, `${engine} safari dvh`)
  near(safari.sample.bar.height, toolbar, 1, `${engine} safari bar`)
  if (!(safari.sample.bar.imgTop < safari.sample.bar.top && safari.sample.rowBottom > safari.sample.bar.top + 20)) {
    throw new Error(`${engine} safari content does not draw under the bar`)
  }
  assertGlued(safari.sample, `${engine} safari`)

  if (!rubber.sample.shimmed.ok || !(rubber.sample.shimmed.offsetTop < 0)) {
    throw new Error(`${engine} rubber-band shim did not stick`)
  }
  if (!(rubber.sample.offsetTop < 0)) throw new Error(`${engine} offsetTop was not negative`)
  assertGlued(rubber.sample, `${engine} rubber`)

  if (!(scroll.mid.scrollY > 100)) throw new Error(`${engine} did not scroll down`)
  near(scroll.mid.gap, 0, 1.5, `${engine} scroll-down row gap`)
  if (!(scroll.back.scrollY < 1)) throw new Error(`${engine} did not scroll back to the top`)
  assertGlued(scroll.back, `${engine} scroll-up`)

  return {
    brave: round(brave.sample),
    safari: round(safari.sample),
    rubber: round(rubber.sample),
    scrollDown: round(scroll.mid),
    scrollUp: round(scroll.back),
  }
}

const report = { mode, engines: {} }
const chromiumBrowser = await chromium.launch({ headless: true })
try {
  report.engines.chromium = await runEngine(chromiumBrowser, 'chromium')
} finally {
  await chromiumBrowser.close()
}
const webkitBrowser = await webkit.launch({ headless: true })
try {
  report.engines.webkit = await runEngine(webkitBrowser, 'webkit')
} finally {
  await webkitBrowser.close()
}

if (mode === 'pass') {
  const desktopBrowser = await chromium.launch({ headless: true })
  try {
    const desktop = await scenarioDesktop(desktopBrowser)
    quiet(desktop.errors, 'desktop')
    if (desktop.sample.coarse) throw new Error('desktop matched pointer: coarse')
    near(desktop.sample.height, 315, 0.6, 'desktop height')
    near(desktop.sample.top, 679.5, 0.6, 'desktop top')
    near(desktop.sample.rowBottom, 900, 1, 'desktop row bottom')
    near(Number.parseFloat(desktop.sample.bottomCss), 0, 0.5, 'desktop bottom')
    report.desktop = round(desktop.sample)
  } finally {
    await desktopBrowser.close()
  }
}

const reportName = mode === 'fail-brave' ? 'phone-bars-fail.json' : 'phone-bars.json'
fs.writeFileSync(path.join(shots, reportName), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(publishDir, reportName), JSON.stringify(report, null, 2))
console.log(mode === 'fail-brave' ? 'old anchor floated' : 'phone bars ok')
console.log(JSON.stringify(report))
