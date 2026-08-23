import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isKnownTile, tileOf, type PageKey } from '../lib/menu'

export type Tab = { key: PageKey; label: string; closable: boolean; dirty: boolean }

const MAX_TABS = 15
export const HOME_KEY: PageKey = 'company.dashboard'
const HOME: Tab = { key: HOME_KEY, label: 'Dashboard', closable: false, dirty: false }

/** Tab aktif tercermin di URL agar halaman dapat di-refresh dan dibagikan. */
function keyFromHash(): PageKey | null {
  const value = window.location.hash.replace(/^#\/?/, '')
  return isKnownTile(value) ? value : null
}

/**
 * State tab dokumen (§3.4). Identitas tab adalah `key` halaman, jadi membuka
 * ubin yang sama dua kali hanya mengaktifkan tab yang sudah ada.
 */
export function useTabs() {
  const initial = keyFromHash()
  const [tabs, setTabs] = useState<Tab[]>(() => initial && initial !== HOME_KEY
    ? [HOME, { key: initial, label: tileOf(initial).label, closable: true, dirty: false }]
    : [HOME])
  const [active, setActive] = useState<PageKey>(initial ?? HOME_KEY)

  // URL mengikuti tab aktif tanpa memuat ulang halaman.
  useEffect(() => {
    if (keyFromHash() !== active) window.history.replaceState(null, '', `#/${active}`)
  }, [active])

  // Tombol back/forward browser tetap berpindah tab.
  useEffect(() => {
    const follow = () => { const key = keyFromHash(); if (key) setActive(key) }
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])

  const open = useCallback((key: PageKey, label?: string) => {
    setTabs((current) => {
      if (current.some((tab) => tab.key === key)) return current
      const next = [...current, { key, label: label ?? tileOf(key).label, closable: true, dirty: false }]
      // Melebihi batas: tutup tab terlama yang boleh ditutup dan tidak kotor.
      if (next.length > MAX_TABS) {
        const victim = next.findIndex((tab) => tab.closable && !tab.dirty)
        if (victim >= 0) next.splice(victim, 1)
      }
      return next
    })
    setActive(key)
  }, [])

  const close = useCallback((key: PageKey) => {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.key === key)
      if (index < 0 || !current[index].closable) return current
      const next = current.filter((tab) => tab.key !== key)
      setActive((currentActive) => currentActive === key ? (next[index - 1] ?? next[0]).key : currentActive)
      return next
    })
  }, [])

  const setDirty = useCallback((key: PageKey, dirty: boolean) => {
    setTabs((current) => current.some((tab) => tab.key === key && tab.dirty !== dirty)
      ? current.map((tab) => tab.key === key ? { ...tab, dirty } : tab)
      : current)
  }, [])

  const rename = useCallback((key: PageKey, label: string) => {
    setTabs((current) => current.some((tab) => tab.key === key && tab.label !== label)
      ? current.map((tab) => tab.key === key ? { ...tab, label } : tab)
      : current)
  }, [])

  return { tabs, active, open, close, setActive, setDirty, rename }
}

/** Kontrol tab yang tersedia bagi halaman di dalam tab tersebut. */
export type TabHandle = { setDirty: (dirty: boolean) => void; rename: (label: string) => void; restore: () => void }

export const TabContext = createContext<TabHandle | null>(null)

const noop: TabHandle = { setDirty: () => undefined, rename: () => undefined, restore: () => undefined }

/**
 * Melaporkan status "belum disimpan" dan label tab dari dalam form. Nilai
 * kotor membuat tab meminta konfirmasi sebelum ditutup (§3.4).
 */
export function useTabHandle(dirty?: boolean, label?: string) {
  const handle = useContext(TabContext) ?? noop
  useEffect(() => { if (dirty !== undefined) handle.setDirty(dirty) }, [handle, dirty])
  useEffect(() => { if (label) handle.rename(label) }, [handle, label])
  // Saat form ditutup, tab kembali ke label daftar dan tidak lagi kotor.
  useEffect(() => () => {
    handle.setDirty(false)
    handle.restore()
  }, [handle])
  return handle
}
