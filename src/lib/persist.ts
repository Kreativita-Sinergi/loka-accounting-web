import { useEffect, useState } from 'react'

/**
 * Preferensi tampilan (filter chip, kolom, ukuran halaman) disimpan per
 * pengguna per halaman — §4.1 spesifikasi.
 */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(`loka.${key}`)
      return stored ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { window.localStorage.setItem(`loka.${key}`, JSON.stringify(value)) } catch { /* penyimpanan penuh atau diblokir */ }
  }, [key, value])
  return [value, setValue] as const
}
