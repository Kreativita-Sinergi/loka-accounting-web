import { useCallback, useEffect, useMemo, useState } from 'react'
import { listAuditLogs, listMembers } from '../api/operations'
import type { AuditLog, OrganizationMember } from '../types/operations'
import { Badge, PageHeader } from '../components/ui'
import { ListView, type ListColumn } from '../components/ListView'
import { Modal, messageOf } from '../components/Modal'

/**
 * Log Aktivitas: jejak audit organisasi (`GET /audit-logs`). Barisnya ditulis
 * backend di dalam transaksi yang sama dengan perubahan datanya, sehingga
 * tindakan yang gagal atau di-rollback tidak pernah muncul di sini.
 */

/** Nama aksi backend → kalimat Indonesia. Aksi tak dikenal tampil apa adanya. */
const actionLabels: Record<string, string> = {
  JOURNAL_CREATED: 'Jurnal dibuat',
  JOURNAL_POSTED: 'Jurnal diposting',
  JOURNAL_REVERSED: 'Jurnal dihapus (dibatalkan)',
  JOURNAL_AMENDED: 'Jurnal diubah',
  PERIOD_LOCKED: 'Periode dikunci',
  FISCAL_PERIOD_CLOSED: 'Tutup buku tahunan',
  BANK_RECONCILED: 'Rekonsiliasi bank',
  EXPENSE_RECORDED: 'Biaya dicatat',
  PURCHASE_RECORDED: 'Pembelian dicatat',
  PAYABLE_CREATED: 'Utang dibuat',
  PAYABLE_PAYMENT_ALLOCATED: 'Pembayaran utang dialokasikan',
  RECEIVABLE_CREATED: 'Piutang dibuat',
  RECEIVABLE_PAYMENT_ALLOCATED: 'Pelunasan piutang dialokasikan',
  PAYROLL_POSTED: 'Penggajian diposting',
  MANUFACTURING_COMPLETED: 'Produksi diselesaikan',
  FX_REMEASURED: 'Revaluasi kurs dijalankan',
}

const entityLabels: Record<string, string> = {
  JOURNAL_ENTRY: 'Jurnal',
  ACCOUNTING_PERIOD: 'Periode',
  FISCAL_PERIOD: 'Tahun buku',
  RECONCILIATION: 'Rekonsiliasi',
  EXPENSE: 'Biaya',
  PURCHASE: 'Pembelian',
  PAYABLE: 'Utang',
  RECEIVABLE: 'Piutang',
  PAYROLL_RUN: 'Penggajian',
  MANUFACTURING_ORDER: 'Order produksi',
  FX_REMEASUREMENT_RUN: 'Revaluasi kurs',
}

/** Aksi yang menghapus atau membatalkan data; ditandai agar mudah ditemukan. */
const destructiveActions = new Set(['JOURNAL_REVERSED', 'JOURNAL_AMENDED'])

const labelOf = (map: Record<string, string>, value: string) => map[value] ?? value

