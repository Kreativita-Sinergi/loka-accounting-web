import { useEffect, useMemo, useState } from 'react'
import { listAccessRules, listMembers, listRoles, saveAccessRule } from '../api/operations'
import { Badge, Button, PageHeader } from '../components/ui'
import { messageOf } from '../components/Modal'
import { allTiles } from '../lib/menu'
import type { AccessRule, OrganizationMember, OrganizationRole } from '../types/operations'

const actions = [
  { key: 'can_create', label: 'Tambah' },
  { key: 'can_read', label: 'Baca' },
  { key: 'can_update', label: 'Edit' },
  { key: 'can_delete', label: 'Hapus' },
] as const

const resources = Array.from(new Set([...allTiles.flatMap((tile) => [tile.view, tile.write]),
  'accounting.approvals.decide', 'accounting.expenses.manage',
  'accounting.purchases.manage', 'accounting.tax.manage']
  .filter((permission) => permission.startsWith('accounting.'))
  .map((permission) => permission.split('.')[1]).filter((resource) => resource !== 'audit')))
  .sort((left, right) => left.localeCompare(right))
const resourceLabels: Record<string, string> = {
  approvals: 'Persetujuan', assets: 'Aset tetap', bank: 'Kas & bank',
  budgets: 'Anggaran', coa: 'Akun perkiraan', contacts: 'Kontak', dimensions: 'Proyek & dimensi',
  documents: 'Dokumen', expenses: 'Biaya', fx: 'Mata uang', inventory: 'Persediaan', journal: 'Jurnal',
  localization: 'Pajak', manufacturing: 'Manufaktur', payables: 'Utang', payroll: 'Penggajian',
  period: 'Tutup buku', purchases: 'Pembelian', receivables: 'Piutang', reports: 'Laporan', settings: 'Pengaturan', tax: 'Pajak',
}

function defaultRule(subjectType: AccessRule['subject_type'], subjectId: string, resource: string): AccessRule {
  return { subject_type: subjectType, subject_id: subjectId, resource, can_create: true, can_read: true, can_update: true, can_delete: true }
}

export function AccessPage() {
  const [roles, setRoles] = useState<OrganizationRole[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [rules, setRules] = useState<AccessRule[]>([])
  const [subjectType, setSubjectType] = useState<AccessRule['subject_type']>('ROLE')
  const [subjectId, setSubjectId] = useState('')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listRoles(), listMembers(), listAccessRules()])
      .then(([roleList, memberList, ruleList]) => {
        if (!active) return
        setRoles(roleList ?? []); setMembers(memberList ?? []); setRules(ruleList ?? [])
        setSubjectId(roleList?.[0]?.code ?? '')
      })
      .catch((caught) => { if (active) setError(messageOf(caught, 'Akses gagal dimuat.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const choices = useMemo(() => subjectType === 'ROLE'
    ? roles.map((role) => ({ id: role.code, label: role.label }))
    : members.map((member) => ({ id: member.user_id, label: `${member.full_name || member.email} (${member.email})` })),
  [subjectType, roles, members])

  function findRule(type: AccessRule['subject_type'], id: string, resource: string) {
    return rules.find((rule) => rule.subject_type === type && rule.subject_id === id && rule.resource === resource)
  }

  function effectiveRule(resource: string) {
    const own = findRule(subjectType, subjectId, resource)
    if (own) return own
    if (subjectType === 'USER') {
      const role = members.find((member) => member.user_id === subjectId)?.role_code
      if (role) return findRule('ROLE', role, resource) ?? defaultRule('ROLE', role, resource)
    }
    return defaultRule(subjectType, subjectId, resource)
  }

  async function change(resource: string, key: typeof actions[number]['key'], value: boolean) {
    const source = effectiveRule(resource)
    const next: AccessRule = { ...source, subject_type: subjectType, subject_id: subjectId, resource, [key]: value }
    const previous = rules
    setRules((current) => [...current.filter((rule) => !(rule.subject_type === subjectType && rule.subject_id === subjectId && rule.resource === resource)), next])
    setBusy(resource)
    setError('')
    try {
      const saved = await saveAccessRule(next)
      setRules((current) => [...current.filter((rule) => !(rule.subject_type === saved.subject_type && rule.subject_id === saved.subject_id && rule.resource === resource)), saved])
      window.dispatchEvent(new Event('loka:access-changed'))
    } catch (caught) {
      setRules(previous)
      setError(messageOf(caught, 'Perubahan akses gagal disimpan.'))
    } finally { setBusy('') }
  }

  return <section>
    <PageHeader eyebrow="OWNER" title="Akses CRUD" description="Atur hak tambah, baca, edit, dan hapus untuk setiap peran atau akun. Semua akses aktif secara bawaan. Aturan akun menggantikan aturan perannya." />
    <div className="panel form-panel mb-4 flex flex-wrap items-end gap-3">
      <label>Atur untuk
        <select value={subjectType} onChange={(event) => {
          const type = event.target.value as AccessRule['subject_type']
          setSubjectType(type); setSubjectId(type === 'ROLE' ? roles[0]?.code ?? '' : members[0]?.user_id ?? '')
        }}><option value="ROLE">Peran</option><option value="USER">Akun</option></select>
      </label>
      <label>{subjectType === 'ROLE' ? 'Peran' : 'Akun'}
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
          {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
        </select>
      </label>
      <Badge tone="info">Perubahan tersimpan otomatis</Badge>
    </div>
    {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
    <div className="panel overflow-x-auto">
      <table className="w-full">
        <thead><tr><th>Modul</th>{actions.map((action) => <th key={action.key} className="text-center">{action.label}</th>)}<th>Sumber</th></tr></thead>
        <tbody>{resources.map((resource) => {
          const rule = effectiveRule(resource)
          const own = findRule(subjectType, subjectId, resource)
          return <tr key={resource}>
            <td><strong>{resourceLabels[resource] ?? resource}</strong><small className="block mono">{resource}</small></td>
            {actions.map((action) => <td key={action.key} className="text-center">
              <input type="checkbox" aria-label={`${action.label} ${resourceLabels[resource] ?? resource}`} checked={rule[action.key]} disabled={!subjectId || busy === resource} onChange={(event) => void change(resource, action.key, event.target.checked)} />
            </td>)}
            <td><small>{own ? 'Khusus ' + (subjectType === 'ROLE' ? 'peran' : 'akun') : subjectType === 'USER' ? 'Mengikuti peran' : 'Bawaan aktif'}</small></td>
          </tr>
        })}</tbody>
      </table>
      {loading && <p className="p-4">Memuat aturan akses…</p>}
    </div>
    <div className="mt-3"><Button variant="secondary" onClick={() => void listAccessRules().then(setRules).catch((caught) => setError(messageOf(caught)))}>Muat ulang</Button></div>
  </section>
}
