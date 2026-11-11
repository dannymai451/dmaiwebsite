import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const SHOTS = path.join('artifacts', 'crumple')

function scrollAbout(at) {
  const about = document.querySelector('section.about')
  const top = about.getBoundingClientRect().top + window.scrollY
  window.scrollTo(0, Math.max(0, top - at * window.innerHeight))
  return about.getBoundingClientRect().top / window.innerHeight
}

async function openSite(page, { reduced = false } = {}) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: 'html { scroll-snap-type: none !important; }' })
  const snap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)
  expect(snap).toBe('none')
  await expect(page.locator('img.about-photo')).toBeAttached()
}

async function goToProgress(page, progress) {
  const at = 0.96 * (1 - progress)
  const actual = await page.evaluate(scrollAbout, at)
  expect(Math.abs(actual - at), `about top landed at ${actual}, wanted ${at}`).toBeLessThan(0.02)
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
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

test('creases darken light pixels, lighten dark pixels, and leave the cutout empty', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const pixels = await page.evaluate(async () => {
    const { applyCreases } = await import('/src/lib/applyCreases.js')
    const photo = document.createElement('canvas')
    photo.width = 4
    photo.height = 1
    const ctx = photo.getContext('2d', { willReadFrequently: true })
    ctx.imageSmoothingEnabled = false
    const image = ctx.createImageData(4, 1)
    image.data.set([
      0, 0, 0, 0,
      255, 255, 255, 255,
      0, 0, 0, 255,
      140, 140, 140, 255,
    ])
    ctx.putImageData(image, 0, 0)

    const stamp = document.createElement('canvas')
    stamp.width = 4
    stamp.height = 1
    const stampCtx = stamp.getContext('2d')
    stampCtx.imageSmoothingEnabled = false
    stampCtx.drawImage(photo, 0, 0)

    const shadow = document.createElement('canvas')
    shadow.width = 4
    shadow.height = 1
    const shadowData = shadow.getContext('2d').createImageData(4, 1)
    shadowData.data.set([
      255, 255, 255, 255,
      40, 40, 40, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ])
    shadow.getContext('2d').putImageData(shadowData, 0, 0)

    const highlight = document.createElement('canvas')
    highlight.width = 4
    highlight.height = 1
    const highlightData = highlight.getContext('2d').createImageData(4, 1)
    highlightData.data.set([
      0, 0, 0, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
    ])
    highlight.getContext('2d').putImageData(highlightData, 0, 0)

    applyCreases(ctx, {
      shade: 1,
      shadow,
      highlight,
      stamp,
      rect: { x: 0, y: 0, w: 4, h: 1 },
      cssW: 4,
      cssH: 1,
    })
    return Array.from(ctx.getImageData(0, 0, 4, 1).data)
  })

  expect(pixels[3], 'transparent cutout stays empty').toBe(0)
  expect(pixels[4], 'a light pixel picks up the shadow').toBeLessThan(80)
  expect(pixels[7]).toBe(255)
  expect(pixels[8], 'a dark pixel picks up the ridge').toBeGreaterThan(200)
  expect(pixels[11]).toBe(255)
  expect(pixels[12], 'flat paper does not tint').toBeGreaterThan(120)
  expect(pixels[12]).toBeLessThan(160)
  expect(pixels[15]).toBe(255)
})

test('scroll progress crumples, then hands the pixels back to the real photo', async ({ page }) => {
  await openSite(page)
  fs.mkdirSync(SHOTS, { recursive: true })

  await goToProgress(page, 0)
  const start = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.about-photo-paper')
    const img = document.querySelector('img.about-photo')
    return {
      canvas: Boolean(canvas),
      flat: canvas?.classList.contains('is-flat') ?? null,
      covered: img.classList.contains('is-covered'),
    }
  })
  expect(start.canvas).toBe(true)
  expect(start.flat).toBe(false)
  expect(start.covered).toBe(true)

  await goToProgress(page, 0.5)
  const mid = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.about-photo-paper')
    return {
      flat: canvas.classList.contains('is-flat'),
      covered: document.querySelector('img.about-photo').classList.contains('is-covered'),
    }
  })
  expect(mid.flat).toBe(false)
  expect(mid.covered).toBe(true)

  await goToProgress(page, 1)
  const end = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.about-photo-paper')
    const img = document.querySelector('img.about-photo')
    const slot = document.querySelector('.about-photo-slot').getBoundingClientRect()
    return {
      visibility: getComputedStyle(canvas).visibility,
      imgOpacity: getComputedStyle(img).opacity,
      covered: img.classList.contains('is-covered'),
      src: img.getAttribute('src'),
      dpr: canvas.width / canvas.clientWidth,
      slot: { x: slot.x, y: slot.y, width: slot.width, height: slot.height },
    }
  })
  expect(end.visibility).toBe('hidden')
  expect(end.covered).toBe(false)
  expect(Number(end.imgOpacity)).toBe(1)
  expect(end.src).toBe('/me.webp')
  expect(end.dpr).toBeGreaterThan(0)

  const clip = {
    x: Math.max(0, end.slot.x),
    y: Math.max(0, end.slot.y),
    width: end.slot.width,
    height: end.slot.height,
  }
  const withEffect = await page.screenshot({ path: path.join(SHOTS, 'end-with-effect.png'), clip })
  await page.evaluate(() => document.querySelector('canvas.about-photo-paper').remove())
  const original = await page.screenshot({ path: path.join(SHOTS, 'end-original.png'), clip })
  expect(Buffer.compare(withEffect, original), 'flat handoff matches the real photo').toBe(0)
})

test('reduced motion never mounts the paper canvas', async ({ page }) => {
  await openSite(page, { reduced: true })
  await expect(page.locator('canvas.about-photo-paper')).toHaveCount(0)
  const img = page.locator('img.about-photo')
  await expect(img).toBeVisible()
  await expect(img).toHaveAttribute('src', '/me.webp')
  await goToProgress(page, 0)
  await expect(page.locator('canvas.about-photo-paper')).toHaveCount(0)
  await expect(img).not.toHaveClass(/is-covered/)
})
