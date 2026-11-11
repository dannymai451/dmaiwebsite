import { useEffect, useRef } from 'react'
import './Frame.css'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function inkBorder(ctx, pts, { width, color, alpha, seed, amp }) {
  const rand = mulberry32(seed)
  const phase = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2]
  const f1 = 0.011 + rand() * 0.008
  const f2 = 0.037 + rand() * 0.02
  const dist = [0]
  for (let i = 1; i < pts.length; i++) {
    dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  const q = pts.map((p, i) => {
    const s = dist[i]
    return [
      p[0] + amp * (Math.sin(s * f1 + phase[0]) + 0.5 * Math.sin(s * f2 + phase[1])),
      p[1] + amp * (Math.cos(s * f1 * 1.3 + phase[1]) + 0.5 * Math.sin(s * f2 * 0.8 + phase[2])),
    ]
  })
  q.push(q[0])

  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(q[0][0], q[0][1])
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1])
  ctx.stroke()
  ctx.restore()
}

// The bottom stroke has to paint over the shirt, and a full-size layer
// above the type changes how Chromium draws the glyphs. This copies just
// the bottom strip, keeps ink only where the cutout is opaque, and clips
// the hem so the shirt stops at the stroke.
function liftBottomStroke(host, bottom) {
  const reveal = host.parentElement
  const hem = reveal?.querySelector('.about-hem')
  const existing = reveal?.querySelector(':scope > .panel-frame-lip')
  if (!hem || !bottom.width) {
    existing?.remove()
    return
  }

  const lip = existing ?? document.createElement('canvas')
  lip.className = 'panel-frame-lip'
  lip.setAttribute('aria-hidden', 'true')
  if (!existing) reveal.appendChild(lip)

  const revealBox = reveal.getBoundingClientRect()
  const stripBox = bottom.getBoundingClientRect()
  const dpr = bottom.width / stripBox.width
  lip.width = bottom.width
  lip.height = bottom.height
  lip.style.left = `${stripBox.left - revealBox.left}px`
  lip.style.top = `${stripBox.top - revealBox.top}px`
  lip.style.width = `${stripBox.width}px`
  lip.style.height = `${stripBox.height}px`

  const ctx = lip.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, lip.width, lip.height)
  ctx.drawImage(bottom, 0, 0)

  const mask = document.createElement('canvas')
  mask.width = lip.width
  mask.height = lip.height
  const maskCtx = mask.getContext('2d')
  for (const img of reveal.querySelectorAll('.about-photo, .about-hem img')) {
    drawContain(maskCtx, img, stripBox, dpr)
  }
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-over'

  clipHemToStroke(hem, bottom, stripBox)
}

function drawContain(ctx, img, stripBox, dpr) {
  if (!img.complete || !img.naturalWidth) return
  const box = img.getBoundingClientRect()
  const fit = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight)
  const dw = img.naturalWidth * fit
  const dh = img.naturalHeight * fit
  const [px, py] = getComputedStyle(img).objectPosition.split(/\s+/)
  const ox = place(px, box.width, dw)
  const oy = place(py, box.height, dh)
  ctx.drawImage(
    img,
    (box.left - stripBox.left + ox) * dpr,
    (box.top - stripBox.top + oy) * dpr,
    dw * dpr,
    dh * dpr,
  )
}

function place(part, boxSize, contentSize) {
  if (!part || part === 'center') return (boxSize - contentSize) / 2
  if (part === 'left' || part === 'top' || part === '0%') return 0
  if (part === 'right' || part === 'bottom' || part === '100%') return boxSize - contentSize
  if (part.endsWith('%')) return (boxSize - contentSize) * (parseFloat(part) / 100)
  return (boxSize - contentSize) / 2
}

function clipHemToStroke(hem, bottom, stripBox) {
  const hemBox = hem.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(hemBox.width))
  const height = Math.max(1, Math.ceil(hemBox.height))
  const dpr = bottom.width / stripBox.width
  const pixels = bottom.getContext('2d').getImageData(0, 0, bottom.width, bottom.height).data
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const image = mask.getContext('2d').createImageData(width, height)
  for (let x = 0; x < width; x++) {
    const srcX = Math.round((hemBox.left - stripBox.left + x) * dpr)
    let last = -1
    if (srcX >= 0 && srcX < bottom.width) {
      for (let y = 0; y < bottom.height; y++) {
        if (pixels[(y * bottom.width + srcX) * 4 + 3] > 140) last = y
      }
    }
    const cut = last < 0 ? -1 : ((last + 1) / dpr) + stripBox.top - hemBox.top
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4
      const on = y + 1 <= cut + 0.01
      image.data[i] = 255
      image.data[i + 1] = 255
      image.data[i + 2] = 255
      image.data[i + 3] = on ? 255 : 0
    }
  }
  mask.getContext('2d').putImageData(image, 0, 0)
  const url = `url("${mask.toDataURL()}")`
  hem.style.maskImage = url
  hem.style.webkitMaskImage = url
  hem.style.maskSize = '100% 100%'
  hem.style.webkitMaskSize = '100% 100%'
  hem.style.maskRepeat = 'no-repeat'
  hem.style.webkitMaskRepeat = 'no-repeat'
}

