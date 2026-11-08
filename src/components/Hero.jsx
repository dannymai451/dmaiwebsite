import { useEffect, useRef } from 'react'
import Frame from './library/Frame'
import './Hero.css'

const HOPTIMISTS = [
  ['/hoptimist-1.webp', 'Blue hoptimist'],
  ['/hoptimist-2.webp', 'Yellow hoptimist'],
  ['/hoptimist-3.webp', 'Red hoptimist'],
]

const POP_MS = 800
const POP_DELAYS_MS = [0, 200, 400]
const POP_EXTENT = 70

// Same curve as the about-section cutout rise: cubic-bezier(.2, .7, .2, 1)
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

export default function Hero() {
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
      const TUCK_SCROLL = 0.5 // tuck over half a hero height
      const tuck = Math.min(1, Math.max(0, -rect.top / ((rect.height || 1) * TUCK_SCROLL)))
      const imgs = row.querySelectorAll('img')
      imgs.forEach((img, i) => {
        const delay = POP_DELAYS_MS[i] ?? POP_DELAYS_MS.at(-1) ?? 0
        const pop = popAmount(elapsed, delay)
        const shift = 100 - POP_EXTENT * pop * (1 - tuck)
        img.style.setProperty('--shift', `${shift}%`)
      })
      const popEnd =
        Math.max(...POP_DELAYS_MS, 0) + POP_MS
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
    if (!reduce) frame = requestAnimationFrame(apply)

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

  return (
    <section className="hero" ref={heroRef}>
      <div className="hero-box">
        <Frame width="100%" height="100%" />
        <div className="hero-intro">
          <p className="hero-greeting">Hey! I'm Danny</p>
          <nav className="hero-links" aria-label="Contact">
            <a href="https://github.com/dannymai451" target="_blank" rel="noreferrer" aria-label="GitHub">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.9c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.9 10.9 0 0 1 5.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
                />
              </svg>
            </a>
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 0 1-2.06-2.06c0-1.14.92-2.07 2.06-2.07 1.14 0 2.07.93 2.07 2.07 0 1.13-.93 2.06-2.07 2.06zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.23 0z"
                />
              </svg>
            </a>
            <a href="mailto:dannymai451@gmail.com" aria-label="Email">
              <svg viewBox="2 4 20 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
                />
              </svg>
            </a>
          </nav>
        </div>
      </div>
      <div className="hero-hoptimists" ref={rowRef}>
        {HOPTIMISTS.map(([src, alt]) => (
          <img key={src} src={src} alt={alt} />
        ))}
      </div>
    </section>
  )
}
