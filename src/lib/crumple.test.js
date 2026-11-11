import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ABOUT_SCROLL,
  containRect,
  crumpleState,
  paperLight,
  scaleAbout,
  shadeChannels,
  smoothstep,
} from './crumple.js'

test('the photo scrubs the same range as the About fade', () => {
  assert.deepEqual(ABOUT_SCROLL, { start: 'top 96%', end: 'top 0%' })
})

test('flat paper writes neither channel, so it cannot tint', () => {
  const channels = shadeChannels(paperLight({ tilt: 0, crease: 0, ridge: 0 }))
  assert.equal(paperLight(), 0.5)
  assert.deepEqual(channels, { shadow: 255, highlight: 0 })
})

test('a dark facet only shadows and a light facet only highlights', () => {
  const dark = shadeChannels(paperLight({ tilt: -1 }))
  const light = shadeChannels(paperLight({ tilt: 1 }))
  assert.equal(dark.highlight, 0)
  assert.ok(dark.shadow < 255)
  assert.equal(light.shadow, 255)
  assert.ok(light.highlight > 0)
})

test('a crease darkens and the ridge beside it lightens', () => {
  const valley = shadeChannels(paperLight({ crease: 1 }))
  const ridge = shadeChannels(paperLight({ ridge: 1 }))
  assert.ok(valley.shadow < 60)
  assert.equal(valley.highlight, 0)
  assert.equal(ridge.shadow, 255)
  assert.ok(ridge.highlight > 180)
})

test('progress 0 is a shaded wad and progress 1 is the untouched photo', () => {
  const start = crumpleState(0)
  const end = crumpleState(1)
  assert.equal(start.wad, 1)
  assert.equal(start.half, 0)
  assert.equal(start.open, 0)
  assert.equal(start.shade, 1)
  assert.ok(start.scale < 0.7)
  assert.equal(start.flat, false)

  assert.equal(end.wad, 0)
  assert.equal(end.half, 0)
  assert.equal(end.open, 1)
  assert.equal(end.shade, 0)
  assert.equal(end.scale, 1)
  assert.equal(end.rotation, 0)
  assert.equal(end.flat, true)
})

test('the midpoint is opening, still fully creased, and not yet the flat photo', () => {
  const start = crumpleState(0)
  const mid = crumpleState(0.5)
  assert.ok(mid.shade > 0.9)
  assert.ok(mid.scale > start.scale + 0.05)
  assert.ok(mid.scale < 0.85)
  assert.ok(mid.wad + mid.half > 0.5)
  assert.equal(mid.flat, false)
})

test('scale opens, shade leaves, and the handoff is the real image', () => {
  let previous = crumpleState(0).scale
  for (let i = 1; i <= 20; i++) {
    const state = crumpleState(i / 20)
    assert.ok(state.scale >= previous - 1e-9, `scale dipped at ${i / 20}`)
    previous = state.scale
    for (const key of ['wad', 'half', 'open', 'scale', 'shade']) {
      assert.ok(state[key] >= 0 && state[key] <= 1, key)
    }
  }
  assert.equal(crumpleState(0.96).flat, false)
  assert.ok(crumpleState(0.96).shade > 0)
  const resting = crumpleState(0.97)
  assert.equal(resting.shade, 0)
  assert.equal(resting.scale, 1)
  assert.equal(resting.flat, true)
  assert.equal(crumpleState(0.999).flat, true)
})

test('the mapping is reversible because it is only a function of progress', () => {
  for (const progress of [0, 0.17, 0.5, 0.83, 1, -0.4, 1.6, Number.NaN]) {
    assert.deepEqual(crumpleState(progress), crumpleState(progress))
  }
  assert.deepEqual(crumpleState(-1), crumpleState(0))
  assert.deepEqual(crumpleState(2), crumpleState(1))
  assert.deepEqual(crumpleState(Number.NaN), crumpleState(0))
})

test('smoothstep is 0 and 1 at the edges', () => {
  assert.equal(smoothstep(0.2, 0.8, 0.2), 0)
  assert.equal(smoothstep(0.2, 0.8, 0.8), 1)
  assert.equal(smoothstep(0, 1, 0.5), 0.5)
})

test('contain rect matches object-fit, and scale 1 does not move it', () => {
  const bottomRight = containRect(200, 400, 570, 657, 'right bottom')
  assert.ok(Math.abs(bottomRight.w - 200) < 1e-6)
  assert.ok(bottomRight.x < 1e-6)
  assert.ok(bottomRight.y > 100)

  const centered = containRect(400, 200, 570, 657, '50% 100%')
  assert.ok(Math.abs(centered.h - 200) < 1e-6)
  assert.ok(centered.y < 1e-6)
  assert.ok(centered.x > 100)

  assert.deepEqual(scaleAbout(centered, 1), centered)
  const shrunk = scaleAbout(centered, 0.5)
  assert.ok(Math.abs(shrunk.w - centered.w * 0.5) < 1e-6)
  assert.ok(Math.abs(shrunk.x + shrunk.w / 2 - (centered.x + centered.w / 2)) < 1e-6)
})
