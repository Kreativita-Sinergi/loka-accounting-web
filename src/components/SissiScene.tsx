import { useEffect, useRef, useState } from 'react'
import { useReducedMotion, type MotionValue } from 'motion/react'

/** A quiet orange sculpture behind the portrait, with a CSS fallback. */
export function SissiScene({ velocity }: { velocity: MotionValue<number> }) {
  const host = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const element = host.current
    if (!element) return
    let disposed = false
    let cleanup: (() => void) | undefined
    void import('three').then(T => {
      if (disposed) return
      let renderer: InstanceType<typeof T.WebGLRenderer>
      try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }) }
      catch { return }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.outputColorSpace = T.SRGBColorSpace
      renderer.setClearColor(0xfbfaf8, 0)
      renderer.domElement.setAttribute('aria-hidden', 'true')
      element.appendChild(renderer.domElement)
      const scene = new T.Scene()
      const camera = new T.PerspectiveCamera(35, 1, 0.1, 20)
      camera.position.z = 7.5
      scene.add(new T.HemisphereLight(0xffffff, 0xfcd9bd, 2.5))
      const light = new T.DirectionalLight(0xffffff, 3)
      light.position.set(-3, 4, 5)
      scene.add(light)
      const group = new T.Group()
      scene.add(group)
      const geometry = new T.TorusGeometry(1.7, 0.085, 10, 64, Math.PI * 1.6)
      const orange = new T.MeshStandardMaterial({ color: 0xf1702c, roughness: 0.7 })
      const peach = new T.MeshStandardMaterial({ color: 0x5b6064, roughness: 0.8 })
      const upper = new T.Mesh(geometry, orange)
      upper.position.set(0.2, 0.4, -0.3)
      upper.rotation.set(0.28, -0.28, -0.6)
      const lower = new T.Mesh(geometry, peach)
      lower.position.set(-0.4, -0.6, 0)
      lower.scale.setScalar(0.82)
      lower.rotation.set(-0.2, 0.3, 2.4)
      group.add(upper, lower)
      let frame = 0
      let visible = false
      let contextLost = false
      let elapsed = 0
      let lastTime = 0
      let lastPaint = 0
      const pointer = { x: 0, y: 0 }
      const render = (time = 0) => {
        frame = 0
        if (disposed || contextLost) return
        if (time && time - lastPaint < 1000 / 30) {
          if (!reduced && visible && !document.hidden) frame = requestAnimationFrame(render)
          return
        }
        lastPaint = time
        if (lastTime) elapsed += Math.min((time - lastTime) / 1000, 0.05)
        lastTime = time
        group.rotation.y += ((reduced ? 0 : pointer.x * 0.2 + velocity.get() * 0.12) - group.rotation.y) * 0.06
        group.rotation.x += ((reduced ? 0 : pointer.y * 0.09) - group.rotation.x) * 0.06
        group.rotation.z = reduced ? 0 : velocity.get() * 0.045
        group.position.y = reduced ? 0 : Math.sin(elapsed * 0.5) * 0.045
        renderer.render(scene, camera)
        if (!reduced && visible && !document.hidden) frame = requestAnimationFrame(render)
      }
      const stop = () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0 }
      const resume = () => { if (!frame && visible && !document.hidden) render() }
      const resize = () => {
        const { width, height } = element.getBoundingClientRect()
        if (!width || !height || contextLost) return
        renderer.setSize(width, height)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        if (!frame) render()
      }
      const size = new ResizeObserver(resize)
      size.observe(element)
      const viewport = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting
        if (visible) resume(); else stop()
      })
      viewport.observe(element)
      const onVisibility = () => { if (document.hidden) stop(); else resume() }
      const onPointer = (event: PointerEvent) => {
        if (reduced || event.pointerType === 'touch') return
        const rect = element.getBoundingClientRect()
        pointer.x = (event.clientX - rect.left) / rect.width - 0.5
        pointer.y = (event.clientY - rect.top) / rect.height - 0.5
      }
      const onLeave = () => { pointer.x = 0; pointer.y = 0 }
      const onLost = (event: Event) => { event.preventDefault(); contextLost = true; stop(); setReady(false) }
      const onRestored = () => { contextLost = false; resize(); resume(); setReady(true) }
      // Observe the figure so the portrait does not block pointer interaction.
      const figure = element.parentElement!
      figure.addEventListener('pointermove', onPointer)
      figure.addEventListener('pointerleave', onLeave)
      document.addEventListener('visibilitychange', onVisibility)
      renderer.domElement.addEventListener('webglcontextlost', onLost)
      renderer.domElement.addEventListener('webglcontextrestored', onRestored)
      resize()
      setReady(true)
      cleanup = () => {
        stop(); size.disconnect(); viewport.disconnect()
        figure.removeEventListener('pointermove', onPointer)
        figure.removeEventListener('pointerleave', onLeave)
        document.removeEventListener('visibilitychange', onVisibility)
        renderer.domElement.removeEventListener('webglcontextlost', onLost)
        renderer.domElement.removeEventListener('webglcontextrestored', onRestored)
        geometry.dispose(); orange.dispose(); peach.dispose()
        renderer.dispose(); renderer.domElement.remove()
      }
    }).catch(() => { /* The peach backdrop remains if WebGL cannot load. */ })
    return () => { disposed = true; cleanup?.() }
  }, [reduced, velocity])

  return <div ref={host} className={`sissi-scene${ready ? ' is-ready' : ''}`} aria-hidden="true" />
}
