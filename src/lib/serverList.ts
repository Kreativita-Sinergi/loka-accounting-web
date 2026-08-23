import { useCallback, useEffect, useState } from 'react'
import type { Paged, PageRequest } from '../api/paging'
import { usePersisted } from './persist'

export type ServerListState = {
  page: number
  size: number
  sort: string | null
  order: 'asc' | 'desc'
}

/**
 * Menyatukan state daftar server-side: halaman, ukuran, pengurutan, pencarian,
 * dan filter — lalu memanggil ulang API setiap kali salah satunya berubah.
 * Ukuran halaman dan filter tersimpan per pengguna per halaman (§4.1).
 */
export function useServerList<T>(
  storageKey: string,
  fetcher: (request: PageRequest) => Promise<Paged<T>>,
  options: { defaultSort: string; defaultOrder?: 'asc' | 'desc'; filters: Record<string, string> },
) {
  const [size, setSize] = usePersisted(`size.${storageKey}`, 50)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<string | null>(options.defaultSort)
  const [order, setOrder] = useState<'asc' | 'desc'>(options.defaultOrder ?? 'asc')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(options.filters)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetcher({ page, size, sort: sort ?? undefined, order, search, filters: JSON.parse(filterKey) as Record<string, string> })
      setRows(result.rows ?? [])
      setTotal(result.total ?? 0)
      setError(null)
    } catch {
      setError('Daftar gagal dimuat.')
    } finally {
      setLoading(false)
    }
    // fetcher sengaja tidak menjadi dependensi: pemanggil membuatnya inline.
  }, [page, size, sort, order, search, filterKey])

  useEffect(() => { void load() }, [load])
  // Filter atau pencarian baru selalu mengembalikan pengguna ke halaman pertama.
  useEffect(() => { setPage(1) }, [filterKey, search])

  return {
    rows, total, loading, error, reload: load,
    search, setSearch,
    server: {
      total, page, size, sort, order,
      onChange: (next: ServerListState) => { setPage(next.page); setSize(next.size); setSort(next.sort); setOrder(next.order) },
    },
  }
}
