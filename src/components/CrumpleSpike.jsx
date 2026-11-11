import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { NoToneMapping, SRGBColorSpace, TextureLoader } from 'three'
import { createCrumpleMaterial } from '../lib/crumpleMaterial'

const STOPS = [0, 0.25, 0.5, 0.75, 1]

function readQuery() {
  const params = new URLSearchParams(window.location.search)
  const sheet = params.get('sheet') === '1'
  const raw = params.get('progress')
  const parsed = raw == null ? 0 : Number(raw)
  const progress = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0
  return { sheet, progress }
}

function Sheet({ progress, size }) {
  const texture = useLoader(TextureLoader, '/me.webp')
  const material = useMemo(() => {
    const created = createCrumpleMaterial(texture)
    created.uniforms.uProgress.value = progress
    created.uniforms.uPlane.value.set(size.w, size.h)
    const flat = progress >= 1
    created.depthTest = !flat
    created.depthWrite = !flat
    return created
  }, [texture, progress, size.w, size.h])

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh material={material}>
      <planeGeometry args={[size.w, size.h, 70, 80]} />
    </mesh>
  )
}

function PhotoCanvas({ progress, size }) {
  return (
    <Canvas
      orthographic
      dpr={1}
      camera={{ position: [0, 0, 2000], near: 1, far: 4000 }}
      gl={{
        antialias: false,
        alpha: true,
        premultipliedAlpha: false,
        stencil: false,
        powerPreference: 'default',
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace
        gl.toneMapping = NoToneMapping
        gl.setClearColor(0x000000, 0)
      }}
    >
      <Suspense fallback={null}>
        <Sheet progress={progress} size={size} />
      </Suspense>
    </Canvas>
  )
}

function Cell({ label, progress, size, kind }) {
  return (
    <figure className="spike-cell" data-kind={kind} data-progress={progress ?? undefined}>
      <div className="spike-slot" style={{ width: size.w, height: size.h }}>
        {kind === 'img' ? (
          <img src="/me.webp" alt="Danny holding a pastry" draggable="false" />
        ) : (
          <PhotoCanvas progress={progress} size={size} />
        )}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export default function CrumpleSpike() {
  const query = useMemo(() => readQuery(), [])
  const [progress, setProgress] = useState(query.progress)
  const [size, setSize] = useState(null)
  const stops = query.sheet ? STOPS : [progress]

  function onProgress(value) {
    setProgress(value)
    const url = new URL(window.location.href)
    url.searchParams.set('spike', 'crumple')
    url.searchParams.set('progress', String(value))
    window.history.replaceState(null, '', url)
  }

  return (
    <main className="spike">
      <style>{`
        .spike { margin: 0; padding: 16px; background: #fff; color: #1a1a1a; font: 14px/1.4 "Segoe UI", sans-serif; }
        .spike-controls { display: flex; gap: 12px; align-items: center; margin: 0 0 12px; }
        .spike-controls input { width: 240px; }
        .spike-row { display: flex; gap: 12px; align-items: flex-start; width: max-content; }
        .spike-cell { margin: 0; }
        .spike-slot { background: #fff; }
        .spike-slot img { display: block; width: 100%; height: 100%; background: #fff; }
        .spike-cell figcaption { margin-top: 6px; }
        .spike-probe { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
      `}</style>
      <img
        className="spike-probe"
        src="/me.webp"
        alt=""
        onLoad={(event) => {
          const img = event.currentTarget
          setSize({ w: img.naturalWidth, h: img.naturalHeight })
        }}
      />
      {query.sheet ? null : (
        <label className="spike-controls">
          progress {progress.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={progress}
            aria-label="Crumple progress"
            onChange={(event) => onProgress(Number(event.target.value))}
          />
        </label>
      )}
      {size ? (
        <div className="spike-row" id="spike-row">
          <Cell label="img" size={size} kind="img" />
          {stops.map((stop) => (
            <Cell
              key={query.sheet ? stop : 'live'}
              label={query.sheet ? String(stop) : progress.toFixed(2)}
              progress={stop}
              size={size}
              kind="shader"
            />
          ))}
        </div>
      ) : null}
    </main>
  )
}
