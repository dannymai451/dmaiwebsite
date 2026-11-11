#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const shots = path.join(root, 'artifacts', 'verify-dmaiwebsite')
const url = 'http://127.0.0.1:5199/'
const widths = [
  { width: 320, height: 844, label: '320' },
  { width: 375, height: 844, label: '375' },
  { width: 390, height: 844, label: '390' },
  { width: 430, height: 844, label: '430' },
  { width: 768, height: 1024, label: 'ipad' },
  { width: 1440, height: 900, label: '1440' },
]
const browsers = [
  { name: 'webkit', type: webkit },
  { name: 'chromium', type: chromium },
]

function measure() {
  const card = document.querySelector('.panel-frame-fill')
  const heading = document.querySelector('.hero-greeting')
  const cardBox = card.getBoundingClientRect()
  const node = [...heading.childNodes].find((item) => item.nodeType === Node.TEXT_NODE)
  const range = document.createRange()
  range.selectNodeContents(node)
  const text = range.getBoundingClientRect()
  const links = document.querySelector('.hero-links').getBoundingClientRect()
  const images = [...document.querySelectorAll('.hero-hoptimists img')].map((image) => {
    const box = image.getBoundingClientRect()
    return {
      name: image.alt,
      left: box.left,
      right: box.right,
      pastLeft: -box.left,
      pastRight: box.right - innerWidth,
    }
  })
  const edge = (box) => ({
    left: box.left,
    right: box.right,
    pastLeft: cardBox.left - box.left,
    pastRight: box.right - cardBox.right,
    pastTop: cardBox.top - box.top,
    pastBottom: box.bottom - cardBox.bottom,
  })
  return {
    fontSize: getComputedStyle(heading).fontSize,
    card: { left: cardBox.left, right: cardBox.right, width: cardBox.width },
    greeting: edge(text),
    links: edge(links),
    images,
  }
}

const modes = [
  { name: 'loaded', blockFont: false },
  { name: 'loading', blockFont: true },
  { name: 'zoom125', blockFont: false, zoomPx: 20 },
  { name: 'zoom150', blockFont: false, zoomPx: 24 },
]

async function openPage(browserType, viewport, mode) {
  const browser = await browserType.launch()
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: viewport.width < 900,
    hasTouch: viewport.width < 900,
  })
  if (mode.blockFont) {
    await context.route('**/*fonts.gstatic.com/**', (route) => route.abort())
    await context.route('**/*fonts.googleapis.com/**', (route) => route.abort())
  }
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => {
    const fill = document.querySelector('.panel-frame-fill')
    const heading = document.querySelector('.hero-greeting')
    return fill && heading && fill.style.width.endsWith('px') && parseFloat(fill.style.width) > 40
  })
  if (!mode.blockFont) {
    await page.evaluate(() => document.fonts.load('700 64px Caveat').catch(() => {}))
    await page.waitForTimeout(200)
  } else {
    await page.waitForTimeout(150)
  }
  if (mode.zoomPx) {
    await page.evaluate((px) => {
      document.documentElement.style.fontSize = `${px}px`
    }, mode.zoomPx)
    await page.waitForTimeout(100)
  }
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
  const box = await page.evaluate(measure)
  await browser.close()
  return { box, errors }
}

function crossed(box) {
  const hits = []
  for (const name of ['greeting', 'links']) {
    const edge = box[name]
    for (const side of ['pastLeft', 'pastRight', 'pastTop', 'pastBottom']) {
      if (edge[side] > 0.5) hits.push(`${name} ${side} ${edge[side].toFixed(2)}`)
    }
  }
  for (const image of box.images) {
    if (image.pastLeft > 0.5) hits.push(`${image.name} pastLeft ${image.pastLeft.toFixed(2)}`)
    if (image.pastRight > 0.5) hits.push(`${image.name} pastRight ${image.pastRight.toFixed(2)}`)
  }
  return hits
}

const rows = []
let failed = 0
for (const browser of browsers) {
  for (const size of widths) {
    for (const mode of modes) {
      const { box, errors } = await openPage(browser.type, size, mode)
      const hits = crossed(box)
      if (errors.length) hits.push(`pageerror ${errors[0]}`)
      if (hits.length) failed += 1
      const row = {
        browser: browser.name,
        width: size.label,
        mode: mode.name,
        fontSize: box.fontSize,
        cardRight: +box.card.right.toFixed(2),
        greetingRight: +box.greeting.right.toFixed(2),
        pastRight: +box.greeting.pastRight.toFixed(2),
        pastLeft: +box.greeting.pastLeft.toFixed(2),
        hits,
      }
      rows.push(row)
      const mark = hits.length ? 'FAIL' : 'ok'
      console.log(
        `${mark.padEnd(4)} ${browser.name.padEnd(9)} ${size.label.padEnd(5)} ${mode.name.padEnd(8)} pastRight=${row.pastRight} pastLeft=${row.pastLeft} greetingRight=${row.greetingRight} cardRight=${row.cardRight}`,
      )
      if (hits.length) console.log(`     ${hits.join('; ')}`)
    }
  }
}

fs.mkdirSync(shots, { recursive: true })
fs.writeFileSync(path.join(shots, 'edges.json'), JSON.stringify({ failed, rows }, null, 2))
if (failed) {
  console.error(`edges: ${failed} case(s) crossed a container`)
  process.exit(1)
}
console.log('edges ok')
