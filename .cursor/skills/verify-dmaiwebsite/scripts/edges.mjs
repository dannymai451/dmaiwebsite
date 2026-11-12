#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const shots = path.join(root, 'artifacts', 'verify-dmaiwebsite', 'edges')
const url = process.env.VERIFY_URL ?? 'http://127.0.0.1:5199/'

const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '320', width: 320, height: 700 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
]

const modes = [
  { name: 'fonts', blockFonts: false, zoom: false },
  { name: 'fonts-blocked', blockFonts: true, zoom: false },
  { name: 'zoom-150', blockFonts: false, zoom: true },
]

function decodePNG(buf) {
  let p = 8
  let width = 0
  let height = 0
  let colorType = 6
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    p += 4
    const type = buf.toString('ascii', p, p + 4)
    p += 4
    const data = buf.subarray(p, p + len)
    p += len + 4
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (!channels) throw new Error(`unsupported png color type ${colorType}`)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = width * bpp
  const out = Buffer.alloc(width * height * bpp)
  let s = 0
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[s]
    s += 1
    const row = Buffer.from(raw.subarray(s, s + stride))
    s += stride
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? row[i - bpp] : 0
      const up = prev[i]
      const ul = i >= bpp ? prev[i - bpp] : 0
      let pred = 0
      if (filter === 1) pred = left
      else if (filter === 2) pred = up
      else if (filter === 3) pred = Math.floor((left + up) / 2)
      else if (filter === 4) {
        const pa = Math.abs(left + up - ul - left)
        const pb = Math.abs(left + up - ul - up)
        const pc = Math.abs(left + up - ul - ul)
        pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul
      } else if (filter !== 0) {
        throw new Error(`png filter ${filter}`)
      }
      row[i] = (row[i] + pred) & 255
    }
    row.copy(out, y * stride)
    prev = row
  }
  return { width, height, channels, data: out }
}

function at(img, x, y) {
  const i = (y * img.width + x) * img.channels
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}

function paper(p) {
  return p[0] > 170 && p[1] > 170 && p[2] > 170
}

function ink(p) {
  return p[0] < 120 && p[2] < 100 && p[0] - p[2] >= 4 && p[1] <= p[0]
}

function shirt(p) {
  return p[0] < 90 && p[1] < 90 && p[2] < 90 && Math.abs(p[0] - p[2]) <= 4 && !paper(p)
}

function dist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
}

function judge(normal, hidden, geo) {
  const x0 = Math.max(0, Math.floor(geo.photo.x))
  const x1 = Math.min(normal.width - 1, Math.ceil(geo.photo.x + geo.photo.width))
  const y0 = Math.max(0, Math.floor(geo.frame.y + geo.frame.height) - 48)
  const y1 = Math.min(normal.height - 1, Math.ceil(geo.frame.y + geo.frame.height) - 1)
  let tried = 0
  let covered = 0
  let gaps = 0
  let below = 0
  const samples = []

  for (let x = x0; x <= x1; x++) {
    const inkYs = []
    for (let y = y0; y <= y1; y++) {
      if (ink(at(hidden, x, y))) inkYs.push(y)
    }
    if (!inkYs.length) continue
    const firstInk = inkYs[0]
    const lastInk = inkYs[inkYs.length - 1]
    let lastShirt = -1
    for (let y = y0; y < firstInk; y++) {
      if (shirt(at(normal, x, y))) lastShirt = y
    }
    if (lastShirt < 0 || lastShirt < firstInk - 6) continue
    tried += 1

    let gap = false
    for (let g = lastShirt + 1; g < firstInk; g++) {
      if (paper(at(normal, x, g))) gap = true
    }
    if (gap) gaps += 1

    let changed = false
    let inkOnTop = false
    for (const y of inkYs) {
      const seen = at(normal, x, y)
      if (ink(seen)) inkOnTop = true
      if (dist(seen, at(hidden, x, y)) >= 1) changed = true
    }
    if (changed && inkOnTop && !gap) covered += 1
    else if (samples.length < 3) {
      samples.push(
        `x=${x} shirt=${lastShirt} ink=${firstInk} normal=${at(normal, x, firstInk)} hidden=${at(hidden, x, firstInk)}`,
      )
    }

    for (let y = lastInk + 1; y <= y1; y++) {
      const seen = at(normal, x, y)
      const bare = at(hidden, x, y)
      if (paper(bare) && shirt(seen)) {
        below += 1
        if (samples.length < 4) samples.push(`photo below the stroke at x=${x} y=${y}`)
        break
      }
    }
  }

  const problems = []
  const innerTop = geo.frame.y + geo.inset
  const innerBottom = geo.frame.y + geo.frame.height - geo.inset
  if (geo.titleTop < innerTop - 1) {
    problems.push(`heading leaves the frame, title ${Math.round(geo.titleTop)} inner ${Math.round(innerTop)}`)
  }
  if (geo.paraScroll > geo.paraClient + 1) {
    problems.push(`paragraph is clipped, scrollHeight ${geo.paraScroll} vs clientHeight ${geo.paraClient}`)
  }
  const photoBottom = geo.photo.y + geo.photo.height
  const frameBottom = geo.frame.y + geo.frame.height
  const overlap = Math.min(photoBottom, frameBottom) - Math.max(geo.photo.y, geo.frame.y)
  if (overlap >= 8) {
    if (tried < 8) problems.push(`only ${tried} shirt columns met the stroke`)
    if (gaps > Math.floor(tried * 0.08)) problems.push(`paper gap in ${gaps} of ${tried} columns`)
    if (below > Math.floor(tried * 0.08)) problems.push(`photo below the stroke in ${below} of ${tried} columns`)
    if (covered < Math.max(8, Math.ceil(tried * 0.9))) {
      problems.push(`ink covers the shirt in ${covered} of ${tried} columns`)
    }
  } else if (geo.paraBottom < innerBottom - 24) {
    problems.push('photo row collapsed with room under the paragraph')
  }
  if (problems.length && samples.length) problems.push(samples.join('; '))
  return { tried, covered, gaps, below, problems }
}

