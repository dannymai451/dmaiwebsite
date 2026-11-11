// Type sketch for the About photo uncrumple. Not the implementation.
// Usage is the spec. The signatures below are derived from it.

/*
  About.jsx, inside the existing prefers-reduced-motion: no-preference gate:

    gsap.fromTo(revealRef.current, { opacity: 0 }, {
      opacity: 1,
      ease: 'sine.inOut',
      scrollTrigger: {
        trigger: aboutRef.current,
        start: 'top 96%',
        end: 'top 18%',
        scrub: true,
        onUpdate(self) {
          const pose = poseFromScroll(self.progress)
          paperRef.current?.set('progress', pose.crush)
          paintPose(slotRef.current, pose)
        },
      },
    })

  The photo slot keeps today's <img>. The canvas mounts only when that gate runs.

    <div className="about-photo-slot" ref={slotRef}>
      <img className="about-photo" src="/me.webp" alt="Danny holding a pastry" />
      {motion && <AboutPhoto handleRef={paperRef} />}
    </div>

  AboutPhoto does not take a progress prop. Scroll stays in About.jsx.
*/

/**
 * Linear ScrollTrigger progress for the About section.
 * 0 when the section top is at 96% of the viewport.
 * 1 when the section top is at 18%.
 * This is the trigger's progress, not the sine.inOut opacity.
 * @typedef {number} ScrollProgress
 */

/**
 * Paperlab crumple amount. 0 is the rest plane. 1 is crushed.
 * @typedef {number} CrushProgress
 */

/**
 * What the photo slot shows for one scroll position.
 * imageOpacity and canvasOpacity are the only visuals.
 * showCanvas is false only at full progress, so a hidden canvas
 * cannot leave a shadow or a second size on the finished photo.
 * @typedef {object} PhotoPose
 * @property {CrushProgress} crush
 * @property {number} imageOpacity 0..1
 * @property {number} canvasOpacity 0..1
 * @property {boolean} showCanvas
 */

/**
 * Pure map from scroll to pose. Scroll up is the same function run backwards.
 * Crush reaches 0 at HANDOFF. From there to 1 the real img fades in and the
 * canvas fades out. At 1 the canvas is not shown.
 *
 * Invariant: poseFromScroll(1) is { crush: 0, imageOpacity: 1, canvasOpacity: 0, showCanvas: false }.
 * Invariant: poseFromScroll(0) is { crush: 1, imageOpacity: 0, canvasOpacity: 1, showCanvas: true }.
 * Invariant: imageOpacity + canvasOpacity === 1 for every input.
 * Invariant: crush is 0 for every scrollProgress >= 0.92, and the img is
 * still fully hidden at exactly 0.92. The crossfade is the open interval after that.
 *
 * @param {ScrollProgress} scrollProgress
 * @returns {PhotoPose}
 */
export function poseFromScroll(scrollProgress) {
  throw new Error('not implemented')
}

/**
 * Write the pose onto the slot. Direct style writes. No React render per frame.
 * At showCanvas false, the canvas is visibility:hidden and the img is opacity 1,
 * which is today's photo with today's CSS.
 *
 * @param {HTMLElement} slot .about-photo-slot
 * @param {PhotoPose} pose
 * @returns {void}
 */
export function paintPose(slot, pose) {
  throw new Error('not implemented')
}

/**
 * The slot-sized sheet. Fills its parent. Owns the camera fit, the stock,
 * the die cut, and the ambient light. Does not read scroll.
 *
 * @param {{ handleRef: import('react').RefObject<PaperHandle | null> }} props
 * @returns {import('react').JSX.Element}
 */
export function AboutPhoto(_props) {
  throw new Error('not implemented')
}

/**
 * Paperlab ref, re-exported through src/lib/paper.js. Listed so the call
 * site above typechecks against the real handle. Not wrapped.
 *
 * set(param, value): 'progress' writes the crumple amount.
 * getProgress(): number
 *
 * @typedef {import('paperlab').PaperHandle} PaperHandle
 */
