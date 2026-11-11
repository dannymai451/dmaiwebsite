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

// The line is nowrap and sized for Caveat. The fallback is wider than the card,
// and the stage clips whatever crosses it. Shrink only in that case.
function fitGreeting(heading, card) {
  heading.style.fontSize = ''
  const cardBox = card.getBoundingClientRect()
  if (cardBox.width < 40) return
  const text = heading.getBoundingClientRect()
  const pad = 2
  const leftOver = Math.max(cardBox.left + pad - text.left, 0)
  const rightOver = Math.max(text.right - (cardBox.right - pad), 0)
  if (leftOver + rightOver <= 0) return
  const size = parseFloat(getComputedStyle(heading).fontSize)
  const next = (size * (text.width - leftOver - rightOver)) / text.width
  if (!(next > 0)) return
  heading.style.fontSize = `${next}px`
}

const HOPTIMISTS = [
  { src: '/hoptimist-1.webp', alt: 'Blue hoptimist' },
  { src: '/hoptimist-2.webp', alt: 'Yellow hoptimist' },
  { src: '/hoptimist-3.webp', alt: 'Red hoptimist' },
]

export default function Hero() {
  const heroRef = useRef(null)

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

  useLayoutEffect(() => {
    const root = heroRef.current
    const heading = root?.querySelector('.hero-greeting')
    const card = root?.querySelector('.panel-frame-fill')
    if (!heading || !card) return undefined
    let alive = true
    const fit = () => {
      if (alive) fitGreeting(heading, card)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(card)
    document.fonts.addEventListener('loadingdone', fit)
    document.fonts.ready.then(fit)
    return () => {
      alive = false
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', fit)
      heading.style.fontSize = ''
    }
  }, [])

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
