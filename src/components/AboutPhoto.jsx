import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { applyCreases } from '../lib/applyCreases'
import { containRect, crumpleState, scaleAbout } from '../lib/crumple'
import { paperTextures } from '../lib/paperSheets'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}

function prep(canvas, cssW, cssH, dpr) {
  const width = Math.max(1, Math.round(cssW * dpr))
  const height = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

function drawShell(ctx, rect, state, textures) {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  if (state.wad > 0.02) {
    const side = Math.max(rect.w, rect.h) * 1.85
    ctx.save()
    ctx.globalAlpha = Math.min(1, state.wad)
    ctx.drawImage(textures.wad, cx - side / 2, cy - side / 2, side, side)
    ctx.restore()
  }
  if (state.half > 0.02) {
    const side = Math.max(rect.w, rect.h) * 1.7
    ctx.save()
    ctx.globalAlpha = Math.min(1, state.half)
    ctx.drawImage(textures.half, cx - side / 2, cy - side * 0.46, side, side * 0.92)
    ctx.restore()
  }
}

function PhotoImg() {
  return (
    <img className="about-photo" src="/me.webp" alt="Danny holding a pastry" draggable="false" />
  )
}

function CrumplingPhoto({ ref }) {
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const progressRef = useRef(0)
  const buffers = useRef(null)
  const paintRef = useRef(() => {})

  const paint = (progress = progressRef.current) => {
    progressRef.current = progress
    const canvas = canvasRef.current
    const image = imgRef.current
    if (!canvas || !image) return
    const state = crumpleState(progress)
    image.classList.toggle('is-covered', !state.flat)
    canvas.classList.toggle('is-flat', state.flat)

    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    if (cssW < 2 || cssH < 2) return
    const dpr = window.devicePixelRatio || 1
    const ctx = prep(canvas, cssW, cssH, dpr)
    ctx.clearRect(0, 0, cssW, cssH)
    if (state.flat || !image.naturalWidth) return

    const fit = containRect(cssW, cssH, image.naturalWidth, image.naturalHeight, getComputedStyle(image).objectPosition)
    const scaled = scaleAbout(fit, state.scale)
    const textures = paperTextures()
    if (!buffers.current) {
      buffers.current = {
        photo: document.createElement('canvas'),
        stamp: document.createElement('canvas'),
      }
    }
    const photoCtx = prep(buffers.current.photo, cssW, cssH, dpr)
    photoCtx.clearRect(0, 0, cssW, cssH)
    photoCtx.drawImage(image, scaled.x, scaled.y, scaled.w, scaled.h)
    const stampCtx = prep(buffers.current.stamp, cssW, cssH, dpr)
    stampCtx.clearRect(0, 0, cssW, cssH)
    stampCtx.drawImage(buffers.current.photo, 0, 0, cssW, cssH)
    applyCreases(photoCtx, {
      shade: state.shade,
      shadow: textures.shadow,
      highlight: textures.highlight,
      stamp: buffers.current.stamp,
      rect: scaled,
      cssW,
      cssH,
    })

    const cx = scaled.x + scaled.w / 2
    const cy = scaled.y + scaled.h / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(state.rotation)
    ctx.translate(-cx, -cy)
    if (state.wad + state.half > 0.04) {
      ctx.save()
      ctx.globalAlpha = 0.22 * Math.min(1, state.wad * 0.9 + state.half * 0.45)
      ctx.fillStyle = '#241810'
      ctx.filter = 'blur(14px)'
      ctx.beginPath()
      ctx.ellipse(cx, scaled.y + scaled.h * 0.97, scaled.w * 0.42, Math.max(5, scaled.h * 0.045), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    drawShell(ctx, scaled, state, textures)
    ctx.drawImage(buffers.current.photo, 0, 0, cssW, cssH)
    ctx.restore()
  }

  useImperativeHandle(ref, () => ({
    setProgress(progress) {
      paintRef.current(progress)
    },
  }), [])

  // `paint` only reads refs, so this first closure stays valid on later scrolls.
  useLayoutEffect(() => {
    paintRef.current = paint
    const slot = rootRef.current
    if (!slot) return
    const observer = new ResizeObserver(() => paintRef.current())
    observer.observe(slot)
    const image = imgRef.current
    const onLoad = () => paintRef.current()
    image?.addEventListener('load', onLoad)
    return () => {
      observer.disconnect()
      image?.removeEventListener('load', onLoad)
    }
  }, [])

  return (
    <div className="about-photo-slot" ref={rootRef}>
      <img
        ref={imgRef}
        className="about-photo"
        src="/me.webp"
        alt="Danny holding a pastry"
        draggable="false"
      />
      <canvas ref={canvasRef} className="about-photo about-photo-paper" aria-hidden="true" />
    </div>
  )
}

export default function AboutPhoto({ ref }) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <div className="about-photo-slot">
        <PhotoImg />
      </div>
    )
  }
  return <CrumplingPhoto ref={ref} />
}
