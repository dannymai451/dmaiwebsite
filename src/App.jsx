import { lazy, Suspense } from 'react'
import './components/stage.css'
import Hero from './components/Hero'
import About from './components/About'
import Experience from './components/Experience'
import Projects from './components/Projects'
import Footer from './components/Footer'

const CrumpleSpike = lazy(() => import('./components/CrumpleSpike.jsx'))

function App() {
  if (new URLSearchParams(window.location.search).get('spike') === 'crumple') {
    return (
      <Suspense fallback={null}>
        <CrumpleSpike />
      </Suspense>
    )
  }

  return (
    <>
      <div className="page">
        <Hero />
        <About />
        <Experience />
        <Projects />
      </div>
      <Footer />
    </>
  )
}

export default App
