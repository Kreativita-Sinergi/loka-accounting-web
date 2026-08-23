import { useEffect, useState } from 'react'
import { getDocumentJournal } from '../api/operations'
import { Modal, messageOf } from './Modal'
import { formatDate, formatMinor } from '../lib/money'
import type { DocumentJournalRow } from '../types/operations'

/**
 * "Lihat Jurnal" (§4.3) — fitur kepercayaan: memperlihatkan jurnal yang
 * dihasilkan sebuah dokumen, diambil dari `GET /documents/:id/journal`.
 */
export function JournalPeek({ open, documentId, number, scale, onClose }: { open: boolean; documentId: string; number: string; scale: number; onClose: () => void }) {
  const [rows, setRows] = useState<DocumentJournalRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !documentId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getDocumentJournal(documentId)
      .then((journal) => { if (!cancelled) setRows(journal ?? []) })
      .catch((cause) => { if (!cancelled) setError(messageOf(cause, 'Jurnal dokumen gagal dimuat.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, documentId])

  const debit = rows.reduce((total, row) => total + row.debit_minor, 0)
  const credit = rows.reduce((total, row) => total + row.credit_minor, 0)

  return (
    <Modal open={open} size="lg" eyebrow="JURNAL DOKUMEN" title={`Jurnal ${number}`} description="Jurnal yang dihasilkan dokumen ini, langsung dari buku besar." onClose={onClose}>
      {error && <p className="modal-error">{error}</p>}
      {loading ? <div className="loading" role="status">Memuat jurnal…</div> : rows.length === 0 ? (
        <p className="modal-note">
          Dokumen <strong>{number}</strong> belum menghasilkan jurnal. Jurnal terbentuk ketika dokumen diselesaikan;
          penawaran dan pesanan memang tidak pernah menghasilkan jurnal.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Jurnal</th><th>Tanggal</th><th>Akun</th><th>Keterangan</th><th className="number">Debit</th><th className="number">Kredit</th></tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.journal_id}-${index}`}>
                  <td className="mono">{row.journal_number}</td>
                  <td>{formatDate(row.transaction_date)}</td>
                  <td>{row.account_code} · {row.account_name}</td>
                  <td>{row.description}</td>
                  <td className="number mono">{formatMinor(row.debit_minor, scale)}</td>
                  <td className="number mono">{formatMinor(row.credit_minor, scale)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Total</th>
                <th className="number mono">{formatMinor(debit, scale)}</th>
                <th className="number mono">{formatMinor(credit, scale)}</th>
              </tr>
            </tfoot>
          </table>
          {debit !== credit && <p className="balance-error">Debit dan kredit tidak seimbang — periksa posting dokumen ini.</p>}
        </div>
      )}
    </Modal>
  )
}
