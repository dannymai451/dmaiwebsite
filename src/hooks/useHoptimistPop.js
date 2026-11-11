import { useEffect, useRef } from 'react'

const POP_MS = 800
const POP_DELAYS_MS = [0, 200, 400]
const POP_EXTENT = 70
const TUCK_SCROLL = 0.5

// cubic-bezier(0.2, 0.7, 0.2, 1). Sampled in JS because each figure's
// --shift is written every frame, first for the pop, then for the scroll tuck.
function easePop(x) {
  const x1 = 0.2
  const y1 = 0.7
  const x2 = 0.2
  const y2 = 1
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t) => ((ay * t + by) * t + cy) * t
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx
  if (x <= 0) return 0
  if (x >= 1) return 1
  let t = x
  for (let i = 0; i < 6; i++) {
    const slope = sampleDX(t)
    if (Math.abs(slope) < 1e-6) break
    const next = t - (sampleX(t) - x) / slope
    if (Math.abs(next - t) < 1e-5) {
      t = next
      break
    }
    t = next
  }
  return sampleY(Math.min(1, Math.max(0, t)))
}

export function useHoptimistPop() {
  const heroRef = useRef(null)
  const rowRef = useRef(null)

  useEffect(() => {
    const hero = heroRef.current
    const row = rowRef.current
    if (!hero || !row) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const greeting = hero.querySelector('.hero-intro')
    let frame = 0
    let revealed = reduce
    let popStart = 0

    const popAmount = (elapsed, delay) => {
      if (!revealed) return 0
      if (reduce) return 1
      const t = elapsed - delay
      if (t < 0) return 0
      if (t >= POP_MS) return 1
      return easePop(t / POP_MS)
    }

    const apply = (now) => {
      frame = 0
      const elapsed = revealed ? now - popStart : 0
      const rect = hero.getBoundingClientRect()
      const tuck = Math.min(1, Math.max(0, -rect.top / ((rect.height || 1) * TUCK_SCROLL)))
      const imgs = row.querySelectorAll('img')
      imgs.forEach((img, i) => {
        const delay = POP_DELAYS_MS[i] ?? POP_DELAYS_MS.at(-1) ?? 0
        const pop = popAmount(elapsed, delay)
        const shift = 100 - POP_EXTENT * pop * (1 - tuck)
        img.style.setProperty('--shift', `${shift}%`)
      })
      const popEnd = Math.max(...POP_DELAYS_MS, 0) + POP_MS
      if (revealed && !reduce && elapsed < popEnd) {
        frame = requestAnimationFrame(apply)
      }
    }

    const reveal = () => {
      if (revealed) return
      revealed = true
      popStart = performance.now()
      if (!frame) frame = requestAnimationFrame(apply)
    }

    const onNameEnd = (event) => {
      if (event.animationName === 'hero-fade-in') reveal()
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }

    greeting?.addEventListener('animationend', onNameEnd)
    const fallback = window.setTimeout(reveal, 2100)
    frame = requestAnimationFrame(apply)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(fallback)
      greeting?.removeEventListener('animationend', onNameEnd)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return { heroRef, rowRef }
}
