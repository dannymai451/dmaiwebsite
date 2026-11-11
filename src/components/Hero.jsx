import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Frame from './Frame'
import ContactLinks from './ContactLinks'
import './Hero.css'

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase)

// CSS `ease` for the greeting fade, then cubic-bezier(0.2, 0.7, 0.2, 1) for the pop.
const FADE_EASE = CustomEase.create('hero-fade', '0.25,0.1,0.25,1')
const POP_EASE = CustomEase.create('hoptimist-pop', '0.2,0.7,0.2,1')

const HOPTIMISTS = [
  { src: '/hoptimist-1.webp', alt: 'Blue hoptimist' },
  { src: '/hoptimist-2.webp', alt: 'Yellow hoptimist' },
  { src: '/hoptimist-3.webp', alt: 'Red hoptimist' },
]

function syncFigureCrop(root, size) {
  const row = root.querySelector('.hero-hoptimists')
  const frame = root.querySelector('.panel-frame')
  if (!row || !frame) return
  const vv = window.visualViewport
  const layoutHeight = document.documentElement.clientHeight
  // bottom: 0 is the layout viewport. Safari's toolbar covers the bottom of it.
  const inset = vv && vv.scale <= 1.01 ? Math.max(0, layoutHeight - vv.height - vv.offsetTop) : 0
  row.style.setProperty('--browser-bottom', `${inset}px`)

  const portrait = window.matchMedia('(orientation: portrait)').matches
  if (!portrait) {
    row.style.removeProperty('--h')
    size.key = ''
    return
  }
  // A taller viewport is the toolbar collapsing. Width is a real resize.
  const key = String(window.innerWidth)
  if (size.key === key && row.style.getPropertyValue('--h')) return
  const measure = (tries = 0) => {
    const stage = frame.parentElement
    if (!stage) return
    const stageBox = stage.getBoundingClientRect()
    const frameBox = frame.getBoundingClientRect()
    const inkEdge = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--ink-edge'))
    const margin = Math.round(Math.min(Math.round(frameBox.width), Math.round(frameBox.height)) * 0.052)
    const widthReady = Math.abs(stageBox.width - window.innerWidth) <= 1
    // The frame republishes --ink-edge a beat after its box changes.
    if (!widthReady || inkEdge !== margin) {
      if (tries < 12) size.frame = requestAnimationFrame(() => measure(tries + 1))
      return
    }
    // The strip under the ink, inside the svh stage. Scroll moves both rects together.
    const gap = stageBox.bottom - frameBox.bottom + inkEdge
    if (!(gap > 0)) return
    const styles = getComputedStyle(row)
    const keep = Number(styles.getPropertyValue('--screen-keep'))
    const above = Number(styles.getPropertyValue('--desktop-above-frame'))
    const figure = Number(styles.getPropertyValue('--desktop-figure'))
    const join = Number(styles.getPropertyValue('--join'))
    const strip = keep - above / figure
    const cap = window.innerWidth / (3 - 4 * join)
    row.style.setProperty('--h', `${Math.min(gap / strip, cap)}px`)
    size.key = key
  }
  if (size.defer) {
    cancelAnimationFrame(size.frame)
    // The frame republishes its ink line on its own resize pass. Measure after that.
    size.frame = requestAnimationFrame(() => {
      size.frame = requestAnimationFrame(() => measure(0))
    })
    return
  }
  measure()
}

export default function Hero() {
  const heroRef = useRef(null)

  useLayoutEffect(() => {
    const root = heroRef.current
    if (!root) return
    const size = { key: '', frame: 0, defer: false }
    const sync = () => syncFigureCrop(root, size)
    sync()
    size.defer = true
    const frame = root.querySelector('.panel-frame')
    const observer = new ResizeObserver(sync)
    if (frame) observer.observe(frame)
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(size.frame)
      observer.disconnect()
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  useGSAP(
    () => {
      const q = gsap.utils.selector(heroRef)
      const figures = q('.hero-hoptimists img')

      // Tuck the figures back down over the first half of the hero's scroll.
      gsap.to(q('.hero-hoptimists'), {
        '--tuck': 1,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: '50% top', scrub: true },
      })

      gsap.matchMedia().add(
        { motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' },
        ({ conditions }) => {
          if (conditions.reduce) {
            gsap.set(figures, { '--pop': 1 })
            return
          }
          gsap
            .timeline()
            .from(q('.hero-intro'), { opacity: 0, duration: 1, ease: FADE_EASE })
            .to(figures, { '--pop': 1, duration: 0.8, ease: POP_EASE, stagger: 0.2 })
        },
      )
    },
    { scope: heroRef },
  )

  return (
    <section className="stage hero" ref={heroRef}>
      <div className="stage-box hero-box">
        <Frame width="90%" height="90%" />
        <div className="hero-intro">
          <h1 className="hero-greeting">Hey! I'm Danny</h1>
          <ContactLinks />
        </div>
      </div>
      <div className="hero-hoptimists">
        {HOPTIMISTS.map((figure) => (
          <img key={figure.src} src={figure.src} alt={figure.alt} />
        ))}
      </div>
    </section>
  )
}
