import { useEffect, useRef } from 'react'
import './Hero.css'

const HOPTIMISTS = [
  ['/hoptimist-1.webp', 'Blue hoptimist'],
  ['/hoptimist-2.webp', 'Yellow hoptimist'],
  ['/hoptimist-3.webp', 'Red hoptimist'],
]

const POP_MS = 900

function easeOutBack(u) {
  const c1 = 1.6
  const c3 = c1 + 1
  return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2
}

export default function Hero() {
  const heroRef = useRef(null)
  const rowRef = useRef(null)

  useEffect(() => {
    const hero = heroRef.current
    const row = rowRef.current
    if (!hero || !row) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const greeting = hero.querySelector('.hero-greeting')
    let frame = 0
    let revealed = reduce
    let popStart = reduce ? performance.now() : 0

    const apply = (now) => {
      frame = 0
      const elapsed = revealed ? now - popStart : -1
      const pop = !revealed
        ? 0
        : reduce || elapsed >= POP_MS
          ? 1
          : easeOutBack(Math.max(0, elapsed / POP_MS))
      const rect = hero.getBoundingClientRect()
      const tuck = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)))
      const shift = 100 - 70 * pop * (1 - tuck)
      row.style.setProperty('--shift', `${shift}%`)
      if (revealed && !reduce && elapsed < POP_MS) frame = requestAnimationFrame(apply)
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
    if (reduce) reveal()
    else frame = requestAnimationFrame(apply)

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
        <p className="hero-greeting">Hey! I'm Danny</p>
      </div>
      <div className="hero-hoptimists" ref={rowRef}>
        {HOPTIMISTS.map(([src, alt]) => (
          <img key={src} src={src} alt={alt} />
        ))}
      </div>
    </section>
  )
}
