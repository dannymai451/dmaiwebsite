// Throwaway spike for the About uncrumple design. Not the feature.
// Open /?spike=uncrumple. Delete this folder and the App.jsx gate after the checkpoint.
import { Component, useLayoutEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Paper, PaperMesh } from '../lib/paper'
import './UncrumpleSpike.css'

const PHOTO = '/me.webp'
// me.webp is 570×657. Match that aspect so contain does not letterbox inside the sheet.
const SHEET = { width: 570 / 657, height: 1 }

const image = {
  type: 'image',
  src: PHOTO,
  fit: 'contain',
  alt: '',
}

// photo-gloss has no default grain. dieCut drops the transparent ground so the
// cutout is a silhouette. progress 0 is Paperlab's flat; 1 is crushed.
function sheetProps(progress) {
  return {
    stock: 'photo-gloss',
    sheet: SHEET,
    content: image,
    surface: { dieCut: { margin: 0, color: '#ffffff' } },
    behavior: { type: 'crumple', progress, coarseness: 0.62, ball: 0.9, seed: 2 },
    autoplay: false,
    reducedMotion: true,
  }
}

// The flattest <Paper> the public props allow: key and room light off, fill maxed.
const flatLight = {
  lighting: 'studio',
  light: { key: 0, studio: 0, ambient: 2, exposure: 1, film: 'neutral' },
}

function FitSheet() {
  const { size, camera } = useThree()
  useLayoutEffect(() => {
    const zoom = Math.min(size.width / SHEET.width, size.height / SHEET.height) * 0.96
    camera.zoom = zoom
    camera.position.set(0, 0, 4)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function FittedFlatMesh() {
  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <FitSheet />
      <ambientLight intensity={Math.PI} />
      <PaperMesh {...sheetProps(0)} />
    </Canvas>
  )
}

class Boundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  render() {
    if (this.state.error) return <pre className="spike-error">{this.state.error}</pre>
    return this.props.children
  }
}

function Cell({ id, title, note, children }) {
  return (
    <figure className="spike-cell" id={id}>
      <figcaption>
        <strong>{title}</strong>
        <span>{note}</span>
      </figcaption>
      <div className="spike-stage">{children}</div>
    </figure>
  )
}

export default function UncrumpleSpike() {
  return (
    <main className="spike">
      <h1>Throwaway spike: can Paperlab sit flat?</h1>
      <p>
        Progress 0 is Paperlab&apos;s flat sheet. Progress 1 is crushed. This page is not the About
        section. The reference is the same <code>/me.webp</code> the section uses today.
      </p>
      <div className="spike-grid">
        <Cell id="spike-ref" title="Reference img" note="object-fit: contain">
          <img src={PHOTO} alt="Danny holding a pastry" />
        </Cell>
        <Cell id="spike-paper-flat" title="Paper progress 0" note="key 0, studio 0, ambient 2, die cut">
          <Boundary>
            <Paper {...sheetProps(0)} scene={flatLight} />
          </Boundary>
        </Cell>
        <Cell id="spike-paper-mid" title="Paper progress 0.42" note="studio light, still creased">
          <Boundary>
            <Paper {...sheetProps(0.42)} />
          </Boundary>
        </Cell>
        <Cell id="spike-paper-ball" title="Paper progress 1" note="ball 0.9, coarseness 0.62">
          <Boundary>
            <Paper {...sheetProps(1)} />
          </Boundary>
        </Cell>
        <Cell
          id="spike-mesh-flat"
          title="PaperMesh progress 0"
          note="orthographic, ambient only, no PaperLighting"
        >
          <Boundary>
            <FittedFlatMesh />
          </Boundary>
        </Cell>
      </div>
    </main>
  )
}
