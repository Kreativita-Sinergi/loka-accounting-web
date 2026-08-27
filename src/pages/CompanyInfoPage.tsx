import { useEffect, useState, type FormEvent } from 'react'
import { getLocalization, saveLocalization } from '../api/accounting'
import type { IdentityProfile } from '../api/auth'
import { getCompanyProfile, saveCompanyProfile } from '../api/operations'
import { Badge, Button, PageHeader } from '../components/ui'
import { messageOf } from '../components/Modal'
import type { LocalizationProfile } from '../types/accounting'
import type { OrganizationProfile } from '../types/operations'

const emptyLocalization = (businessId: string): LocalizationProfile => ({
  business_id: businessId,
  country_code: 'ID',
  legal_name: '',
  tax_identifier: null,
  is_vat_registered: false,
  vat_registration_number: null,
  statutory_timezone: 'Asia/Jakarta',
})

export function CompanyInfoPage({ profile, onNotice }: { profile: IdentityProfile; onNotice: (value: string) => void }) {
  const [company, setCompany] = useState<OrganizationProfile | null>(null)
  const [localization, setLocalization] = useState<LocalizationProfile>(() => emptyLocalization(profile.organization_id))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.allSettled([getCompanyProfile(), getLocalization()]).then(([companyResult, localizationResult]) => {
      if (!active) return
      if (companyResult.status === 'fulfilled') setCompany(companyResult.value)
      if (localizationResult.status === 'fulfilled') setLocalization(localizationResult.value)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!company) return
    const values = new FormData(event.currentTarget)
    const optional = (name: string) => String(values.get(name) ?? '').trim() || null
    setSaving(true)
    setError(null)
    try {
      const [savedCompany, savedLocalization] = await Promise.all([
        saveCompanyProfile({
          name: String(values.get('name')).trim(),
          legal_name: optional('legal_name'),
          business_category: optional('business_category'),
          business_field: optional('business_field'),
          phone: optional('phone'),
          email: optional('email'),
          address_line: optional('address_line'),
          city: optional('city'),
          province: optional('province'),
          postal_code: optional('postal_code'),
          data_start_date: optional('data_start_date'),
          country_code: 'ID',
        }),
        saveLocalization({
          country_code: 'ID',
          legal_name: String(values.get('legal_name')).trim(),
          tax_identifier: optional('tax_identifier'),
          is_vat_registered: values.get('is_vat_registered') === 'on',
          vat_registration_number: optional('vat_registration_number'),
          statutory_timezone: localization.statutory_timezone || 'Asia/Jakarta',
        }),
      ])
      setCompany(savedCompany)
      setLocalization(savedLocalization)
      window.dispatchEvent(new Event('loka:company-changed'))
      onNotice('Informasi perusahaan berhasil diperbarui.')
    } catch (caught) {
      setError(messageOf(caught, 'Informasi perusahaan gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <PageHeader eyebrow="PROFIL PT" title="Informasi perusahaan" description="Identitas legal, kontak, alamat, dan status pajak yang tampil pada dashboard pemilik." action={<Badge tone={company ? 'success' : 'warning'}>{company ? 'Data tersambung' : 'Memuat data'}</Badge>} />
      {loading && <div className="loading" role="status">Memuat informasi perusahaan…</div>}
      {!loading && company && (
        <form className="company-profile-form" onSubmit={(event) => void submit(event)}>
          <div className="panel company-form-section">
            <header><p className="eyebrow">IDENTITAS PERUSAHAAN</p><h2>Nama dan bidang usaha</h2><span>Dipakai pada dashboard, laporan, dan dokumen resmi.</span></header>
            <div className="form-row">
              <label>Nama perusahaan<input name="name" defaultValue={company.name} required /></label>
              <label>Nama legal PT<input name="legal_name" defaultValue={company.legal_name ?? localization.legal_name} placeholder="PT Contoh Indonesia" required /></label>
            </div>
            <div className="form-row">
              <label>Kategori usaha<select name="business_category" defaultValue={company.business_category ?? ''}><option value="">Pilih kategori</option><option value="SERVICE">Jasa</option><option value="RETAIL">Ritel</option><option value="DISTRIBUTION">Distribusi</option><option value="MANUFACTURING">Manufaktur</option><option value="OTHER">Lainnya</option></select></label>
              <label>Bidang usaha<input name="business_field" defaultValue={company.business_field ?? ''} placeholder="Contoh: Teknologi informasi" /></label>
            </div>
            <label>Tanggal mulai data<input type="date" name="data_start_date" defaultValue={company.data_start_date?.slice(0, 10) ?? ''} /></label>
          </div>

          <div className="panel company-form-section">
            <header><p className="eyebrow">LEGAL & PAJAK</p><h2>Identitas perpajakan</h2><span>Status ini membantu kesiapan pelaporan pajak perusahaan.</span></header>
            <div className="form-row">
              <label>NPWP perusahaan<input name="tax_identifier" defaultValue={localization.tax_identifier ?? ''} /></label>
              <label>Nomor pengukuhan PKP<input name="vat_registration_number" defaultValue={localization.vat_registration_number ?? ''} /></label>
            </div>
            <label className="check-row"><input type="checkbox" name="is_vat_registered" defaultChecked={localization.is_vat_registered} />Perusahaan terdaftar sebagai Pengusaha Kena Pajak (PKP)</label>
          </div>

          <div className="panel company-form-section">
            <header><p className="eyebrow">KONTAK & DOMISILI</p><h2>Informasi kantor</h2><span>Kontak utama dan alamat domisili perusahaan.</span></header>
            <div className="form-row"><label>Email perusahaan<input type="email" name="email" defaultValue={company.email ?? ''} /></label><label>Nomor telepon<input name="phone" defaultValue={company.phone ?? ''} /></label></div>
            <label>Alamat kantor<textarea name="address_line" defaultValue={company.address_line ?? ''} rows={3} /></label>
            <div className="form-row"><label>Kota/Kabupaten<input name="city" defaultValue={company.city ?? ''} /></label><label>Provinsi<input name="province" defaultValue={company.province ?? ''} /></label><label>Kode pos<input name="postal_code" defaultValue={company.postal_code ?? ''} /></label></div>
          </div>

          {error && <p className="modal-error" role="alert">{error}</p>}
          <div className="company-form-actions"><Button disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan informasi perusahaan'}</Button></div>
        </form>
      )}
    </section>
  )
}
