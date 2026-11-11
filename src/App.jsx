import './components/stage.css'
import Hero from './components/Hero'
import About from './components/About'
import Experience from './components/Experience'
import Projects from './components/Projects'
import Footer from './components/Footer'
import UncrumpleSpike from './spike/UncrumpleSpike'

function App() {
  // Throwaway design spike. Not part of the page. See src/spike/UncrumpleSpike.jsx.
  if (new URLSearchParams(window.location.search).get('spike') === 'uncrumple') {
    return <UncrumpleSpike />
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
