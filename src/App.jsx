import './components/stage.css'
import Hero from './components/Hero'
import About from './components/About'
import Experience from './components/Experience'
import Projects from './components/Projects'
import Footer from './components/Footer'

function App() {
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