async function settle(page, zoom) {
  if (zoom) await page.addStyleTag({ content: 'html { font-size: 150% !important; }' })
  await page.addStyleTag({ content: 'html { scroll-snap-type: none !important; }' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => document.querySelector('.about-photo')?.decode?.())
  await page.evaluate(() => {
    const about = document.querySelector('section.about')
    window.scrollTo(0, about.getBoundingClientRect().top + window.scrollY)
  })
  await page.waitForTimeout(500)
}

async function shoot(page) {
  const geo = await page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const reveal = document.querySelector('.about-reveal')
    const para = document.querySelector('.about-copy p')
    const inset = parseFloat(getComputedStyle(reveal).getPropertyValue('--ink-inset')) || 0
    return {
      frame: box(reveal),
      photo: box(document.querySelector('.about-photo')),
      titleTop: document.querySelector('.about-title').getBoundingClientRect().y,
      paraBottom: para.getBoundingClientRect().bottom,
      paraScroll: para.scrollHeight,
      paraClient: para.clientHeight,
      inset,
    }
  })
  const normal = decodePNG(await page.screenshot())
  await page.addStyleTag({ content: '.about-photo { opacity: 0 !important; }' })
  await page.waitForTimeout(50)
  const hidden = decodePNG(await page.screenshot())
  return judge(normal, hidden, geo)
}

async function runEngine(engine, browserType) {
  const browser = await browserType.launch({ headless: true })
  const results = []
  for (const viewport of viewports) {
    for (const mode of modes) {
      const label = `${engine} ${viewport.name} ${mode.name}`
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      })
      if (mode.blockFonts) {
        await page.route('**/*', (route) => {
          const hit = route.request().url()
          if (hit.includes('fonts.googleapis.com') || hit.includes('fonts.gstatic.com')) {
            route.abort()
            return
          }
          route.continue()
        })
      }
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(url, { waitUntil: 'networkidle' })
      await settle(page, mode.zoom)
      const verdict = await shoot(page)
      await page.close()
      const ok = verdict.problems.length === 0 && errors.length === 0
      results.push({ label, ok, ...verdict, errors })
      const detail = ok
        ? `columns=${verdict.covered}`
        : [...verdict.problems, ...errors].join('; ')
      console.log(`${ok ? 'PASS' : 'FAIL'} ${label} ${detail}`)
    }
  }
  await browser.close()
  return results
}

