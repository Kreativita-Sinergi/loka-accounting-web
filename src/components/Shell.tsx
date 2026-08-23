import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { IdentityProfile } from '../api/auth'
import { modules, moduleOf, type MenuModule, type MenuTile, type PageKey } from '../lib/menu'
import type { Tab } from '../store/tabs'
import { Icon } from './Icon'
import { cx } from './ui'
import { ConfirmDialog } from './Modal'
import { MenuSearch, rememberMenu } from './MenuSearch'

/**
 * Shell aplikasi mengikuti Bagian 03 spesifikasi: top bar 56px, tab bar 40px,
 * icon rail 64px dengan menu flyout berisi ubin berwarna per kelompok fungsi.
 */

/**
 * Membuat strip tab hidup: tab dapat digeser untuk diurutkan ulang, area
 * kosong strip dapat ditarik seperti peta, roda mouse menggeser mendatar,
 * tombol panah muncul saat tab meluber, dan tab aktif selalu terlihat.
 */
function useTabStrip(active: PageKey, count: number, onReorder?: (from: number, to: number) => void) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const [moving, setMoving] = useState<number | null>(null)
  // Dipakai agar klik yang mengakhiri sebuah geseran tidak ikut memindah tab.
  const drag = useRef<{ startX: number; startScroll: number; index: number | null; moved: boolean } | null>(null)

  const measure = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const max = strip.scrollWidth - strip.clientWidth
    setEdges({ left: strip.scrollLeft > 1, right: strip.scrollLeft < max - 1 })
  }, [])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [measure, count])

  // Roda mouse vertikal digeser menjadi gulir mendatar pada strip tab.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!delta) return
      const max = strip.scrollWidth - strip.clientWidth
      if (max <= 0) return
      event.preventDefault()
      strip.scrollLeft = Math.max(0, Math.min(max, strip.scrollLeft + delta))
    }
    strip.addEventListener('wheel', onWheel, { passive: false })
    return () => strip.removeEventListener('wheel', onWheel)
  }, [])

  // Tab aktif digulir ke dalam pandangan ketika berpindah atau baru dibuka.
  useEffect(() => {
    if (drag.current) return
    const target = stripRef.current?.querySelector('[data-tab-active="true"]')
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [active, count])

  const nudge = useCallback((direction: -1 | 1) => {
    const strip = stripRef.current
    if (!strip) return
    strip.scrollBy({ left: direction * Math.max(160, strip.clientWidth * 0.7), behavior: 'smooth' })
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const strip = stripRef.current
    if (!strip || event.button !== 0) return
    // Tombol tutup tetap berperilaku sebagai tombol, bukan pegangan geser.
    if ((event.target as HTMLElement).closest('.doc-tab-close')) return
    const tab = (event.target as HTMLElement).closest<HTMLElement>('.doc-tab')
    const index = tab ? Number(tab.dataset.index) : null
    // Menarik area kosong hanya berguna bila memang ada yang bisa digulir.
    if (index === null && strip.scrollWidth <= strip.clientWidth) return
    drag.current = { startX: event.clientX, startScroll: strip.scrollLeft, index, moved: false }
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const strip = stripRef.current
    const state = drag.current
    if (!strip || !state) return
    const shift = event.clientX - state.startX
    if (!state.moved && Math.abs(shift) < 4) return
    if (!state.moved) {
      state.moved = true
      strip.setPointerCapture(event.pointerId)
      strip.classList.add(state.index === null ? 'is-panning' : 'is-sorting')
      if (state.index !== null) setMoving(state.index)
    }

    if (state.index === null) {
      strip.scrollLeft = state.startScroll - shift
      return
    }

    // Mengurut ulang: tab pindah begitu kursor melewati titik tengah tetangga.
    const boxes = [...strip.querySelectorAll<HTMLElement>('.doc-tab')].map((node) => node.getBoundingClientRect())
    let target = state.index
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i]
      if (event.clientX >= box.left && event.clientX <= box.right) { target = i; break }
      if (i === 0 && event.clientX < box.left) target = 0
      if (i === boxes.length - 1 && event.clientX > box.right) target = i
    }
    if (target !== state.index) {
      onReorder?.(state.index, target)
      state.index = target
      setMoving(target)
    }
    // Menggeser tab ke tepi strip ikut menggulirnya.
    const frame = strip.getBoundingClientRect()
    if (event.clientX < frame.left + 40) strip.scrollLeft -= 14
    else if (event.clientX > frame.right - 40) strip.scrollLeft += 14
  }, [onReorder])

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const strip = stripRef.current
    const state = drag.current
    drag.current = null
    setMoving(null)
    if (!strip || !state) return
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId)
    strip.classList.remove('is-panning', 'is-sorting')
    // Klik penutup geseran dibatalkan supaya tidak salah pindah tab.
    if (state.moved) {
      const swallow = (click: MouseEvent) => { click.preventDefault(); click.stopPropagation() }
      strip.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => strip.removeEventListener('click', swallow, { capture: true } as EventListenerOptions), 0)
    }
  }, [])

  return { stripRef, edges, moving, measure, nudge, dragHandlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag } }
}

