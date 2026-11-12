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

export default function Frame({ paper = '#fff', width = '100%', height = '100%', children }) {
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
      const inkOuter = Math.max(0, margin - Math.max(amp, 0.85))
      const strip = margin + Math.ceil(14 * scale)

      fill.style.background = paper
      fill.style.left = `${inset}px`
      fill.style.top = `${inset}px`
      fill.style.right = 'auto'
      fill.style.bottom = 'auto'
      fill.style.width = `${Math.max(0, w - inset * 2)}px`
      fill.style.height = `${Math.max(0, h - inset * 2)}px`
      host.parentElement?.style.setProperty('--ink-inset', `${inset}px`)
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
    }

    draw()
    let timer = 0
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(draw, 60)
    })
    observer.observe(host)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [paper])

  const frameStyle = { '--frame-width': width, '--frame-height': height }
  return (
    <>
      <div ref={fillRef} className="panel-frame panel-frame-mat" style={frameStyle} aria-hidden="true">
        <div className="panel-frame-fill" />
      </div>
      {children}
      <div ref={ref} className="panel-frame panel-frame-ink" style={frameStyle} aria-hidden="true">
        <canvas />
        <canvas />
        <canvas />
        <canvas />
      </div>
    </>
  )
}
