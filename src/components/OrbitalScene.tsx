import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import './orbital.css'

/** A decorative scene. The static vector remains available when WebGL is absent. */
export function OrbitalScene({ compact = false }: { compact?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const element = host.current
    if (!element) return
    let disposed = false
    let cleanup: (() => void) | undefined
    let started = false
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting || started) return
      started = true
      void import('three').then(T => {
        if (disposed) return
        let renderer: InstanceType<typeof T.WebGLRenderer>
        try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }) }
        catch { return }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
        renderer.outputColorSpace = T.SRGBColorSpace
        renderer.setClearColor(0x080c12, 0)
        renderer.domElement.setAttribute('aria-hidden', 'true')
        element.appendChild(renderer.domElement)
        const scene = new T.Scene()
        const camera = new T.PerspectiveCamera(36, 1, 0.1, 50)
        camera.position.set(0, 0.4, 8)
        const group = new T.Group()
        scene.add(group)
        scene.add(new T.AmbientLight(0xc6f7ff, 1.4))
        const key = new T.DirectionalLight(0xa5ffff, 5)
        key.position.set(-3, 5, 4); scene.add(key)
        const rim = new T.DirectionalLight(0x0d5df3, 5)
        rim.position.set(4, -2, 0); scene.add(rim)
        const core = new T.Group()
        core.rotation.set(0.36, -0.56, 0.12)
        group.add(core)
        const box = new T.BoxGeometry(1.6, 0.43, 1.6)
        const material = new T.MeshPhysicalMaterial({ color: 0x183841, metalness: 0.65, roughness: 0.27, clearcoat: 1, emissive: 0x0c373c, emissiveIntensity: 0.3 })
        const edgeGeometry = new T.EdgesGeometry(box)
        const edgeMaterial = new T.LineBasicMaterial({ color: 0x7ce6e8, transparent: true, opacity: 0.8 })
        for (let i = 0; i < 3; i++) {
          const layer = new T.Mesh(box, material)
          layer.position.y = (i - 1) * 0.6
          layer.add(new T.LineSegments(edgeGeometry, edgeMaterial))
          core.add(layer)
        }
        const ringGeometry = new T.TorusGeometry(2.4, 0.009, 6, 120)
        const ringMaterial = new T.MeshBasicMaterial({ color: 0x40818e, transparent: true, opacity: 0.55 })
        const dotGeometry = new T.SphereGeometry(0.048, 10, 10)
        const dotMaterial = new T.MeshBasicMaterial({ color: 0xa2ffff })
        const rings = Array.from({ length: 3 }, (_, i) => {
          const ring = new T.Group()
          ring.rotation.set(0.7 + i * 0.65, i * 0.55, i * 0.7)
          ring.add(new T.Mesh(ringGeometry, ringMaterial))
          const dot = new T.Mesh(dotGeometry, dotMaterial)
          ring.add(dot); group.add(ring)
          return { ring, dot }
        })
        let visible = true
        let contextLost = false
        let frame = 0
        let elapsed = 0
        let last = 0
        const pointer = { x: 0, y: 0 }
        const render = (time = 0) => {
          frame = 0
          if (disposed || contextLost) return
          if (last) elapsed += Math.min((time - last) / 1000, 0.05)
          last = time
          const t = reduceMotion ? 0 : elapsed
          group.rotation.y = pointer.x * 0.16 + t * 0.04
          group.rotation.x = pointer.y * 0.08
          core.position.y = reduceMotion ? 0 : Math.sin(t * 0.55) * 0.08
          rings.forEach(({ dot }, i) => { const angle = t * (0.15 + i * 0.04) + i * 2; dot.position.set(Math.cos(angle) * 2.4, Math.sin(angle) * 2.4, 0) })
          renderer.render(scene, camera)
          if (!reduceMotion && visible && !document.hidden) frame = requestAnimationFrame(render)
        }
        const resume = () => { last = 0; if (!frame && visible && !document.hidden) render() }
        const resize = () => { const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); if (reduceMotion) render() }
        const ro = new ResizeObserver(resize); ro.observe(element)
        const visibility = new IntersectionObserver(entries => { visible = !!entries[0]?.isIntersecting; if (visible) resume(); else { cancelAnimationFrame(frame); frame = 0 } }); visibility.observe(element)
        const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0 } else resume() }
        const onPointer = (event: PointerEvent) => { if (reduceMotion) return; const rect = element.getBoundingClientRect(); pointer.x = (event.clientX - rect.left) / rect.width - 0.5; pointer.y = (event.clientY - rect.top) / rect.height - 0.5 }
        element.addEventListener('pointermove', onPointer)
        document.addEventListener('visibilitychange', onVisibility)
        const onLost = (event: Event) => { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0; setReady(false) }
        const onRestored = () => { contextLost = false; resize(); resume(); setReady(true) }
        renderer.domElement.addEventListener('webglcontextlost', onLost)
        renderer.domElement.addEventListener('webglcontextrestored', onRestored)
        resize(); render(); setReady(true)
        cleanup = () => {
          cancelAnimationFrame(frame); ro.disconnect(); visibility.disconnect()
          document.removeEventListener('visibilitychange', onVisibility)
          element.removeEventListener('pointermove', onPointer)
          renderer.domElement.removeEventListener('webglcontextlost', onLost)
          renderer.domElement.removeEventListener('webglcontextrestored', onRestored)
          ;[box, edgeGeometry, ringGeometry, dotGeometry].forEach(g => g.dispose())
          ;[material, edgeMaterial, ringMaterial, dotMaterial].forEach(m => m.dispose())
          renderer.dispose(); renderer.domElement.remove()
        }
      }).catch(() => { /* Keep the vector poster if the optional scene cannot load. */ })
    }, { rootMargin: '100px' })
    observer.observe(element)
    return () => { disposed = true; observer.disconnect(); cleanup?.() }
  }, [reduceMotion])

  return <div ref={host} className={`orbital-scene${compact ? ' compact' : ''}${ready ? ' is-ready' : ''}`} aria-hidden="true">
    <svg className="orbital-poster" viewBox="0 0 540 400" fill="none"><g stroke="#366777"><ellipse cx="270" cy="208" rx="222" ry="103" /><ellipse cx="270" cy="208" rx="222" ry="103" transform="rotate(42 270 208)" /><ellipse cx="270" cy="208" rx="222" ry="103" transform="rotate(-42 270 208)" /></g><g stroke="#69e7eb" fill="#15313a">{[0, 1, 2].map(i => <path key={i} d={`M270 ${100 + i * 55}l90 48v30l-90 48-90-48v-30z M180 ${148 + i * 55}l90 48 90-48 M270 ${196 + i * 55}v30`} />)}</g></svg>
  </div>
}
