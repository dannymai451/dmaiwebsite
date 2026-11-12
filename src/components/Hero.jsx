import { useRef } from 'react'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Frame from './Frame'
import ContactLinks from './ContactLinks'
import './Hero.css'

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase)

// CSS `ease` for the greeting fade.
const FADE_EASE = CustomEase.create('hero-fade', '0.25,0.1,0.25,1')

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
            .to(figures, { '--pop': 1, duration: 0.8, ease: 'back.out(1.4)', stagger: 0.36 })
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
