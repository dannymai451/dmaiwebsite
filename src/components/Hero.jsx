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

const SPRING_ARRIVE = 0.32
const SPRING_OMEGA = 19.5
const SPRING_ZETA = 0.15
const SPRING_STEPS = 2000
const SPRING_SAMPLES = new Float64Array(SPRING_STEPS + 1)

function fillSpring() {
  let position = 0
  let velocity = 0
  const dt = 1 / SPRING_STEPS
  const omega2 = SPRING_OMEGA * SPRING_OMEGA
  const damp = 2 * SPRING_ZETA * SPRING_OMEGA
  for (let i = 1; i <= SPRING_STEPS; i += 1) {
    const u = Math.min(1, (i - 1) / SPRING_STEPS / SPRING_ARRIVE)
    const target = 1 - Math.pow(1 - u, 2)
    const acc = omega2 * (target - position) - damp * velocity
    velocity += acc * dt
    position += velocity * dt
    SPRING_SAMPLES[i] = position
  }
  SPRING_SAMPLES[SPRING_STEPS] = 1
}

fillSpring()

function popEase(progress) {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  const scaled = progress * SPRING_STEPS
  const index = Math.floor(scaled)
  const frac = scaled - index
  return SPRING_SAMPLES[index] + (SPRING_SAMPLES[index + 1] - SPRING_SAMPLES[index]) * frac
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
            .to(figures, { '--pop': 1, duration: 1.45, ease: popEase, stagger: 0.36 })
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
