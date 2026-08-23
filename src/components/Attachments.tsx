import { useEffect, useRef, useState } from 'react'
import { deleteAttachment, downloadAttachment, listAttachments, uploadAttachment } from '../api/operations'
import { Modal, messageOf } from './Modal'
import { Button } from './ui'
import { Icon } from './Icon'
import { formatDate } from '../lib/money'
import type { Attachment } from '../types/operations'

/** Lampiran dokumen (§4.3): unggah, daftar, unduh, hapus. */
export function AttachmentsModal({
  open, entityType, entityId, title, onClose, onNotice,
}: {
  open: boolean
  entityType: string
  entityId: string
  title: string
  onClose: () => void
  onNotice: (message: string) => void
}) {
  const [rows, setRows] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !entityId) return
    let cancelled = false
    setLoading(true)
    listAttachments(entityType, entityId)
      .then((value) => { if (!cancelled) { setRows(value ?? []); setError(null) } })
      .catch((cause) => { if (!cancelled) setError(messageOf(cause, 'Lampiran gagal dimuat.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, entityType, entityId])

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setRows(await listAttachments(entityType, entityId))
      onNotice(success)
    } catch (cause) {
      setError(messageOf(cause, 'Aksi lampiran gagal.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} eyebrow="LAMPIRAN" title={`Lampiran ${title}`} description="Berkas pendukung dokumen, maksimal 25 MB per berkas." onClose={onClose}>
      {error && <p className="modal-error">{error}</p>}
      <div className="mb-3 flex items-center gap-2">
        <input
          ref={picker}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void run(() => uploadAttachment(entityType, entityId, file), `${file.name} berhasil diunggah.`)
          }}
        />
        <Button icon="upload" onClick={() => picker.current?.click()} disabled={busy}>Unggah berkas</Button>
        {busy && <span className="text-[11px] text-slate-500">Memproses…</span>}
      </div>
      {loading ? <div className="loading" role="status">Memuat lampiran…</div> : rows.length === 0 ? (
        <p className="modal-note">Belum ada lampiran untuk dokumen ini.</p>
      ) : (
        <div className="record-list">
          {rows.map((attachment) => (
            <div className="record-row" key={attachment.id}>
              <div>
                <strong>{attachment.file_name}</strong>
                <small>{Math.max(1, Math.round(attachment.size_bytes / 1024))} KB · {attachment.content_type} · {formatDate(attachment.created_at)}</small>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" className="tool-icon" title="Unduh" onClick={() => void downloadAttachment(attachment)}><Icon name="download" /></button>
                <button type="button" className="tool-icon" title="Hapus" disabled={busy} onClick={() => void run(() => deleteAttachment(attachment.id), `${attachment.file_name} dihapus.`)}><Icon name="trash" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
