import { isValidElement, type ReactNode } from 'react'

/**
 * Pengurutan dan penyaringan bersama untuk semua tabel (§4.1).
 *
 * Kolom boleh menyediakan `sortValue` sendiri. Bila tidak, nilai diambil dari
 * teks sel yang dirender, lalu ditafsirkan sebagai angka atau tanggal Indonesia
 * jika bentuknya memang begitu — sehingga kolom nominal dan tanggal tetap
 * terurut benar tanpa setiap halaman perlu mendaftarkannya satu per satu.
 */

/** Membaca seluruh teks yang tampak di dalam sebuah sel. */
export function nodeText(node: ReactNode): string {
  return rawText(node).replace(/\s+/g, ' ').trim()
}

function rawText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(rawText).join(' ')
  if (isValidElement(node)) return rawText((node.props as { children?: ReactNode }).children)
  return ''
}

const months: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6, jul: 7, agu: 8, sep: 9, okt: 10, nov: 11, des: 12,
}

/** "22 Agu 2026" → 20260822; format lain menghasilkan NaN. */
function dateValue(text: string): number {
  const match = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(text.trim())
  if (!match) return Number.NaN
  const month = months[match[2].toLowerCase()]
  if (!month) return Number.NaN
  return Number(match[3]) * 10000 + month * 100 + Number(match[1])
}

/** "(1.500,25)" dan "-1.500,25" → -1500.25; teks lain menghasilkan NaN. */
function numberValue(text: string): number {
  const trimmed = text.trim()
  if (!/^[-(]?\s*(\d{1,3}(\.\d{3})+|\d+)(,\d+)?\s*\)?$/.test(trimmed)) return Number.NaN
  const negative = trimmed.startsWith('-') || trimmed.startsWith('(')
  const digits = trimmed.replace(/[^\d,]/g, '').replace(',', '.')
  const value = Number(digits)
  if (!Number.isFinite(value)) return Number.NaN
  return negative ? -value : value
}

/** Membandingkan dua nilai sel: angka dan tanggal secara numerik, sisanya alfabetis. */
export function compareValues(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  const a = String(left)
  const b = String(right)
  for (const parse of [numberValue, dateValue]) {
    const first = parse(a)
    const second = parse(b)
    if (Number.isFinite(first) && Number.isFinite(second)) return first - second
  }
  return a.localeCompare(b, 'id-ID', { numeric: true, sensitivity: 'base' })
}

/** Baris cocok dengan kata kunci bila salah satu selnya memuat kata itu. */
export function matchesQuery(texts: string[], query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = texts.join(' ').toLowerCase()
  return needle.split(/\s+/).every((term) => haystack.includes(term))
}
