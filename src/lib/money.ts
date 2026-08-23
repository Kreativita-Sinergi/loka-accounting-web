import type { DocumentLine } from '../components/LineGrid'

/** Angka Indonesia: titik ribuan, koma desimal (§05). */
export function formatMoney(value: number, decimals = 0) {
  return value.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatRupiah(value: number) {
  return `Rp ${formatMoney(value)}`
}

/** Tanggal tampilan: 22 Agu 2026; tanggal input tetap ISO untuk API. */
export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Nilai minor unit (sen) menjadi nilai mata uang sesuai skala perusahaan. */
export function fromMinor(value: number, scale: number) {
  return scale > 0 ? value / 10 ** scale : value
}

/** Format nilai minor unit langsung ke angka Indonesia. */
export function formatMinor(value: number, scale: number) {
  return formatMoney(fromMinor(value, scale), scale)
}

export const decimal = (value: string) => {
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Total Harga = Kuantitas × @Harga × (1 − Diskon%) — §4.3. */
export function lineTotal(line: DocumentLine) {
  return decimal(line.quantity) * decimal(line.unit_price) * (1 - decimal(line.discount) / 100)
}
