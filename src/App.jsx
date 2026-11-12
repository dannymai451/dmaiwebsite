import './components/stage.css'
import Hero from './components/Hero'
import About from './components/About'
import Work from './components/Work'
import Footer from './components/Footer'

function App() {
  return (
    <>
      <div className="page">
        <Hero />
        <About />
        <Work />
      </div>
      <Footer />
    </>
  )
}

export default App