function formatMoment(value: string) {
  const moment = new Date(value)
  if (Number.isNaN(moment.getTime())) return value
  return moment.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Keterangan singkat dari metadata. `source` selalu ada dan tidak menjelaskan
 * apa pun bagi pembaca, jadi disembunyikan dari ringkasan.
 */
function summaryOf(log: AuditLog) {
  const metadata = log.metadata ?? {}
  if (metadata.replacement_number) {
    return `${metadata.journal_number ?? ''} diganti oleh ${metadata.replacement_number}`.trim()
  }
  if (metadata.reversal_number) {
    return `${metadata.journal_number ?? ''} dibatalkan lewat ${metadata.reversal_number}`.trim()
  }
  if (metadata.amends_number) {
    return `Pengganti dari ${metadata.amends_number}`
  }
  const rest = Object.entries(metadata).filter(([key]) => key !== 'source')
  if (rest.length === 0) return '—'
  return rest.map(([key, value]) => `${key}: ${value}`).join(' · ')
}

export function ActivityPage() {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(50)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<AuditLog | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listAuditLogs(page, size)
      setLogs(result?.items ?? [])
      setTotal(result?.total ?? 0)
      setError(null)
    } catch (caught) {
      setError(messageOf(caught, 'Log aktivitas gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [page, size])

  useEffect(() => { void load() }, [load])

  // Jejak audit hanya menyimpan id pelaku; namanya diambil dari daftar anggota.
  useEffect(() => {
    let cancelled = false
    listMembers()
      .then((value) => { if (!cancelled) setMembers(value ?? []) })
      .catch(() => { if (!cancelled) setMembers([]) })
    return () => { cancelled = true }
  }, [])

  const actorOf = useCallback((log: AuditLog) => {
    if (!log.actor_id) return log.actor_type === 'SYSTEM' ? 'Sistem' : '—'
    const member = members.find((candidate) => candidate.user_id === log.actor_id)
    return member?.full_name || member?.email || log.actor_id.slice(0, 8)
  }, [members])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return logs
    return logs.filter((log) =>
      `${actorOf(log)} ${labelOf(actionLabels, log.action)} ${log.action} ${labelOf(entityLabels, log.entity_type)} ${summaryOf(log)}`
        .toLowerCase().includes(needle))
  }, [logs, search, actorOf])

  const columns: Array<ListColumn<AuditLog>> = [
    { key: 'time', header: 'Waktu', width: '190px', cell: (log) => formatMoment(log.created_at) },
    { key: 'actor', header: 'Pengguna', width: '200px', cell: (log) => actorOf(log) },
    {
      key: 'action', header: 'Aksi', width: '230px',
      cell: (log) => destructiveActions.has(log.action)
        ? <Badge tone="warning">{labelOf(actionLabels, log.action)}</Badge>
        : labelOf(actionLabels, log.action),
    },
    { key: 'entity', header: 'Entitas', width: '150px', cell: (log) => labelOf(entityLabels, log.entity_type) },
    { key: 'summary', header: 'Keterangan', cell: (log) => summaryOf(log) },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="AUDIT TRAIL"
        title="Log aktivitas"
        description="Riwayat perubahan data yang dicatat backend, termasuk siapa yang membuat, memposting, dan menghapus jurnal. Baris di sini tidak dapat diubah maupun dihapus."
        action={<Badge tone="info">{total} aktivitas</Badge>}
      />
      <ListView
        storageKey="activity"
        columns={columns}
        rows={visible}
        keyOf={(log) => log.id}
        loading={loading}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Cari pengguna, aksi, atau keterangan"
        onRefresh={() => void load()}
        onPrint={() => window.print()}
        rowActions={[{ label: 'Lihat rincian', icon: 'ledger', readOnly: true, onSelect: setDetail }]}
        onRowOpen={setDetail}
        empty={error ?? 'Belum ada aktivitas yang tercatat.'}
        server={{
          total,
          page,
          size,
          sort: null,
          order: 'desc',
          onChange: (next) => { setPage(next.page); setSize(next.size) },
        }}
      />

      <ActivityDetail log={detail} actor={detail ? actorOf(detail) : ''} onClose={() => setDetail(null)} />
    </section>
  )
}

function ActivityDetail({ log, actor, onClose }: { log: AuditLog | null; actor: string; onClose: () => void }) {
  if (!log) return null
  const entries = Object.entries(log.metadata ?? {}).filter(([key]) => key !== 'source')
  return (
    <Modal
      open
      size="md"
      eyebrow="LOG AKTIVITAS"
      title={labelOf(actionLabels, log.action)}
      description={`${formatMoment(log.created_at)} · ${actor}`}
      onClose={onClose}
    >
      <div className="table-wrap">
        <table>
          <tbody>
            <tr><td>Aksi</td><td className="mono">{log.action}</td></tr>
            <tr><td>Entitas</td><td>{labelOf(entityLabels, log.entity_type)} <span className="mono">{log.entity_id}</span></td></tr>
            <tr><td>Pelaku</td><td>{actor} <small>({log.actor_type})</small></td></tr>
            {log.ip_address && <tr><td>Alamat IP</td><td className="mono">{log.ip_address}</td></tr>}
            {entries.map(([key, value]) => (
              <tr key={key}><td>{key.replaceAll('_', ' ')}</td><td className="mono">{value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
