import { useSyncExternalStore } from 'react'

const key = 'loka.ledger.showCancelled'
const event = 'loka:ledger-visibility-changed'
let fallback = false

function snapshot() {
  try { return localStorage.getItem(key) === 'true' } catch { return fallback }
}

function subscribe(listener: () => void) {
  window.addEventListener(event, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(event, listener)
    window.removeEventListener('storage', listener)
  }
}

/** Shared display preference; never changes postings or their audit history. */
export function useShowCancelledJournals() {
  const value = useSyncExternalStore(subscribe, snapshot, () => false)
  function setValue(next: boolean) {
    fallback = next
    try { localStorage.setItem(key, String(next)) } catch { /* browser may block storage */ }
    window.dispatchEvent(new Event(event))
  }
  return [value, setValue] as const
}

export function CancelledJournalFilter({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check-row" title="Pasangan pembatalan pada tanggal yang sama disembunyikan secara bawaan. Pembatalan lintas tanggal tetap tampil agar laporan periode benar.">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    Tampilkan jurnal dibatalkan
  </label>
}
