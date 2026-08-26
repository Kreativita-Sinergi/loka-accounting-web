import { useEffect, useRef } from 'react'

const EVENT = 'loka:ledger-changed'

/**
 * Bus perubahan buku besar. Setiap operasi yang memposting jurnal — kas
 * masuk/keluar, transfer kas, jurnal manual, saldo awal, biaya, pelunasan,
 * dokumen penjualan/pembelian, dan mutasi persediaan — memanggil fungsi ini
 * dari lapisan `src/api/`. Karena shell menahan setiap tab tetap ter-mount
 * (§3.4), halaman buku besar dan saldo akun tidak akan pernah memuat ulang
 * dengan sendirinya; sinyal inilah yang membuatnya ikut segar.
 */
export function notifyLedgerChanged() {
  window.dispatchEvent(new Event(EVENT))
}

/** Memuat ulang data halaman setiap kali ada jurnal baru diposting. */
export function useLedgerRefresh(reload: () => void) {
  const latest = useRef(reload)
  useEffect(() => { latest.current = reload }, [reload])
  useEffect(() => {
    const run = () => latest.current()
    window.addEventListener(EVENT, run)
    return () => window.removeEventListener(EVENT, run)
  }, [])
}
