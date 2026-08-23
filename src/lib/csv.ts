import type { Paged, PageRequest } from '../api/paging'

/** Mengambil seluruh halaman daftar untuk keperluan ekspor. */
export async function fetchAllPages<T>(fetcher: (request: PageRequest) => Promise<Paged<T>>, request: Omit<PageRequest, 'page' | 'size'>, max = 5000) {
  const rows: T[] = []
  for (let page = 1; rows.length < max; page += 1) {
    const result = await fetcher({ ...request, page, size: 200 })
    rows.push(...(result.rows ?? []))
    if (rows.length >= (result.total ?? rows.length) || (result.rows ?? []).length === 0) break
  }
  return rows
}

const cell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",;\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Menulis CSV (pemisah titik koma, sesuai Excel Indonesia) lalu mengunduhnya. */
export function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const content = [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')
  // BOM agar Excel membaca UTF-8 dengan benar.
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