export default function Frame({ paper = '#fff', width = '100%', height = '100%' }) {
  const ref = useRef(null)
  const fillRef = useRef(null)

  useEffect(() => {
    const host = ref.current
    const fill = fillRef.current?.querySelector('.panel-frame-fill')
    if (!host || !fill) return
    const strips = [...host.querySelectorAll('canvas')]

    const draw = () => {
      const box = host.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(box.width)
      const h = Math.round(box.height)
      if (!w || !h) return

      const margin = Math.round(Math.min(w, h) * 0.052)
      const scale = Math.min(w, h) / 1080
      const stroke = 7 * scale
      const amp = 1.6 * scale
      const innerPad = Math.ceil(stroke * 0.5 + amp + 2)
      const inset = margin + innerPad
      // Innermost reach of the wobbly stroke. Content that stops here
      // touches the line and stays inside it.
      const inkInner = margin + Math.ceil(stroke * 0.5 + amp * 1.5)
      // Outermost painted reach of the stroke, measured from the frame edge.
      // The bottom of the cutout ends here so it runs under the line and stops.
      const inkOuter = Math.max(0, Math.ceil(margin - stroke * 0.5 - amp * 1.5))
      const strip = margin + Math.ceil(14 * scale)

      fill.style.background = paper
      fill.style.left = `${inset}px`
      fill.style.top = `${inset}px`
      fill.style.right = 'auto'
      fill.style.bottom = 'auto'
      fill.style.width = `${Math.max(0, w - inset * 2)}px`
      fill.style.height = `${Math.max(0, h - inset * 2)}px`
      host.parentElement?.style.setProperty('--ink-inset', `${inset}px`)
      host.parentElement?.style.setProperty('--ink-inner', `${inkInner}px`)
      host.parentElement?.style.setProperty('--ink-outer', `${inkOuter}px`)

      const pts = []
      const corners = [
        [margin, margin],
        [w - margin, margin],
        [w - margin, h - margin],
        [margin, h - margin],
      ]
      for (let i = 0; i < 4; i++) {
        const a = corners[i]
        const b = corners[(i + 1) % 4]
        const length = Math.hypot(b[0] - a[0], b[1] - a[1])
        pts.push(a)
        for (let d = 12; d < length - 6; d += 12) {
          const t = d / length
          pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        }
      }

      const rects = [
        [0, 0, w, strip],
        [0, h - strip, w, strip],
        [0, strip, strip, h - 2 * strip],
        [w - strip, strip, strip, h - 2 * strip],
      ]

      strips.forEach((canvas, i) => {
        const [x, y, sw, sh] = rects[i]
        if (sw <= 0 || sh <= 0) {
          canvas.width = 0
          canvas.height = 0
          return
        }
        canvas.width = Math.round(sw * dpr)
        canvas.height = Math.round(sh * dpr)
        canvas.style.left = `${x}px`
        canvas.style.top = `${y}px`
        canvas.style.width = `${sw}px`
        canvas.style.height = `${sh}px`
        const ctx = canvas.getContext('2d')
        ctx.setTransform(dpr, 0, 0, dpr, -x * dpr, -y * dpr)
        ctx.clearRect(x, y, sw, sh)
        inkBorder(ctx, pts, {
          width: stroke,
          color: '#1a1212',
          alpha: 0.95,
          seed: 830,
          amp,
        })
      })
      liftBottomStroke(host, strips[1])
    }

    draw()
    let timer = 0
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(draw, 60)
    })
    observer.observe(host)
    const photos = [...(host.parentElement?.querySelectorAll('.about-photo, .about-hem img') ?? [])]
    const redraw = () => draw()
    photos.forEach((img) => img.addEventListener('load', redraw))
    return () => {
      observer.disconnect()
      clearTimeout(timer)
      photos.forEach((img) => img.removeEventListener('load', redraw))
      host.parentElement?.querySelector(':scope > .panel-frame-lip')?.remove()
    }
  }, [paper])

  const frameStyle = { '--frame-width': width, '--frame-height': height }
  return (
    <>
      <div ref={fillRef} className="panel-frame panel-frame-mat" style={frameStyle} aria-hidden="true">
        <div className="panel-frame-fill" />
      </div>
      <div ref={ref} className="panel-frame panel-frame-ink" style={frameStyle} aria-hidden="true">
        <canvas />
        <canvas />
        <canvas />
        <canvas />
      </div>
    </>
  )
}
