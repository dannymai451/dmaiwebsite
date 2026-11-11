// Procedural paper. Drawn at runtime from a seeded PRNG.
// Original work. No photographed textures, and nothing from imagetopaper.com.

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function foldCurve(rand, size, length) {
  const x0 = size * (0.06 + rand() * 0.88)
  const y0 = size * (0.06 + rand() * 0.88)
  const len = size * length
  const ang = rand() * Math.PI * 2
  const bend = (rand() - 0.5) * 1.5
  const mx = x0 + Math.cos(ang) * len * 0.5
  const my = y0 + Math.sin(ang) * len * 0.5
  return {
    x0,
    y0,
    cx: mx + Math.cos(ang + Math.PI / 2) * len * bend * 0.32,
    cy: my + Math.sin(ang + Math.PI / 2) * len * bend * 0.32,
    x1: x0 + Math.cos(ang) * len,
    y1: y0 + Math.sin(ang) * len,
  }
}

function strokeFold(ctx, fold, offset, color, width, blur) {
  const dx = fold.x1 - fold.x0
  const dy = fold.y1 - fold.y0
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * offset
  const ny = (dx / len) * offset
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.filter = `blur(${blur}px)`
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(fold.x0 + nx, fold.y0 + ny)
  ctx.quadraticCurveTo(fold.cx + nx, fold.cy + ny, fold.x1 + nx, fold.y1 + ny)
  ctx.stroke()
  ctx.restore()
}

function makeCreaseMaps(size, seed) {
  const rand = mulberry32(seed)
  const shadow = document.createElement('canvas')
  const highlight = document.createElement('canvas')
  shadow.width = highlight.width = size
  shadow.height = highlight.height = size
  const sctx = shadow.getContext('2d')
  const hctx = highlight.getContext('2d')
  sctx.fillStyle = '#ffffff'
  sctx.fillRect(0, 0, size, size)
  hctx.fillStyle = '#000000'
  hctx.fillRect(0, 0, size, size)

  // A fold is a soft valley on the shadow side of a curve and a soft ridge on
  // the lit side. Wide blurred strokes, so the crease reads as paper and not
  // as a hairline drawn on top of the photo.
  for (let i = 0; i < 7; i++) {
    const fold = foldCurve(rand, size, 0.26 + rand() * 0.22)
    const shade = 0.58 + rand() * 0.22
    const lift = 0.48 + rand() * 0.18
    const width = 16 + rand() * 12
    strokeFold(sctx, fold, 9, `rgba(36, 24, 14, ${shade})`, width, 2.6)
    strokeFold(hctx, fold, -8, `rgba(255, 255, 255, ${lift})`, width * 0.8, 2.4)
  }
  for (let i = 0; i < 5; i++) {
    const fold = foldCurve(rand, size, 0.12 + rand() * 0.12)
    strokeFold(sctx, fold, 5, `rgba(32, 20, 12, ${0.5 + rand() * 0.2})`, 10 + rand() * 6, 2)
    strokeFold(hctx, fold, -4, `rgba(255, 255, 255, ${0.4 + rand() * 0.16})`, 8 + rand() * 5, 1.8)
  }

  return { shadow, highlight }
}

function crumpledPath(rand, cx, cy, rx, ry) {
  const path = new Path2D()
  const count = 16
  const pts = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const jitter = 0.84 + rand() * 0.22
    pts.push([cx + Math.cos(angle) * rx * jitter, cy + Math.sin(angle) * ry * jitter])
  }
  path.moveTo((pts[0][0] + pts[count - 1][0]) / 2, (pts[0][1] + pts[count - 1][1]) / 2)
  for (let i = 0; i < count; i++) {
    const curr = pts[i]
    const next = pts[(i + 1) % count]
    path.quadraticCurveTo(curr[0], curr[1], (curr[0] + next[0]) / 2, (curr[1] + next[1]) / 2)
  }
  path.closePath()
  return path
}

function shadeSheet(ctx, rand, size) {
  for (let i = 0; i < 24; i++) {
    const x = rand() * size
    const y = rand() * size
    const rx = size * (0.05 + rand() * 0.16)
    const ry = rx * (0.4 + rand() * 0.5)
    const g = ctx.createRadialGradient(x, y, rx * 0.05, x, y, rx)
    const dark = rand() > 0.42
    g.addColorStop(0, dark ? `rgba(55, 40, 26, ${0.16 + rand() * 0.28})` : `rgba(255, 253, 248, ${0.2 + rand() * 0.35})`)
    g.addColorStop(1, 'rgba(255, 253, 248, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
}

function makeWad(size, seed) {
  const rand = mulberry32(seed)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const paths = []
  const cluster = [
    [0.5, 0.5, 0.46, 0.42],
    [0.3, 0.46, 0.3, 0.28],
    [0.7, 0.48, 0.28, 0.3],
    [0.48, 0.72, 0.32, 0.24],
    [0.52, 0.28, 0.26, 0.24],
    [0.66, 0.68, 0.22, 0.2],
  ]
  for (const [x, y, rx, ry] of cluster) {
    paths.push(crumpledPath(rand, x * size, y * size, rx * size, ry * size))
  }
  const union = new Path2D()
  for (const path of paths) union.addPath(path)
  ctx.save()
  ctx.clip(union)
  ctx.fillStyle = '#f3efe6'
  ctx.fillRect(0, 0, size, size)
  shadeSheet(ctx, rand, size)
  const glow = ctx.createRadialGradient(size * 0.42, size * 0.4, size * 0.08, size * 0.5, size * 0.5, size * 0.52)
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.28)')
  glow.addColorStop(0.45, 'rgba(255, 255, 255, 0)')
  glow.addColorStop(1, 'rgba(48, 34, 22, 0.45)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)
  ctx.restore()
  return canvas
}

function makeHalf(size, seed) {
  const rand = mulberry32(seed)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const sheet = crumpledPath(rand, size * 0.52, size * 0.5, size * 0.48, size * 0.4)
  const bunch = crumpledPath(rand, size * 0.26, size * 0.5, size * 0.24, size * 0.26)
  const flap = crumpledPath(rand, size * 0.72, size * 0.32, size * 0.2, size * 0.12)
  const union = new Path2D()
  union.addPath(sheet)
  union.addPath(bunch)
  union.addPath(flap)
  ctx.save()
  ctx.clip(union)
  ctx.fillStyle = '#f6f1e8'
  ctx.fillRect(0, 0, size, size)
  shadeSheet(ctx, rand, size)
  ctx.fillStyle = 'rgba(62, 46, 30, 0.16)'
  ctx.fill(flap)
  ctx.restore()
  return canvas
}

let cached = null

export function paperTextures() {
  if (cached) return cached
  const size = 384
  const creases = makeCreaseMaps(size, 0x51f00d)
  cached = {
    shadow: creases.shadow,
    highlight: creases.highlight,
    wad: makeWad(size, 0x0a11e),
    half: makeHalf(size, 0x5e1a),
  }
  return cached
}
