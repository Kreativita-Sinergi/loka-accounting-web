import { describe, expect, it } from 'vitest'
import { normalizeAmounts, normalizeLines, signedTotals } from './journal'

describe('normalizeAmounts', () => {
  it('memindahkan debit minus ke kolom kredit', () => {
    expect(normalizeAmounts('-5000', '0')).toEqual({ debit: '0', credit: '5000' })
  })

  it('memindahkan kredit minus ke kolom debit', () => {
    expect(normalizeAmounts('0', '-166858497')).toEqual({ debit: '166858497', credit: '0' })
  })

  it('tidak mengubah angka positif dan tidak membulatkannya', () => {
    expect(normalizeAmounts('166858497.25', '0')).toEqual({ debit: '166858497.25', credit: '0' })
    expect(normalizeAmounts('-166858497.25', '')).toEqual({ debit: '0', credit: '166858497.25' })
  })

  it('menyelesaikan dua kolom terisi lewat selisihnya', () => {
    expect(normalizeAmounts('1000', '-250')).toEqual({ debit: '1250', credit: '0' })
    expect(normalizeAmounts('-1000', '250')).toEqual({ debit: '0', credit: '1250' })
  })

  it('mengisi kolom kosong dengan nol', () => {
    expect(normalizeAmounts('', '')).toEqual({ debit: '0', credit: '0' })
  })
})

describe('normalizeLines', () => {
  it('mempertahankan akun dan keterangan baris', () => {
    const lines = [{ account_id: 'a1', description: 'Saldo awal', debit: '-7500', credit: '0' }]
    expect(normalizeLines(lines)).toEqual([{ account_id: 'a1', description: 'Saldo awal', debit: '0', credit: '7500' }])
  })
})

describe('signedTotals', () => {
  it('menyeimbangkan jurnal yang salah satu barisnya minus', () => {
    const lines = [
      { account_id: 'a1', description: '', debit: '-5000', credit: '0' },
      { account_id: 'a2', description: '', debit: '5000', credit: '0' },
    ]
    expect(signedTotals(lines)).toEqual({ debit: 5000, credit: 5000 })
  })
})
