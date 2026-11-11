import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Frame from './Frame'
import './About.css'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export default function About() {
  const aboutRef = useRef(null)
  const revealRef = useRef(null)

  // Fade the about frame in across the scroll from the hero. Reduced motion
  // skips the tween and About.css shows the frame at full opacity.
  useGSAP(() => {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        revealRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          ease: 'sine.inOut',
          scrollTrigger: { trigger: aboutRef.current, start: 'top 96%', end: 'top 18%', scrub: true },
        },
      )
    })
  })

  return (
    <section className="about" ref={aboutRef} aria-labelledby="about-title">
      <div className="about-box">
        <div className="about-reveal" ref={revealRef}>
          <Frame width="100%" height="100%" />
          <div className="about-layout">
            <div className="about-copy">
              <h2 className="about-title" id="about-title">
                <svg className="about-mark" viewBox="0 0 400 72" preserveAspectRatio="none" aria-hidden="true">
                  <path
                    d="M10 44C68 28 132 60 198 40 268 20 328 58 392 36"
                    fill="none"
                    stroke="#f0cc3d"
                    strokeWidth="28"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 36C84 52 148 24 216 48 286 68 340 28 386 50"
                    fill="none"
                    stroke="#ffe98a"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                </svg>
                <span>ABOUT ME</span>
              </h2>
              <p>
                I'm a software engineer interested in ai,
                automating tedious work, and solving tough problems. I enjoy bringing ideas to
                life, making people's days a little easier, and learning with other curious minds.
              </p>
            </div>
            <div className="about-photo-slot">
              <img
                className="about-photo"
                src="/me.webp"
                alt="Danny holding a pastry"
                draggable="false"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