export function Shell({
  tabs,
  active,
  onOpen,
  onClose,
  onActivate,
  onReorder,
  profile,
  onLogout,
  children,
}: {
  tabs: Tab[]
  active: PageKey
  onOpen: (key: PageKey) => void
  onClose: (key: PageKey) => void
  onActivate: (key: PageKey) => void
  onReorder?: (from: number, to: number) => void
  profile: IdentityProfile
  onLogout: () => void
  children: ReactNode
}) {
  // Flyout dirender lewat portal: icon rail dapat menggulir, dan panel yang
  // melayang di luar kotaknya tidak boleh ikut terpotong.
  const [flyout, setFlyout] = useState<{ module: MenuModule; top: number; left: number } | null>(null)
  const [closing, setClosing] = useState<Tab | null>(null)
  const [overflow, setOverflow] = useState(false)
  const [palette, setPalette] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const activeModule = moduleOf(active)
  const { stripRef, edges, moving, measure, nudge, dragHandlers } = useTabStrip(active, tabs.length, onReorder)

  // Ctrl+K / Cmd+K membuka pencarian menu dari mana pun di dalam aplikasi.
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  useEffect(() => {
    if (!flyout) return
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node
      if (railRef.current?.contains(target) || flyoutRef.current?.contains(target)) return
      setFlyout(null)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFlyout(null) }
    const reposition = () => setFlyout(null)
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('mousedown', dismiss)
      window.removeEventListener('keydown', escape)
      window.removeEventListener('resize', reposition)
    }
  }, [flyout])

  function openTile(tile: MenuTile) {
    rememberMenu(tile.key)
    onOpen(tile.key)
    setFlyout(null)
  }

  /** Membuka flyout sejajar ikon yang diklik. */
  function toggleFlyout(module: MenuModule, button: HTMLButtonElement) {
    setFlyout((current) => {
      if (current?.module.id === module.id) return null
      const rect = button.getBoundingClientRect()
      return { module, left: rect.right + 8, top: rect.top }
    })
  }

  // Setelah terukur, panel digeser ke atas bila melewati tepi bawah viewport.
  useLayoutEffect(() => {
    const panel = flyoutRef.current
    if (!flyout || !panel) return
    const height = panel.getBoundingClientRect().height
    const top = Math.max(8, Math.min(flyout.top, window.innerHeight - height - 8))
    if (Math.abs(top - flyout.top) > 1) setFlyout({ ...flyout, top })
  }, [flyout])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <img src="/loka-icon.svg" alt="Loka" />
          <strong>Loka<span>Accounting</span></strong>
        </div>
        <div className="topbar-tools">
          <button type="button" title="Cari menu (Ctrl+K)" aria-label="Cari menu" onClick={() => setPalette(true)}><Icon name="search" /></button>
          <button type="button" title="Bantuan" aria-label="Bantuan"><Icon name="help" /></button>
          <button type="button" title="Notifikasi" aria-label="Notifikasi"><Icon name="bell" /></button>
        </div>
        <div className="topbar-org">
          <span>{profile.organization_name}</span>
          <small>IDR · Indonesia</small>
        </div>
        <button type="button" className="topbar-avatar" onClick={onLogout} title={`${profile.full_name} — klik untuk keluar`}>
          {profile.full_name.slice(0, 1).toUpperCase()}
        </button>
      </header>

      <nav className="tabbar" aria-label="Dokumen terbuka">
        {edges.left && <button type="button" className="tabbar-nudge is-left" onClick={() => nudge(-1)} aria-label="Geser tab ke kiri"><Icon name="chevron" /></button>}
        <div className="tabbar-strip" ref={stripRef} onScroll={measure} {...dragHandlers}>
          {tabs.map((tab, index) => (
            <span key={tab.key} className={cx('doc-tab', tab.key === active && 'is-active', moving === index && 'is-moving')} data-tab-active={tab.key === active} data-index={index}
              onAuxClick={(event) => { if (event.button === 1 && tab.closable) { event.preventDefault(); if (tab.dirty) setClosing(tab); else onClose(tab.key) } }}>
              <button type="button" onClick={() => onActivate(tab.key)} aria-current={tab.key === active ? 'page' : undefined} title={tab.label}>{tab.label}</button>
              {tab.dirty && <i className="doc-tab-dirty" title="Ada perubahan yang belum disimpan" />}
              {tab.closable && <button type="button" className="doc-tab-close" onClick={() => tab.dirty ? setClosing(tab) : onClose(tab.key)} aria-label={`Tutup ${tab.label}`}><Icon name="close" /></button>}
            </span>
          ))}
        </div>
        {edges.right && <button type="button" className="tabbar-nudge is-right" onClick={() => nudge(1)} aria-label="Geser tab ke kanan"><Icon name="chevron" /></button>}
        <button type="button" className="tabbar-search" onClick={() => setPalette(true)} title="Cari menu (Ctrl+K)">
          <Icon name="search" /><span>Cari menu</span><kbd>Ctrl K</kbd>
        </button>
        <div className="tabbar-count">
          <button type="button" onClick={() => setOverflow((value) => !value)} aria-expanded={overflow} title="Daftar tab terbuka">
            {tabs.length} <Icon name="chevron" />
          </button>
          {overflow && (
            <div className="tabbar-menu" role="menu">
              {tabs.map((tab) => (
                <button key={tab.key} type="button" role="menuitem" className={cx(tab.key === active && 'is-active')} onClick={() => { onActivate(tab.key); setOverflow(false) }}>{tab.label}</button>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="shell-body">
        <div className="icon-rail" ref={railRef}>
          {modules.map((module) => (
            <div className="rail-slot" key={module.id}>
              <button
                type="button"
                className={cx('rail-icon', activeModule === module.id && 'is-active', flyout?.module.id === module.id && 'is-open')}
                onClick={(event) => toggleFlyout(module, event.currentTarget)}
                aria-expanded={flyout?.module.id === module.id}
                aria-label={module.label}
                title={module.label}
              >
                <Icon name={module.icon} />
              </button>
              <span className="rail-tooltip">{module.label}</span>
            </div>
          ))}
        </div>

        {flyout && createPortal(
          <div className="flyout" role="menu" ref={flyoutRef} style={{ left: flyout.left, top: flyout.top }}>
            <h2>{flyout.module.label}</h2>
            <div className="flyout-tiles" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(flyout.module.tiles.length, 2), 4)}, 100px)` }}>
              {flyout.module.tiles.map((tile) => (
                <button key={`${flyout.module.id}-${tile.key}-${tile.label}`} type="button" role="menuitem" className={cx('tile', `tile-${tile.group}`)} onClick={() => openTile(tile)} title={tile.hint}>
                  <Icon name={tile.icon} />
                  <span>{tile.label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

        <main className="tab-stage">{children}</main>
      </div>

      <MenuSearch open={palette} onClose={() => setPalette(false)} onOpenTile={onOpen} />

      <ConfirmDialog
        open={closing !== null}
        tone="danger"
        title="Tutup tab tanpa menyimpan?"
        confirmLabel="Tutup tab"
        onClose={() => setClosing(null)}
        onConfirm={async () => { if (closing) onClose(closing.key); setClosing(null) }}
        description={<>Tab <strong>{closing?.label}</strong> memiliki perubahan yang belum disimpan. Menutupnya akan membuang perubahan tersebut.</>}
      />
    </div>
  )
}
