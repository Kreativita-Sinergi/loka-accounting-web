import { describe, expect, it } from 'vitest'
import { decimal, formatDate, formatMinor, formatMoney, fromMinor, lineTotal } from './money'
import type { DocumentLine } from '../components/LineGrid'

const line = (patch: Partial<DocumentLine>): DocumentLine => ({
  id: 'x', item_id: '', description: '', quantity: '1', unit_price: '0', discount: '0', warehouse_id: '', note: '', ...patch,
})

describe('format angka Indonesia', () => {
  it('memakai titik ribuan', () => {
    expect(formatMoney(1250000)).toBe('1.250.000')
  })

  it('membagi nilai minor unit dengan skala mata uang', () => {
    expect(fromMinor(150_000, 2)).toBe(1500)
    expect(fromMinor(150_000, 0)).toBe(150_000)
    expect(formatMinor(150_050, 2)).toBe('1.500,50')
  })

  it('menampilkan tanggal sebagai 23 Agu 2026', () => {
    expect(formatDate('2026-08-23')).toMatch(/23 Agu/)
  })

  it('menerima koma sebagai pemisah desimal', () => {
    expect(decimal('12,5')).toBe(12.5)
    expect(decimal('bukan angka')).toBe(0)
  })
})

describe('total baris dokumen', () => {
  it('menghitung kuantitas × harga × (1 − diskon%)', () => {
    expect(lineTotal(line({ quantity: '2', unit_price: '150000' }))).toBe(300000)
    expect(lineTotal(line({ quantity: '2', unit_price: '150000', discount: '10' }))).toBe(270000)
  })
})
