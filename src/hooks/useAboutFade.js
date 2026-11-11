import { useEffect, useRef } from 'react'

// Fade the about frame in across the scroll from the hero.
const FADE_START = 0.96
const FADE_END = 0.18

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

export function useAboutFade() {
  const aboutRef = useRef(null)
  const revealRef = useRef(null)

  useEffect(() => {
    const about = aboutRef.current
    const reveal = revealRef.current
    if (!about || !reveal) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0

    const apply = () => {
      frame = 0
      if (reduce) {
        reveal.style.opacity = '1'
        return
      }
      const vh = window.innerHeight || 1
      const top = about.getBoundingClientRect().top
      const t = Math.min(1, Math.max(0, (FADE_START * vh - top) / ((FADE_START - FADE_END) * vh)))
      reveal.style.opacity = smoothstep(t).toFixed(3)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    frame = requestAnimationFrame(apply)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return { aboutRef, revealRef }
}
