// Scroll progress for the About photo. Pure: no DOM, no canvas.
// The fade in About.jsx uses the same start and end.

export const ABOUT_SCROLL = {
  start: 'top 96%',
  end: 'top 0%',
}

// Flat paper sits at 0.5. Below that is a shadow, above that is a highlight.
// Splitting them is what makes a crease show on a white cheek and a black shirt:
// multiply never lifts black, and screen never darkens white.
export function paperLight({ tilt = 0, crease = 0, ridge = 0 } = {}) {
  let light = 0.5 + tilt * 0.1 - crease * 0.5 + ridge * 0.5
  if (light < 0) return 0
  if (light > 1) return 1
  return light
}

export function shadeChannels(light) {
  const lit = light < 0 ? 0 : light > 1 ? 1 : light
  const shadow = lit < 0.5 ? (0.5 - lit) * 2 : 0
  const highlight = lit > 0.5 ? (lit - 0.5) * 2 : 0
  return {
    shadow: Math.round(255 - shadow * 210),
    highlight: Math.round(highlight * 255),
  }
}

export function smoothstep(edge0, edge1, value) {
  const span = edge1 - edge0
  if (span === 0) return value >= edge1 ? 1 : 0
  const t = clamp01((value - edge0) / span)
  return t * t * (3 - 2 * t)
}

function clamp01(value) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function finiteProgress(progress) {
  const value = Number(progress)
  if (!Number.isFinite(value)) return 0
  return clamp01(value)
}

// Weights crossfade. `scale` is the photo's size inside its object-fit box
// (1 matches the real <img>). `shade` is crease strength and is 0 once the
// sheet is open. `flat` hands the pixels back to that <img>.
export function crumpleState(progress) {
  const p = finiteProgress(progress)
  // The photo sits low in the section, so it is still off-screen during the
  // first part of the fade. Hold the wad until it enters, then open.
  const wad = 1 - smoothstep(0.4, 0.62, p)
  const half = smoothstep(0.36, 0.56, p) * (1 - smoothstep(0.6, 0.82, p))
  const open = smoothstep(0.56, 0.84, p)
  const sum = wad + half + open || 1
  const wadMix = wad / sum
  const halfMix = half / sum
  const openMix = open / sum
  const scale = 0.5 * wadMix + 0.74 * halfMix + openMix
  const shade = 1 - smoothstep(0.7, 0.97, p)
  const rotation = wadMix === 0 ? 0 : -0.1 * wadMix
  const effectGone = shade === 0 && scale === 1 && wadMix === 0 && halfMix === 0 && rotation === 0
  const flat = p >= 0.999 || effectGone
  return {
    wad: wadMix,
    half: halfMix,
    open: openMix,
    scale,
    shade,
    rotation,
    flat,
  }
}

function place(token, box, size) {
  if (token == null) return (box - size) / 2
  if (token === 'left' || token === 'top') return 0
  if (token === 'center') return (box - size) / 2
  if (token === 'right' || token === 'bottom') return box - size
  if (token.endsWith('%')) return ((box - size) * parseFloat(token)) / 100
  if (token.endsWith('px')) return parseFloat(token)
  return (box - size) / 2
}

// Same geometry as object-fit: contain. scale 1 then lands on the <img>.
export function containRect(boxW, boxH, imgW, imgH, objectPosition = '50% 50%') {
  const scale = Math.min(boxW / imgW, boxH / imgH)
  const w = imgW * scale
  const h = imgH * scale
  const parts = String(objectPosition).trim().split(/\s+/)
  return {
    x: place(parts[0], boxW, w),
    y: place(parts[1], boxH, h),
    w,
    h,
  }
}

export function scaleAbout(rect, scale) {
  const w = rect.w * scale
  const h = rect.h * scale
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}
