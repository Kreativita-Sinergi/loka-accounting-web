import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { modules, type MenuTile, type PageKey } from '../lib/menu'
import { useAccess } from '../lib/rbac'
import { Icon } from './Icon'
import { cx } from './ui'

type Entry = MenuTile & { module: string }

/** Semua ubin menu, diberi nama modulnya agar hasil pencarian punya konteks. */
const allEntries: Entry[] = modules.flatMap((module) => module.tiles.map((tile) => ({ ...tile, module: module.label })))

/**
 * Skor kecocokan sederhana: kata kunci harus muncul berurutan sebagai
 * potongan teks. Cocok di awal kata bernilai lebih tinggi daripada di tengah.
 */
function score(entry: Entry, terms: string[]): number {
  const label = entry.label.toLowerCase()
  const haystack = `${entry.label} ${entry.module} ${entry.hint} ${entry.key}`.toLowerCase()
  let total = 0
  for (const term of terms) {
    const inLabel = label.indexOf(term)
    if (inLabel === 0) { total += 100; continue }
    if (inLabel > 0) { total += label[inLabel - 1] === ' ' ? 70 : 40; continue }
    const inRest = haystack.indexOf(term)
    if (inRest < 0) return -1
    total += 15
  }
  return total
}

/** Menyorot bagian judul yang cocok dengan kata kunci. */
function highlight(label: string, terms: string[]) {
  const lower = label.toLowerCase()
  const marks = new Array<boolean>(label.length).fill(false)
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = lower.indexOf(term, from)
      if (at < 0) break
      for (let i = at; i < at + term.length; i += 1) marks[i] = true
      from = at + term.length
    }
  }
  const parts: { text: string; hit: boolean }[] = []
  for (let i = 0; i < label.length; i += 1) {
    const last = parts[parts.length - 1]
    if (last && last.hit === marks[i]) last.text += label[i]
    else parts.push({ text: label[i], hit: marks[i] })
  }
  return parts.map((part, index) => part.hit ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>)
}

const RECENT_KEY = 'loka.menu.recent'

function readRecent(): PageKey[] {
  try { const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(raw) ? raw.filter((k) => typeof k === 'string').slice(0, 6) : [] } catch { return [] }
}

/** Menyimpan menu yang baru dibuka agar palet punya saran saat kotak masih kosong. */
export function rememberMenu(key: PageKey) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter((item) => item !== key)].slice(0, 6))) } catch { /* penyimpanan tidak tersedia */ }
}

/**
 * Palet pencarian menu (Ctrl+K). Mengetik menyaring seluruh ubin dari semua
 * modul sehingga pengguna tidak perlu menghafal letak menu di icon rail.
 */
export function MenuSearch({ open, onClose, onOpenTile }: { open: boolean; onClose: () => void; onOpenTile: (key: PageKey) => void }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { can } = useAccess()
  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query])
  // Palet hanya menawarkan menu yang memang boleh dibuka peran ini.
  const entries = useMemo(() => allEntries.filter((entry) => can(entry.view)), [can])

  const results = useMemo(() => {
    if (!terms.length) {
      const recent = readRecent()
      const suggested = recent.map((key) => entries.find((entry) => entry.key === key)).filter((entry): entry is Entry => Boolean(entry))
      return suggested.length ? suggested : entries.slice(0, 8)
    }
    return entries
      .map((entry) => ({ entry, value: score(entry, terms) }))
      .filter((row) => row.value >= 0)
      .sort((a, b) => b.value - a.value || a.entry.label.localeCompare(b.entry.label))
      .slice(0, 40)
      .map((row) => row.entry)
  }, [terms, entries])

  useEffect(() => { setCursor(0) }, [query])
  useEffect(() => { if (open) { setQuery(''); setCursor(0); requestAnimationFrame(() => inputRef.current?.focus()) } }, [open])

  // Baris terpilih selalu terlihat saat digulir dengan panah keyboard.
  useEffect(() => {
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, results])

  if (!open) return null

  function choose(entry: Entry) {
    rememberMenu(entry.key)
    onOpenTile(entry.key)
    onClose()
  }

  return createPortal(
    <div className="palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Cari menu">
        <div className="palette-field">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Cari menu — misal: faktur, jurnal, pemasok…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((value) => Math.min(value + 1, results.length - 1)) }
              else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((value) => Math.max(value - 1, 0)) }
              else if (event.key === 'Enter') { event.preventDefault(); const entry = results[cursor]; if (entry) choose(entry) }
              else if (event.key === 'Escape') { event.preventDefault(); onClose() }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} role="listbox">
          {results.length === 0 && <p className="palette-empty">Menu tidak ditemukan.</p>}
          {results.map((entry, index) => (
            <button
              key={`${entry.module}-${entry.key}`}
              type="button"
              role="option"
              aria-selected={index === cursor}
              data-cursor={index === cursor}
              className={cx('palette-row', index === cursor && 'is-cursor')}
              onMouseMove={() => setCursor(index)}
              onClick={() => choose(entry)}
            >
              <Icon name={entry.icon} />
              <span className="palette-label">{terms.length ? highlight(entry.label, terms) : entry.label}</span>
              <span className="palette-module">{entry.module}</span>
            </button>
          ))}
        </div>
        <footer className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> pilih</span>
          <span><kbd>Enter</kbd> buka tab</span>
          <span><kbd>Ctrl</kbd>+<kbd>K</kbd> buka pencarian</span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
