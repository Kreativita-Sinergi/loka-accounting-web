import { type FormEvent, useState } from 'react'
import { downloadImportTemplate, IMPORT_KINDS, uploadImport, type ImportKind } from '../api/imports'
import type { ImportResult } from '../types/reports'
import { Badge, Button, DataEntryGuide, PageHeader } from '../components/ui'

const descriptions: Record<ImportKind, { label: string; help: string }> = {
  units: { label: 'Satuan', help: 'Kolom: code, name, precision. Impor satuan lebih dulu karena barang merujuk kodenya.' },
  warehouses: { label: 'Gudang', help: 'Kolom: code, name, address.' },
  contacts: { label: 'Pelanggan & pemasok', help: 'Kolom: type (CUSTOMER/SUPPLIER/BOTH/OTHER), name, email, phone, tax_identifier, external_reference.' },
  items: { label: 'Barang & jasa', help: 'Kolom: sku, name, item_type, base_unit_code, costing_method, dan kode akun penjualan/pembelian/persediaan/HPP.' },
  'opening-balances': { label: 'Saldo awal', help: 'Kolom: account_code, debit, credit, description. Seluruh baris diposting sebagai satu jurnal dan harus seimbang.' },
}

export function ImportPage({ onNotice }: { onNotice: (message: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [kind, setKind] = useState<ImportKind>('contacts')
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const file = new FormData(form).get('file')
    if (!(file instanceof File) || file.size === 0) {
      setError('Pilih berkas CSV terlebih dahulu.')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const outcome = await uploadImport(kind, file, kind === 'opening-balances' ? effectiveDate : undefined)
      setResult(outcome)
      form.reset()
      onNotice(`${outcome.imported} baris berhasil diimpor.`)
    } catch (caught) {
      setError(detailOf(caught, 'Impor gagal.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <PageHeader eyebrow="MIGRASI DATA" title="Impor data" description="Unduh template, isi di spreadsheet, lalu unggah. Satu baris bermasalah membatalkan seluruh berkas sehingga data tidak pernah masuk sebagian." />
      <DataEntryGuide title="Cara mengimpor data" steps={['Pilih jenis data yang akan diimpor.', 'Klik “Unduh template”, lalu isi kolom tanpa mengubah nama header.', 'Simpan sebagai CSV, kembali ke halaman ini, pilih berkas dan tanggal efektif bila diminta.', 'Klik “Impor sekarang” dan periksa ringkasan hasil serta pesan kesalahan.']} note="Impor satuan sebelum produk, dan master data sebelum transaksi yang merujuknya." />

      <div className="tabs">
        {IMPORT_KINDS.map((candidate) => (
          <button key={candidate} className={kind === candidate ? 'active' : ''} onClick={() => { setKind(candidate); setResult(null); setError(null) }}>
            {descriptions[candidate].label}
          </button>
        ))}
      </div>

      <div className="split-grid">
        <form className="panel form-panel" onSubmit={(event) => void submit(event)}>
          <h2>Unggah {descriptions[kind].label.toLowerCase()}</h2>
          <div className="callout"><strong>Format</strong><span>{descriptions[kind].help}</span></div>
          <label>Berkas CSV<input type="file" name="file" accept=".csv,text/csv" required /></label>
          {kind === 'opening-balances' && (
            <label>Tanggal jurnal saldo awal<input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} required /></label>
          )}
          <div className="flex gap-2">
            <Button disabled={busy}>{busy ? 'Mengunggah…' : 'Impor sekarang'}</Button>
            <Button type="button" variant="secondary" icon="download" onClick={() => void downloadImportTemplate(kind)}>Unduh template</Button>
          </div>
        </form>

        <div className="panel form-panel">
          <h2>Hasil</h2>
          {error && <p className="balance-error">{error}</p>}
          {result && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Badge tone="success">{result.imported} baris</Badge>
                <span className="text-[11px] text-slate-500">{descriptions[result.kind as ImportKind]?.label ?? result.kind}</span>
              </div>
              {result.warnings.map((warning) => <p key={warning} className="text-[11px] text-slate-500">{warning}</p>)}
            </>
          )}
          {!error && !result && <p className="text-[11px] text-slate-500">Belum ada impor pada sesi ini. Pesan kesalahan menyebut nomor baris di berkas asli agar mudah diperbaiki.</p>}
          <div className="callout mt-4"><strong>Urutan</strong><span>Satuan → gudang → daftar akun → barang → kontak → saldo awal. Barang merujuk kode satuan dan kode akun, jadi keduanya harus ada lebih dulu.</span></div>
        </div>
      </div>
    </section>
  )
}

function detailOf(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { error?: { details?: string }; message?: string } } }).response
  return response?.data?.error?.details ?? response?.data?.message ?? fallback
}
