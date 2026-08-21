import { type FormEvent, useEffect, useState } from 'react'
import { createProject, getProjectProfitability, listProjects, updateProject } from '../api/projects'
import { listContacts } from '../api/accounting'
import type { Contact } from '../types/accounting'
import type { Project, ProjectProfitabilityReport } from '../types/reports'
import { Badge, Button, DataEntryGuide, EmptyState, PageHeader } from '../components/ui'
import { amount } from './ReportsPage'

const statuses: Project['status'][] = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

export function ProjectsPage({ onNotice }: { onNotice: (message: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [projects, setProjects] = useState<Project[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [report, setReport] = useState<ProjectProfitabilityReport | null>(null)
  const [startDate, setStartDate] = useState(`${today.slice(0, 4)}-01-01`)
  const [endDate, setEndDate] = useState(today)
  const [editing, setEditing] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  const [reloads, setReloads] = useState(0)
  const refresh = () => setReloads((value) => value + 1)

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
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
    try {
      if (editing) {
        await updateProject(editing.id, input)
        onNotice(`Proyek ${editing.code} diperbarui.`)
      } else {
        await createProject(input)
        onNotice('Proyek berhasil dibuat.')
      }
      form.reset()
      setEditing(null)
      refresh()
    } catch (error) {
      onNotice(detailOf(error, 'Proyek gagal disimpan.'))
    }
  }

  return (
    <section>
      <PageHeader eyebrow="JOB COSTING" title="Proyek" description="Tandai pendapatan dan biaya dengan proyek, lalu baca laba per proyek beserta selisih terhadap anggaran." />
      <DataEntryGuide steps={['Isi kode proyek yang unik dan nama proyek.', 'Tentukan periode, status, nilai kontrak, anggaran biaya, serta pelanggan jika ada.', 'Klik “Buat proyek”. Setelah tersimpan, pilih proyek tersebut pada dokumen penjualan atau pembelian.', 'Atur periode laporan untuk melihat pendapatan, biaya, margin, dan selisih anggaran proyek.']} />

      <div className="split-grid">
        <form className="panel form-panel" onSubmit={(event) => void submit(event)} key={editing?.id ?? 'new'}>
          <h2>{editing ? `Ubah proyek ${editing.code}` : 'Proyek baru'}</h2>
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
          <label>Pelanggan<select name="contact_id" defaultValue={editing?.contact_id ?? ''}>
            <option value="">Tanpa pelanggan</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
          </select></label>
          <label>Catatan<input name="notes" defaultValue={editing?.notes ?? ''} /></label>
          <div className="flex gap-2">
            <Button>{editing ? 'Simpan perubahan' : 'Buat proyek'}</Button>
            {editing && <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Batal</Button>}
          </div>
        </form>

        <div className="panel form-panel">
          <h2>Periode laporan</h2>
          <div className="form-row">
            <label>Dari<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label>Sampai<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
          <div className="callout">
            <strong>Cara kerja</strong>
            <span>Pendapatan dan biaya masuk ke proyek ketika jurnal atau dokumen penjualan dan pembelian diberi proyek. Selisih anggaran positif berarti biaya masih di bawah anggaran.</span>
          </div>
          {report && (
            <div className="stat-strip !mb-0 mt-4">
              <div><span>Pendapatan</span><strong className="mono">{amount(report.total_revenue)}</strong></div>
              <div><span>Biaya</span><strong className="mono">{amount(report.total_cost)}</strong></div>
              <div><span>Margin</span><strong className="mono">{amount(report.total_margin)}{report.total_margin_percent && ` · ${report.total_margin_percent}%`}</strong></div>
            </div>
          )}
        </div>
      </div>

      <div className="panel data-panel">
        <div className="panel-heading">
          <div><h2>Laba per proyek</h2><p>Angka berasal dari jurnal yang telah diposting pada periode terpilih.</p></div>
          <Badge tone="info">{projects.length} proyek</Badge>
        </div>
        {loading ? <div className="loading" role="status">Memuat proyek…</div>
          : !report || report.rows.length === 0 ? <EmptyState>Belum ada proyek. Buat proyek untuk mulai menandai pendapatan dan biaya.</EmptyState>
          : <div className="table-wrap"><table>
              <thead><tr>
                <th>Kode</th><th>Proyek</th><th>Status</th>
                <th className="number">Nilai kontrak</th><th className="number">Pendapatan</th><th className="number">Biaya</th>
                <th className="number">Margin</th><th className="number">Selisih anggaran</th><th />
              </tr></thead>
              <tbody>{report.rows.map((row) => {
                const project = projects.find((candidate) => candidate.id === row.project_id)
                const overBudget = row.cost_variance.startsWith('-')
                return (
                  <tr key={row.project_id}>
                    <td className="mono">{row.code}</td>
                    <td>{row.name}{row.billed_percent && <small className="block text-slate-400">Tertagih {row.billed_percent}%</small>}</td>
                    <td><Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'CANCELLED' ? 'warning' : 'neutral'}>{row.status}</Badge></td>
                    <td className="number mono">{amount(row.contract_value)}</td>
                    <td className="number mono">{amount(row.revenue)}</td>
                    <td className="number mono">{amount(row.cost)}</td>
                    <td className="number mono">{amount(row.margin)}{row.margin_percent && <small className="block text-slate-400">{row.margin_percent}%</small>}</td>
                    <td className={`number mono ${overBudget ? 'text-orange-700' : ''}`}>{amount(row.cost_variance)}</td>
                    <td>{project && <Button variant="ghost" onClick={() => setEditing(project)}>Ubah</Button>}</td>
                  </tr>
                )
              })}</tbody>
              <tfoot><tr>
                <th colSpan={4}>Total</th>
                <th className="number">{amount(report.total_revenue)}</th>
                <th className="number">{amount(report.total_cost)}</th>
                <th className="number">{amount(report.total_margin)}</th>
                <th colSpan={2} />
              </tr></tfoot>
            </table></div>}
      </div>
    </section>
  )
}

function detailOf(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { error?: { details?: string }; message?: string } } }).response
  return response?.data?.error?.details ?? response?.data?.message ?? fallback
}