const greetingViewports = [
  { name: '320', width: 320, height: 844 },
  { name: '375', width: 375, height: 844 },
  { name: '390', width: 390, height: 844 },
  { name: '393', width: 393, height: 844 },
  { name: '430', width: 430, height: 844 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
]

const greetingModes = [
  { name: 'loaded', blockFonts: false },
  { name: 'loading', blockFonts: true },
]

const greetingClearance = 26

function darkPixel(img, x, y) {
  const i = (y * img.width + x) * img.channels
  return img.data[i] < 160 && img.data[i + 1] < 160 && img.data[i + 2] < 160
}

function greetingGap(withBorder, bare, geo) {
  const dpr = withBorder.width / geo.vw
  const y0 = Math.max(0, Math.floor((geo.top - 20) * dpr))
  const y1 = Math.min(withBorder.height - 1, Math.ceil((geo.bottom + 24) * dpr))
  let right = Infinity
  let left = Infinity
  for (let y = y0; y <= y1; y++) {
    let glyphL = -1
    let glyphR = -1
    for (let x = 0; x < bare.width; x++) {
      if (!darkPixel(bare, x, y)) continue
      if (glyphL < 0) glyphL = x
      glyphR = x
    }
    if (glyphR < 0) continue
    for (let x = glyphR + 1; x < withBorder.width; x++) {
      if (!darkPixel(withBorder, x, y)) continue
      right = Math.min(right, (x - glyphR) / dpr)
      break
    }
    for (let x = glyphL - 1; x >= 0; x--) {
      if (!darkPixel(withBorder, x, y)) continue
      left = Math.min(left, (glyphL - x) / dpr)
      break
    }
  }
  return {
    right: Number.isFinite(right) ? right : null,
    left: Number.isFinite(left) ? left : null,
  }
}

async function greetingCase(browser, engine, viewport, mode) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: viewport.width < 900,
    hasTouch: viewport.width < 900,
  })
  if (mode.blockFonts) {
    await page.route('**/*', (route) => {
      const hit = route.request().url()
      if (hit.includes('fonts.googleapis.com') || hit.includes('fonts.gstatic.com')) {
        route.abort()
        return
      }
      route.continue()
    })
  }
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => parseFloat(document.querySelector('.hero .panel-frame-fill')?.style.width) > 40)
  if (!mode.blockFonts) await page.evaluate(() => document.fonts.load('700 64px Caveat'))
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.hero-intro')).opacity) > 0.99)
  const geo = await page.evaluate((vw) => {
    const head = document.querySelector('.hero-greeting').getBoundingClientRect()
    const fill = document.querySelector('.hero .panel-frame-fill').getBoundingClientRect()
    const links = document.querySelector('.hero-links').getBoundingClientRect()
    const images = [...document.querySelectorAll('.hero-hoptimists img')].map((image) => {
      const box = image.getBoundingClientRect()
      return { pastLeft: -box.left, pastRight: box.right - innerWidth }
    })
    return {
      vw,
      top: head.top,
      bottom: head.bottom,
      fontSize: getComputedStyle(document.querySelector('.hero-greeting')).fontSize,
      linkPastLeft: fill.left - links.left,
      linkPastRight: links.right - fill.right,
      images,
    }
  }, viewport.width)
  const withBorder = decodePNG(await page.screenshot())
  await page.evaluate(() => {
    document.querySelectorAll('.hero .panel-frame-ink').forEach((el) => {
      el.style.opacity = '0'
    })
  })
  const bare = decodePNG(await page.screenshot())
  await page.close()
  const gap = greetingGap(withBorder, bare, geo)
  const problems = []
  if (gap.right == null || gap.left == null) problems.push('greeting ink was not found')
  if (gap.right != null && gap.right < greetingClearance) {
    problems.push(`greeting ink is ${gap.right.toFixed(1)}px from the inner edge`)
  }
  if (gap.left != null && gap.left < greetingClearance) {
    problems.push(`greeting ink is ${gap.left.toFixed(1)}px from the left inner edge`)
  }
  if (geo.linkPastRight > 0.5 || geo.linkPastLeft > 0.5) problems.push('links cross the card')
  geo.images.forEach((image, index) => {
    if (image.pastLeft > 0.5 || image.pastRight > 0.5) problems.push(`figure ${index} crosses the viewport`)
  })
  return {
    label: `${engine} greeting ${viewport.name} ${mode.name}`,
    ok: problems.length === 0 && errors.length === 0,
    fontSize: geo.fontSize,
    gapRight: gap.right,
    gapLeft: gap.left,
    problems,
    errors,
  }
}

async function runGreeting(engine, browserType) {
  const browser = await browserType.launch({ headless: true })
  const results = []
  for (const viewport of greetingViewports) {
    for (const mode of greetingModes) {
      const row = await greetingCase(browser, engine, viewport, mode)
      results.push(row)
      const detail = row.ok
        ? `gap=${row.gapRight?.toFixed(1)} fs=${row.fontSize}`
        : [...row.problems, ...row.errors].join('; ')
      console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.label} ${detail}`)
    }
  }
  await browser.close()
  return results
}

fs.mkdirSync(shots, { recursive: true })
const greeting = [
  ...(await runGreeting('webkit', webkit)),
  ...(await runGreeting('chromium', chromium)),
]
const results = [
  ...(await runEngine('chromium', chromium)),
  ...(await runEngine('webkit', webkit)),
]
const failed = [...greeting, ...results].filter((row) => !row.ok)
fs.writeFileSync(path.join(shots, 'edges.json'), JSON.stringify({ url, greeting, results }, null, 2))
if (failed.length) {
  console.log(`FAIL ${failed.length} of ${greeting.length + results.length}`)
  process.exit(1)
}
console.log(`PASS ${greeting.length + results.length}`)
