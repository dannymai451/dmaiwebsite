#!/usr/bin/env node
// About bottom edge: shirt meets ink, the stroke stays on top, nothing hangs below it, and the type stays inside.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const shots = path.join(root, 'artifacts', 'verify-dmaiwebsite', 'edges')
const url = process.env.VERIFY_URL ?? 'http://127.0.0.1:5199/'

const viewports = [
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
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
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
      } else if (filter !== 0) throw new Error(`png filter ${filter}`)
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
  return p[0] < 90 && p[1] < 90 && p[2] < 90 && Math.abs(p[0] - p[2]) <= 8
}

function dist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
}

function bandInner(start, end, step, sample) {
  let seen = false
  let gap = 0
  let edge = null
  for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
    if (sample(i)) {
      seen = true
      gap = 0
      edge = i
    } else if (seen) {
      gap += 1
      if (gap > 2) break
    }
  }
  return edge
}

function innerInk(hidden, frame) {
  const x0 = Math.max(0, Math.round(frame.x))
  const y0 = Math.max(0, Math.round(frame.y))
  const x1 = Math.min(hidden.width - 1, Math.round(frame.x + frame.width) - 1)
  const y1 = Math.min(hidden.height - 1, Math.round(frame.y + frame.height) - 1)
  const midX = Math.round((x0 + x1) / 2)
  const midY = Math.round((y0 + y1) / 2)
  const top = bandInner(y0, midY, 1, (y) => ink(at(hidden, midX, y)))
  const bottom = bandInner(y1, midY, -1, (y) => ink(at(hidden, midX, y)))
  const left = bandInner(x0, midX, 1, (x) => ink(at(hidden, x, midY)))
  const right = bandInner(x1, midX, -1, (x) => ink(at(hidden, x, midY)))
  if (top == null || bottom == null || left == null || right == null || bottom - top < 20) return null
  return { left, top, right, bottom }
}

function inside(box, inkBox) {
  return (
    box.right - box.x >= 8 &&
    box.bottom - box.y >= 8 &&
    box.x >= inkBox.left - 1 &&
    box.y >= inkBox.top - 1 &&
    box.right <= inkBox.right + 1 &&
    box.bottom <= inkBox.bottom + 1
  )
}

function judge(normal, hidden, geo) {
  const problems = []
  const inkBox = innerInk(hidden, geo.frame)
  if (!inkBox) problems.push('bottom stroke was not found')
  else {
    if (!inside(geo.title, inkBox)) problems.push('heading leaves the frame')
    if (!inside(geo.para, inkBox)) problems.push('paragraph leaves the frame')
  }
  if (geo.paraBox.scrollHeight > geo.paraBox.clientHeight + 1) {
    problems.push(`paragraph is clipped, scrollHeight ${geo.paraBox.scrollHeight} vs clientHeight ${geo.paraBox.clientHeight}`)
  }

  const x0 = Math.max(0, Math.floor(geo.photo.x))
  const x1 = Math.min(normal.width - 1, Math.ceil(geo.photo.right) - 1)
  const y0 = Math.max(0, Math.floor(geo.frame.bottom) - 64)
  const y1 = Math.min(normal.height - 1, Math.ceil(geo.frame.bottom) - 1)
  let tried = 0
  let covered = 0
  let gaps = 0
  let below = 0
  const samples = []

  if (geo.photo.h >= 8 && x1 > x0) {
    for (let x = x0; x <= x1; x++) {
      const inkYs = []
      for (let y = y0; y <= y1; y++) if (ink(at(hidden, x, y))) inkYs.push(y)
      if (!inkYs.length) continue
      const firstInk = inkYs[0]
      const lastInk = inkYs[inkYs.length - 1]
      let lastShirt = -1
      for (let y = y0; y < firstInk; y++) if (shirt(at(normal, x, y))) lastShirt = y
      if (lastShirt < 0 || lastShirt < firstInk - 6) continue
      tried += 1
      let gap = false
      for (let g = lastShirt + 1; g < firstInk; g++) if (paper(at(normal, x, g))) gap = true
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
        samples.push(`x=${x} shirt=${lastShirt} ink=${firstInk} seen=${at(normal, x, firstInk)} bare=${at(hidden, x, firstInk)}`)
      }
      for (let y = lastInk + 1; y <= y1; y++) {
        if (paper(at(hidden, x, y)) && shirt(at(normal, x, y))) {
          below += 1
          if (samples.length < 5) samples.push(`photo below the stroke at x=${x} y=${y}`)
          break
        }
      }
    }
  }

  const photoThere = geo.photo.h >= 8
  if (!photoThere && inkBox && geo.para.bottom < inkBox.bottom - 24) {
    problems.push('photo row collapsed with room under the paragraph')
  }
  if (photoThere && tried < 8) problems.push(`only ${tried} shirt columns met the stroke`)
  if (photoThere && gaps > Math.floor(tried * 0.08)) problems.push(`paper gap in ${gaps} of ${tried} columns`)
  if (photoThere && below > Math.floor(tried * 0.08)) problems.push(`photo below the stroke in ${below} of ${tried} columns`)
  if (photoThere && covered < Math.max(8, Math.ceil(tried * 0.9))) problems.push(`ink covers the shirt in ${covered} of ${tried} columns`)
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
  await page.waitForTimeout(400)
}

async function geometry(page) {
  return page.evaluate(() => {
    function clipped(el) {
      const rect = el.getBoundingClientRect()
      const box = { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
      for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node)
        const clip = node.getBoundingClientRect()
        if (style.overflowX !== 'visible') {
          box.x = Math.max(box.x, clip.x)
          box.right = Math.min(box.right, clip.right)
        }
        if (style.overflowY !== 'visible') {
          box.y = Math.max(box.y, clip.y)
          box.bottom = Math.min(box.bottom, clip.bottom)
        }
      }
      return box
    }
    const frame = document.querySelector('.about-reveal').getBoundingClientRect()
    const photo = document.querySelector('.about-photo').getBoundingClientRect()
    const paraEl = document.querySelector('.about-copy p')
    return {
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height, bottom: frame.bottom },
      photo: { x: photo.x, y: photo.y, right: photo.right, h: photo.height },
      title: clipped(document.querySelector('#about-title')),
      para: clipped(paraEl),
      paraBox: { scrollHeight: paraEl.scrollHeight, clientHeight: paraEl.clientHeight },
    }
  })
}

async function shoot(page) {
  const geo = await geometry(page)
  const normal = decodePNG(await page.screenshot())
  await page.addStyleTag({ content: '.about-photo { opacity: 0 !important; }' })
  await page.waitForTimeout(40)
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
      results.push({ label, ok, tried: verdict.tried, covered: verdict.covered, gaps: verdict.gaps, below: verdict.below, problems: verdict.problems, errors })
      const detail = ok ? `columns=${verdict.covered}` : [...verdict.problems, ...errors].join('; ')
      console.log(`${ok ? 'PASS' : 'FAIL'} ${label} ${detail}`)
    }
  }
  await browser.close()
  return results
}

fs.mkdirSync(shots, { recursive: true })
const results = [...(await runEngine('chromium', chromium)), ...(await runEngine('webkit', webkit))]
const failed = results.filter((row) => !row.ok)
fs.writeFileSync(path.join(shots, 'edges.json'), JSON.stringify({ url, results }, null, 2))
if (failed.length) {
  console.log(`FAIL ${failed.length} of ${results.length}`)
  process.exit(1)
}
console.log(`PASS ${results.length}`)
