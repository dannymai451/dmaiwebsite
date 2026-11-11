import Frame from './Frame'
import ContactLinks from './ContactLinks'
import { useHoptimistPop } from '../hooks/useHoptimistPop'
import './Hero.css'

const HOPTIMISTS = [
  { src: '/hoptimist-1.webp', alt: 'Blue hoptimist' },
  { src: '/hoptimist-2.webp', alt: 'Yellow hoptimist' },
  { src: '/hoptimist-3.webp', alt: 'Red hoptimist' },
]

export default function Hero() {
  const { heroRef, rowRef } = useHoptimistPop()

  return (
    <section className="stage hero" ref={heroRef}>
      <div className="stage-box hero-box">
        <Frame width="90%" height="90%" />
        <div className="hero-intro">
          <h1 className="hero-greeting">Hey! I'm Danny</h1>
          <ContactLinks />
        </div>
      </div>
      <div className="hero-hoptimists" ref={rowRef}>
        {HOPTIMISTS.map((figure) => (
          <img key={figure.src} src={figure.src} alt={figure.alt} />
        ))}
      </div>
    </section>
  )
}
