import { type FormEvent, useEffect, useState } from 'react'
import { AxiosError } from 'axios'
import { createBranch, getCompanyProfile, listBranches, saveCompanyProfile } from '../api/operations'
import { Badge, Button, EmptyState, PageHeader } from '../components/ui'
import type { PageKey } from '../components/Layout'
import type { CompanyProfile, OrganizationBranch } from '../types/operations'

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const optional = (form: FormData, key: string) => text(form, key) || null

export function CompanyPage({ onNotice, onNavigate, onOrganizationRenamed }: { onNotice: (value: string) => void; onNavigate: (page: PageKey) => void; onOrganizationRenamed: (name: string) => void }) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [branches, setBranches] = useState<OrganizationBranch[]>([])
  async function refresh() { const [company, branchRows] = await Promise.all([getCompanyProfile(), listBranches()]); setProfile(company); setBranches(branchRows) }
  useEffect(() => { void refresh().catch((error) => onNotice(message(error))) }, [])
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    try {
      const value = await saveCompanyProfile({ name: text(f, 'name'), legal_name: optional(f, 'legal_name'), business_category: optional(f, 'business_category'), business_field: optional(f, 'business_field'), phone: optional(f, 'phone'), email: optional(f, 'email'), data_start_date: optional(f, 'data_start_date'), address_line: optional(f, 'address_line'), city: optional(f, 'city'), province: optional(f, 'province'), postal_code: optional(f, 'postal_code'), country_code: text(f, 'country_code') || 'ID' })
      setProfile(value); onOrganizationRenamed(value.name); onNotice('Profil organisasi diperbarui. Nama ini adalah nama perusahaan, terpisah dari nama pengguna.')
    } catch (error) { onNotice(message(error)) }
  }
  async function addBranch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    try { await createBranch({ code: text(f, 'code'), name: text(f, 'name'), phone: optional(f, 'phone'), address_line: optional(f, 'address_line'), city: optional(f, 'city'), province: optional(f, 'province'), postal_code: optional(f, 'postal_code'), country_code: 'ID', is_headquarters: f.get('is_headquarters') === 'on' }); e.currentTarget.reset(); await refresh(); onNotice('Cabang berhasil ditambahkan.') } catch (error) { onNotice(message(error)) }
  }
  return <section><PageHeader eyebrow="PERUSAHAAN" title="Identitas organisasi dan cabang" description="Nama pengguna tetap milik orang yang masuk. Nama organisasi, identitas legal, bidang usaha, alamat, dan cabang dikelola terpisah di sini." action={<Button variant="secondary" onClick={() => onNavigate('controls')}>Pengguna & akses</Button>} />
    <div className="company-tabs"><button className="active">Info perusahaan</button><button onClick={() => onNavigate('controls')}>Akses grup & pengguna</button><button onClick={() => onNavigate('controls')}>Penomoran</button><button onClick={() => onNavigate('controls')}>API & integrasi</button></div>
    <div className="split-grid"><form className="panel form-panel" onSubmit={(e) => void save(e)} key={profile?.id ?? 'loading'}><div className="section-title"><div><span className="section-icon">CO</span><h2>Info perusahaan</h2></div><Badge tone={profile ? 'success' : 'warning'}>{profile ? 'Tersimpan' : 'Memuat'}</Badge></div>
      <label>Nama organisasi<input name="name" required defaultValue={profile?.name} placeholder="PT / CV / nama usaha" /></label><label>Nama legal<input name="legal_name" defaultValue={profile?.legal_name ?? ''} /></label>
      <div className="form-row"><label>Kategori usaha<select name="business_category" defaultValue={profile?.business_category ?? ''}><option value="">Pilih kategori</option><option>SERVICE</option><option>RETAILER</option><option>DISTRIBUTOR</option><option>MANUFACTURER</option><option>NON_PROFIT</option><option>OTHER</option></select></label><label>Bidang usaha<input name="business_field" defaultValue={profile?.business_field ?? ''} placeholder="Contoh: Kuliner, Konsultan" /></label></div>
      <div className="form-row"><label>Telepon<input name="phone" defaultValue={profile?.phone ?? ''} /></label><label>Email perusahaan<input name="email" type="email" defaultValue={profile?.email ?? ''} /></label></div>
      <div className="form-row"><label>Tanggal mulai data<input name="data_start_date" type="date" defaultValue={profile?.data_start_date?.slice(0, 10) ?? ''} /></label><label>Negara<select name="country_code" defaultValue={profile?.country_code ?? 'ID'}><option value="ID">Indonesia</option><option value="SG">Singapore</option><option value="MY">Malaysia</option></select></label></div>
      <label>Alamat<input name="address_line" defaultValue={profile?.address_line ?? ''} /></label><div className="form-row"><label>Kota<input name="city" defaultValue={profile?.city ?? ''} /></label><label>Provinsi<input name="province" defaultValue={profile?.province ?? ''} /></label><label>Kode pos<input name="postal_code" defaultValue={profile?.postal_code ?? ''} /></label></div><Button>Simpan profil</Button></form>
      <form className="panel form-panel" onSubmit={(e) => void addBranch(e)}><div className="section-title"><div><span className="section-icon">BR</span><h2>Tambah cabang</h2></div><Badge>{branches.length} cabang</Badge></div><div className="form-row"><label>Kode<input name="code" required placeholder="JKT" /></label><label>Nama cabang<input name="name" required /></label></div><label>Telepon<input name="phone" /></label><label>Alamat<input name="address_line" /></label><div className="form-row"><label>Kota<input name="city" /></label><label>Provinsi<input name="province" /></label><label>Kode pos<input name="postal_code" /></label></div><label className="check-row"><input type="checkbox" name="is_headquarters" />Kantor pusat</label><Button>Tambah cabang</Button></form></div>
    <div className="panel data-panel"><div className="panel-heading"><div><h2>Daftar cabang</h2><p>Cabang dapat dipakai sebagai batas akses pengguna dan dimensi pelaporan.</p></div><Badge tone="info">{branches.filter((b) => b.is_active).length} aktif</Badge></div>{branches.length === 0 ? <EmptyState>Belum ada cabang. Organisasi tetap dapat dipakai tanpa cabang.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Nama</th><th>Lokasi</th><th>Status</th></tr></thead><tbody>{branches.map((branch) => <tr key={branch.id}><td className="mono">{branch.code}</td><td><strong>{branch.name}</strong>{branch.is_headquarters && <small className="block">Kantor pusat</small>}</td><td>{[branch.city, branch.province].filter(Boolean).join(', ') || '—'}</td><td><Badge tone={branch.is_active ? 'success' : 'neutral'}>{branch.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td></tr>)}</tbody></table></div>}</div>
  </section>
}

function message(error: unknown) { return error instanceof AxiosError ? String(error.response?.data?.error?.details ?? error.message) : 'Permintaan gagal.' }
