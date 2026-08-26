import { describe, expect, it } from 'vitest'
import { compareValues, matchesQuery, nodeText } from './tableSort'

describe('pengurutan tabel', () => {
  it('membaca teks dari elemen bersarang', () => {
    expect(nodeText(['Bank ', ['BCA', 0]])).toBe('Bank BCA 0')
  })

  it('mengurutkan nominal Indonesia secara numerik, bukan alfabetis', () => {
    expect(compareValues('1.500.000', '900.000')).toBeGreaterThan(0)
    expect(compareValues('(1.200,50)', '300,25')).toBeLessThan(0)
  })

  it('mengurutkan tanggal Indonesia menurut waktunya', () => {
    expect(compareValues('02 Jan 2027', '30 Des 2026')).toBeGreaterThan(0)
    expect(compareValues('05 Mar 2026', '05 Agu 2026')).toBeLessThan(0)
  })

  it('kembali ke perbandingan teks untuk nilai biasa', () => {
    expect(compareValues('Andi', 'Budi')).toBeLessThan(0)
  })

  it('menyaring baris ketika semua kata kunci muncul', () => {
    expect(matchesQuery(['KM-2026-00001', 'Setoran modal'], 'setoran modal')).toBe(true)
    expect(matchesQuery(['KM-2026-00001', 'Setoran modal'], 'setoran bank')).toBe(false)
  })
})
