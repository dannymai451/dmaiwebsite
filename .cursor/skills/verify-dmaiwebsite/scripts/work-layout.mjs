#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from '@playwright/test'

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const outDir = path.join(root, 'artifacts', 'verify-dmaiwebsite', 'work-layout')
const publishDir = '/opt/cursor/artifacts/work-layout'
const url = process.env.VERIFY_URL ?? 'http://127.0.0.1:5199/'
const mockPath =
  process.env.WORK_MOCK ??
  '/home/ubuntu/.cursor/projects/agent-repos-dmaiwebsite/assets/506111ac9d01f35459d8ad44cb345b5f8ab737c9dd1808c7e73e1d9bd80fe67d.png'

const viewports = [
  { name: '320', width: 320, height: 568 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
]

const engines = [
  { name: 'chromium', launch: chromium },
  { name: 'webkit', launch: webkit },
]

function stallFonts(page) {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const ready = page.route('**/*', async (route) => {
    const hit = route.request().url()
    if (hit.includes('fonts.gstatic.com')) {
      await gate
      await route.abort()
      return
    }
    await route.continue()
  })
  return { ready, release }
}

async function measure(page) {
  return page.evaluate(() => {
    const reveal = document.querySelector('.work-reveal')
    const frame = reveal.getBoundingClientRect()
    const inset = parseFloat(getComputedStyle(reveal).getPropertyValue('--ink-inset')) || 0
    const inner = {
      left: frame.left + inset - 1,
      top: frame.top + inset - 1,
      right: frame.right - inset + 1,
      bottom: frame.bottom - inset + 1,
    }
    const box = (el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
    }
    const nameOf = (el) => {
      const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : ''
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 42)
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`
    }
    const outside = (rect) => {
      const bits = []
      if (rect.left < inner.left) bits.push('left')
      if (rect.right > inner.right) bits.push('right')
      if (rect.top < inner.top) bits.push('top')
      if (rect.bottom > inner.bottom) bits.push('bottom')
      return bits
    }
    const hits = (a, b) =>
      a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
    const problems = []
    const doc = document.documentElement
    if (doc.scrollWidth > doc.clientWidth + 1) {
      problems.push(`horizontal scroll ${doc.scrollWidth} > ${doc.clientWidth}`)
    }
    const textNodes = [
      ...reveal.querySelectorAll(
        '.work-title, .work-label, .polaroid-media, .polaroid-caption, .polaroid-company, .polaroid-meta, .polaroid-name, .polaroid-desc, .work-note, .work-note-title, .work-more, .work-badge',
      ),
    ]
    const sameGroup = (a, b) => {
      const group = (el) => el.closest('.polaroid, .work-note, .work-label, .work-title')
      const left = group(a)
      const right = group(b)
      return left && left === right
    }
    for (const el of textNodes) {
      const rect = box(el)
      if (rect.width < 1 || rect.height < 1) continue
      const bits = outside(rect)
      if (bits.length) problems.push(`${nameOf(el)} crosses the frame on ${bits.join(' ')}`)
    }
    for (const el of reveal.querySelectorAll('.work-tape, .work-pin')) {
      const bits = outside(box(el))
      if (bits.length) problems.push(`${nameOf(el)} crosses the frame on ${bits.join(' ')}`)
    }
    for (let i = 0; i < textNodes.length; i += 1) {
      for (let j = i + 1; j < textNodes.length; j += 1) {
        const a = textNodes[i]
        const b = textNodes[j]
        if (a.contains(b) || b.contains(a) || sameGroup(a, b)) continue
        if (hits(box(a), box(b))) problems.push(`${nameOf(a)} overlaps ${nameOf(b)}`)
      }
    }
    const cards = [...reveal.querySelectorAll('.polaroid')]
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        if (hits(box(cards[i]), box(cards[j]))) problems.push(`polaroid ${i + 1} overlaps polaroid ${j + 1}`)
      }
    }
    const words = [
      ...reveal.querySelectorAll(
        '.polaroid-caption, .polaroid-media span, .work-note, .work-label, .work-title, .work-more',
      ),
    ]
    for (const hold of reveal.querySelectorAll('.work-tape, .work-pin')) {
      const card = hold.closest('.polaroid')
      for (const word of words) {
        if (card && card.contains(word)) continue
        if (hits(box(hold), box(word))) problems.push(`${nameOf(hold)} covers ${nameOf(word)}`)
      }
    }
    const job = box(reveal.querySelector('.work-col.is-day-job'))
    const fun = box(reveal.querySelector('.work-col.is-fun'))
    const stacked = job.bottom <= fun.top + 4
    const beside = job.right <= fun.left + 8 && Math.abs(job.top - fun.top) < 80
    const narrow = frame.width <= 832
    if (narrow && !stacked) problems.push('day job and projects did not stack')
    if (!narrow && !beside) problems.push('day job and projects did not sit side by side')
    const fontStatus = document.fonts.status
    return {
      problems,
      inset,
      frame: { width: frame.width, height: frame.height },
      stacked,
      beside,
      fontStatus,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    }
  })
}

async function shoot(page, file) {
  fs.mkdirSync(outDir, { recursive: true })
  await page.locator('section.work').screenshot({ path: path.join(outDir, file) })
}

async function runCase(browserType, engineName, viewport, pending) {
  const browser = await browserType.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  let fonts = null
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (pending && /font/i.test(text)) return
    errors.push(text)
  })
  try {
  fonts = pending ? stallFonts(page) : null
  if (fonts) await fonts.ready
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.locator('section.work').waitFor({ state: 'attached' })
  if (!pending) {
    await page.evaluate(() => document.fonts.load('700 48px Caveat'))
    await page.evaluate(() => document.fonts.ready)
  }
  await page.waitForFunction(() => {
    const inset = getComputedStyle(document.querySelector('.work-reveal')).getPropertyValue('--ink-inset')
    return parseFloat(inset) > 0
  })
  await page.evaluate(() => {
    document.documentElement.style.scrollSnapType = 'none'
    const work = document.querySelector('section.work')
    const top = work.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, top)
  })
  await page.waitForTimeout(250)
  const result = await measure(page)
  const mode = pending ? 'pending' : 'loaded'
  const file = `${engineName}-${viewport.name}-${mode}.png`
  await shoot(page, file)
  if (!pending && result.fontStatus !== 'loaded') result.problems.push(`font status was ${result.fontStatus}`)
  if (pending && result.fontStatus === 'loaded') result.problems.push('font finished loading while the file request was still pending')
  if (errors.length) result.problems.push(`console or page errors: ${errors.join(' | ')}`)
  return { engine: engineName, viewport: viewport.name, mode, file, ...result }
  } finally {
    if (fonts) fonts.release()
    await browser.close()
  }
}

async function sideBySide(shotFile) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 980 } })
  const mock = fs.readFileSync(mockPath).toString('base64')
  const shot = fs.readFileSync(path.join(outDir, shotFile)).toString('base64')
  await page.setContent(`<!doctype html>
    <html><head><style>
      body { margin: 0; display: flex; gap: 12px; padding: 12px; background: #f4f4f4; box-sizing: border-box; }
      figure { margin: 0; width: calc(50% - 6px); }
      img { width: 100%; height: auto; display: block; background: #fff; }
      figcaption { font: 14px/1.3 "Segoe UI", sans-serif; padding: 6px 2px 0; }
    </style></head>
    <body>
      <figure><img src="data:image/png;base64,${mock}" alt=""><figcaption>Mock</figcaption></figure>
      <figure><img src="data:image/png;base64,${shot}" alt=""><figcaption>1440 Chromium, fonts loaded</figcaption></figure>
    </body></html>`)
  const dest = path.join(outDir, 'compare-1440.png')
  await page.screenshot({ path: dest, fullPage: true })
  await browser.close()
  return dest
}

const rows = []
for (const engine of engines) {
  for (const viewport of viewports) {
    for (const pending of [false, true]) {
      try {
        const row = await runCase(engine.launch, engine.name, viewport, pending)
        rows.push(row)
        const mark = row.problems.length ? 'FAIL' : 'ok'
        console.log(`${mark} ${row.engine} ${row.viewport} ${row.mode} ${row.problems.join('; ')}`)
      } catch (error) {
        const mode = pending ? 'pending' : 'loaded'
        rows.push({
          engine: engine.name,
          viewport: viewport.name,
          mode,
          file: '',
          problems: [error.message.split('\n')[0]],
        })
        console.log(`FAIL ${engine.name} ${viewport.name} ${mode} ${error.message.split('\n')[0]}`)
      }
    }
  }
}

let compare = null
if (fs.existsSync(mockPath)) {
  compare = await sideBySide('chromium-1440-loaded.png')
} else {
  console.log(`work layout mock missing; skipped compare-1440.png (${mockPath})`)
}
fs.mkdirSync(publishDir, { recursive: true })
for (const file of fs.readdirSync(outDir)) {
  if (!file.endsWith('.png') && !file.endsWith('.json')) continue
  fs.copyFileSync(path.join(outDir, file), path.join(publishDir, file))
}
if (compare) fs.copyFileSync(compare, path.join(publishDir, 'compare-1440.png'))
const report = { url, rows: rows.map(({ problems, engine, viewport, mode, file, frame, fontStatus, stacked, beside }) => ({ engine, viewport, mode, file, frame, fontStatus, stacked, beside, problems })) }
fs.writeFileSync(path.join(outDir, 'work-layout.json'), JSON.stringify(report, null, 2))
fs.copyFileSync(path.join(outDir, 'work-layout.json'), path.join(publishDir, 'work-layout.json'))
const failed = rows.filter((row) => row.problems.length)
if (failed.length) {
  console.error(`${failed.length} layout cases failed`)
  process.exit(1)
}
console.log(`work layout ok ${rows.length} cases`)
