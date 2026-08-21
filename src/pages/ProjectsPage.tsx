import { useEffect, useState } from 'react'
import { createProject, getProjectProfitability, listProjects, updateProject } from '../api/projects'
import { listContacts } from '../api/accounting'
import type { Contact } from '../types/accounting'
import type { Project, ProjectProfitabilityReport } from '../types/reports'
import { Badge, DataEntryGuide, PageHeader } from '../components/ui'
import { AddButton, DataTable, TablePanel, type Column } from '../components/DataTable'
import { FormModal, messageOf } from '../components/Modal'
import { amount } from './ReportsPage'

const statuses: Project['status'][] = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

type ProfitabilityRow = ProjectProfitabilityReport['rows'][number]

export function ProjectsPage({ onNotice }: { onNotice: (message: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [projects, setProjects] = useState<Project[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [report, setReport] = useState<ProjectProfitabilityReport | null>(null)
  const [startDate, setStartDate] = useState(`${today.slice(0, 4)}-01-01`)
  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [reloads, setReloads] = useState(0)

  const [editor, setEditor] = useState<{ project: Project | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.allSettled([listProjects(), listContacts(), getProjectProfitability({ start_date: startDate, end_date: endDate })])
      .then(([projectResult, contactResult, reportResult]) => {
        if (cancelled) return
        if (projectResult.status === 'fulfilled') setProjects(projectResult.value ?? [])
        if (contactResult.status === 'fulfilled') setContacts(contactResult.value ?? [])
        if (reportResult.status === 'fulfilled') setReport(reportResult.value)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [startDate, endDate, reloads])

  const editing = editor?.project ?? null
  const projectOf = (id: string) => projects.find((project) => project.id === id)

  async function submit(values: FormData) {
    const input = {
      code: String(values.get('code')),
      name: String(values.get('name')),
      contact_id: (values.get('contact_id') as string) || null,
      start_date: String(values.get('start_date') || ''),
      end_date: String(values.get('end_date') || ''),
      contract_value: String(values.get('contract_value') || '0'),
      budget_cost: String(values.get('budget_cost') || '0'),
      status: String(values.get('status')),
      notes: String(values.get('notes') || ''),
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) await updateProject(editing.id, input)
      else await createProject(input)
      setReloads((value) => value + 1)
      setEditor(null)
      onNotice(editing ? `Proyek ${editing.code} diperbarui.` : 'Proyek berhasil dibuat.')
    } catch (error) {
      setFormError(messageOf(error, 'Proyek gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const columns: Array<Column<ProfitabilityRow>> = [
    { header: 'Kode', className: 'mono', width: '120px', cell: (row) => row.code },
    { header: 'Proyek', cell: (row) => <><strong>{row.name}</strong>{row.billed_percent && <small className="block">Tertagih {row.billed_percent}%</small>}</> },
    { header: 'Status', cell: (row) => <Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'CANCELLED' ? 'warning' : 'neutral'}>{row.status}</Badge> },
    { header: 'Nilai kontrak', align: 'right', className: 'mono', cell: (row) => amount(row.contract_value) },
    { header: 'Pendapatan', align: 'right', className: 'mono', cell: (row) => amount(row.revenue) },
    { header: 'Biaya', align: 'right', className: 'mono', cell: (row) => amount(row.cost) },
    { header: 'Margin', align: 'right', className: 'mono', cell: (row) => <>{amount(row.margin)}{row.margin_percent && <small className="block">{row.margin_percent}%</small>}</> },
    {
      header: 'Selisih anggaran',
      align: 'right',
      className: 'mono',
      cell: (row) => <span className={row.cost_variance.startsWith('-') ? 'text-orange-700' : undefined}>{amount(row.cost_variance)}</span>,
    },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="JOB COSTING"
        title="Proyek"
        description="Tandai pendapatan dan biaya dengan proyek, lalu baca laba per proyek beserta selisih terhadap anggaran."
        action={<AddButton onClick={() => { setEditor({ project: null }); setFormError(null) }}>Proyek baru</AddButton>}
      />
      <DataEntryGuide
        steps={[
          'Klik “Proyek baru”, isi kode proyek yang unik dan nama proyek.',
          'Tentukan periode, status, nilai kontrak, anggaran biaya, serta pelanggan jika ada.',
          'Setelah tersimpan, pilih proyek tersebut pada dokumen penjualan atau pembelian.',
          'Gunakan menu aksi (titik tiga) pada baris tabel untuk mengubah data proyek, termasuk statusnya.',
        ]}
        note="Proyek tidak dihapus permanen; ubah statusnya menjadi COMPLETED atau CANCELLED agar tidak lagi dipakai transaksi baru."
      />

      <div className="panel form-panel">
        <div className="security-heading">
          <div><h2>Periode laporan</h2><p>Pendapatan dan biaya masuk ke proyek ketika jurnal atau dokumen diberi proyek.</p></div>
          <div className="date-filter">
            <label>Dari<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label>Sampai<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
        </div>
        {report && (
          <div className="stat-strip !mb-0">
            <div><span>Pendapatan</span><strong className="mono">{amount(report.total_revenue)}</strong></div>
            <div><span>Biaya</span><strong className="mono">{amount(report.total_cost)}</strong></div>
            <div><span>Margin</span><strong className="mono">{amount(report.total_margin)}{report.total_margin_percent && ` · ${report.total_margin_percent}%`}</strong></div>
          </div>
        )}
      </div>

      <TablePanel
        title="Laba per proyek"
        description="Angka berasal dari jurnal yang telah diposting pada periode terpilih."
        badge={`${projects.length} proyek`}
        badgeTone="info"
        action={<AddButton onClick={() => { setEditor({ project: null }); setFormError(null) }}>Proyek baru</AddButton>}
      >
        <DataTable
          columns={columns}
          rows={report?.rows ?? []}
          keyOf={(row) => row.project_id}
          loading={loading}
          emptyIcon="project"
          empty="Belum ada proyek. Buat proyek untuk mulai menandai pendapatan dan biaya."
          rowActions={[
            {
              label: 'Ubah proyek',
              icon: 'edit',
              onSelect: (row) => { const project = projectOf(row.project_id); if (project) { setEditor({ project }); setFormError(null) } },
              disabled: (row) => !projectOf(row.project_id) && 'Detail proyek belum termuat',
            },
          ]}
          footer={report && (
            <tfoot><tr>
              <th colSpan={4}>Total</th>
              <th className="number">{amount(report.total_revenue)}</th>
              <th className="number">{amount(report.total_cost)}</th>
              <th className="number">{amount(report.total_margin)}</th>
              <th colSpan={2} />
            </tr></tfoot>
          )}
        />
      </TablePanel>

      <FormModal
        open={editor !== null}
        formKey={editing?.id ?? 'new-project'}
        eyebrow={editing ? 'UBAH PROYEK' : 'PROYEK BARU'}
        title={editing ? `Ubah proyek ${editing.code}` : 'Proyek baru'}
        description="Kode proyek dipakai sebagai identitas pada dokumen dan tidak dapat diubah setelah dibuat."
        submitLabel={editing ? 'Simpan perubahan' : 'Buat proyek'}
        busy={saving}
        error={formError}
        onClose={() => setEditor(null)}
        onSubmit={submit}
      >
        <div className="form-row">
          <label>Kode<input name="code" defaultValue={editing?.code} readOnly={Boolean(editing)} required /></label>
          <label>Nama<input name="name" defaultValue={editing?.name} required /></label>
        </div>
        <div className="form-row">
          <label>Mulai<input type="date" name="start_date" defaultValue={editing?.start_date ?? ''} /></label>
          <label>Selesai<input type="date" name="end_date" defaultValue={editing?.end_date ?? ''} /></label>
          <label>Status<select name="status" defaultValue={editing?.status ?? 'ACTIVE'}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label>Nilai kontrak<input name="contract_value" inputMode="numeric" defaultValue={editing?.contract_value_minor ?? 0} /></label>
          <label>Anggaran biaya<input name="budget_cost" inputMode="numeric" defaultValue={editing?.budget_cost_minor ?? 0} /></label>
        </div>
        <label>Pelanggan
          <select name="contact_id" defaultValue={editing?.contact_id ?? ''}>
            <option value="">Tanpa pelanggan</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
          </select>
        </label>
        <label>Catatan<input name="notes" defaultValue={editing?.notes ?? ''} /></label>
        <p className="modal-note">Selisih anggaran positif berarti biaya masih di bawah anggaran. Ubah status menjadi COMPLETED atau CANCELLED untuk menutup proyek.</p>
      </FormModal>
    </section>
  )
}
