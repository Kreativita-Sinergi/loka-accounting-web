import { decimal } from './money'
import type { JournalLineInput } from '../types/accounting'

/**
 * Pembukuan berpasangan tidak mengenal nominal minus: yang ada adalah posisi
 * debit dan kredit. Saldo kas −5.000.000 berarti kas berada di sisi KREDIT
 * sebesar 5.000.000, bukan debit negatif. Backend menegakkan itu — setiap baris
 * jurnal wajib berisi tepat satu nilai positif di debit atau kredit — sehingga
 * nominal minus ditolak dengan galat yang tidak menjelaskan apa-apa bagi
 * pengguna.
 *
 * Alih-alih melonggarkan aturan itu (debit negatif akan merusak neraca saldo,
 * buku besar, dan setiap laporan yang menjumlahkan kolomnya), nominal minus
 * diterjemahkan di sini ke sisi yang berlawanan.
 */

/** Angka nol dalam berbagai penulisan; dianggap kolom kosong. */
const isZero = (value: string) => decimal(value) === 0

/**
 * Membuang tanda minus tanpa melewati konversi ke float, supaya angka panjang
 * seperti 166.858.497 tidak kehilangan ketelitian dalam perjalanan.
 */
const absolute = (value: string) => value.trim().replace(/^-\s*/, '')

/**
 * Menormalkan sepasang nominal debit/kredit menjadi bentuk yang diterima
 * backend: keduanya tidak pernah minus, dan hanya satu yang terisi.
 */
export function normalizeAmounts(debit: string, credit: string): { debit: string; credit: string } {
  const debitValue = decimal(debit)
  const creditValue = decimal(credit)

  // Kasus lumrah: satu kolom terisi. Nominal minus pindah ke kolom seberangnya
  // dengan angka aslinya, jadi tidak ada pembulatan sama sekali.
  if (isZero(credit) && debitValue < 0) return { debit: '0', credit: absolute(debit) }
  if (isZero(debit) && creditValue < 0) return { debit: absolute(credit), credit: '0' }
  if (debitValue >= 0 && creditValue >= 0) return { debit: debit.trim() || '0', credit: credit.trim() || '0' }

  // Kedua kolom terisi sekaligus — sisanya diselesaikan lewat selisihnya.
  const net = debitValue - creditValue
  return net >= 0 ? { debit: String(net), credit: '0' } : { debit: '0', credit: String(-net) }
}

/** Menormalkan seluruh baris jurnal sebelum dikirim ke backend. */
export function normalizeLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.map((line) => ({ ...line, ...normalizeAmounts(line.debit, line.credit) }))
}

/**
 * Nilai yang dipakai untuk menghitung total dan keseimbangan di form. Nominal
 * minus di kolom debit ikut mengurangi total debit, sehingga angka yang terlihat
 * pengguna sama dengan yang akan diposting setelah dinormalkan.
 */
export function signedTotals(lines: JournalLineInput[]) {
  const normalized = normalizeLines(lines)
  return {
    debit: normalized.reduce((total, line) => total + decimal(line.debit), 0),
    credit: normalized.reduce((total, line) => total + decimal(line.credit), 0),
  }
}
