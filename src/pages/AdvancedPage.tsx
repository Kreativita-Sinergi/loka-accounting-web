import { useEffect, useState } from 'react'
import {
  createBankAccount, createDimension, deleteBankAccount, deleteDimension, downloadExport,
  listBankAccounts, listDimensions, listMappings, setBankAccountActive, setDimensionActive,
  updateBankAccount, updateDimension, type Dimension,
} from '../api/accounting'
import type { Account, AccountMapping, BankAccount } from '../types/accounting'
import { Button, DataEntryGuide, PageHeader } from '../components/ui'
import { AddButton, DataTable, StatusPill, TablePanel, type Column } from '../components/DataTable'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'

export function AdvancedPage({ accounts, onNotice }: { accounts: Account[]; onNotice: (value: string) => void }) {
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [mappings, setMappings] = useState<AccountMapping[]>([])
  const [loading, setLoading] = useState(true)

  const [bankEditor, setBankEditor] = useState<{ bank: BankAccount | null } | null>(null)
  const [dimensionEditor, setDimensionEditor] = useState<{ dimension: Dimension | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const bankStatus = useConfirm<BankAccount>()
  const bankRemoval = useConfirm<BankAccount>()
  const dimensionStatus = useConfirm<Dimension>()
  const dimensionRemoval = useConfirm<Dimension>()

  async function refresh() {
    const [bankRows, dimensionRows, mappingRows] = await Promise.all([listBankAccounts(), listDimensions(), listMappings()])
    setBanks(bankRows); setDimensions(dimensionRows ?? []); setMappings(mappingRows)
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])

  /** save funnels every modal submit through one busy, error, and refresh path. */
  async function save(action: () => Promise<unknown>, success: string, done: () => void) {
    setSaving(true)
    setFormError(null)
    try {
      await action()
      await refresh()
      done()
      onNotice(success)
    } catch (error) {
      setFormError(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  const cashAccounts = accounts.filter((account) => account.type === 'ASSET')
  const editingBank = bankEditor?.bank ?? null
  const editingDimension = dimensionEditor?.dimension ?? null
  const accountLabel = (id: string) => { const account = accounts.find((candidate) => candidate.id === id); return account ? `${account.code} · ${account.name}` : id.slice(0, 8) }

  const bankColumns: Array<Column<BankAccount>> = [
    { header: 'Rekening', cell: (bank) => <><strong>{bank.name}</strong><small className="block">{bank.bank_name ?? 'Bank belum diisi'}</small></> },
    { header: 'Nomor', className: 'mono', cell: (bank) => bank.account_number ?? '—' },
    { header: 'Akun COA', className: 'mono', cell: (bank) => accountLabel(bank.account_id) },
    { header: 'Mata uang', cell: (bank) => bank.currency_code },
    { header: 'Status', cell: (bank) => <StatusPill active={bank.is_active} /> },
  ]

  const dimensionColumns: Array<Column<Dimension>> = [
    { header: 'Kode', className: 'mono', width: '130px', cell: (dimension) => dimension.code },
    { header: 'Nama', cell: (dimension) => <strong>{dimension.name}</strong> },
    { header: 'Status', cell: (dimension) => <StatusPill active={dimension.is_active} /> },
  ]

  const mappingColumns: Array<Column<AccountMapping>> = [
    { header: 'Sumber', cell: (mapping) => mapping.source_system },
    { header: 'Mapping', className: 'mono', cell: (mapping) => mapping.mapping_key },
    { header: 'Akun', className: 'mono', cell: (mapping) => accountLabel(mapping.account_id) },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="ADVANCED & DATA"
        title="Kas, dimensi, dan portabilitas data"
        description="Bank register, mapping sumber, dimensi analitik, serta ekspor data accountant."
        action={<div className="page-actions">
          <Button variant="secondary" icon="download" onClick={() => void downloadExport('accounts')}>Export COA</Button>
          <AddButton onClick={() => { setBankEditor({ bank: null }); setFormError(null) }} disabled={cashAccounts.length === 0} title={cashAccounts.length === 0 ? 'Buat akun COA bertipe aset lebih dulu' : undefined}>Rekening bank</AddButton>
        </div>}
      />
      <DataEntryGuide
        steps={[
          'Klik “Rekening bank”, isi nama yang mudah dikenali lalu pilih akun COA kas atau bank yang sesuai.',
          'Klik “Dimensi baru” untuk menambah dimensi analitik seperti PROJECT atau DEPARTMENT.',
          'Gunakan menu aksi (titik tiga) pada setiap baris untuk Ubah, Nonaktifkan, Aktifkan, atau Hapus permanen.',
          'Gunakan “Export COA” untuk menyerahkan daftar akun ke akuntan dalam format CSV.',
        ]}
        note="Buat akun COA bertipe aset lebih dahulu jika pilihan akun bank belum tersedia. Akun COA rekening bank tidak dapat diubah setelah rekening dibuat."
      />

      <TablePanel
        title="Bank register"
        description="Akun kas dan bank operasional."
        badge={`${banks.length} rekening`}
        badgeTone="info"
        className="!mt-0"
        action={<AddButton onClick={() => { setBankEditor({ bank: null }); setFormError(null) }} disabled={cashAccounts.length === 0}>Rekening bank</AddButton>}
      >
        <DataTable
          columns={bankColumns}
          rows={banks}
          keyOf={(bank) => bank.id}
          loading={loading}
          empty="Belum ada akun bank."
          rowActions={[
            { label: 'Ubah', icon: 'edit', onSelect: (bank) => { setBankEditor({ bank }); setFormError(null) } },
            { label: (bank) => bank.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: bankStatus.open },
            { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: bankRemoval.open, disabled: (bank) => bank.is_active && 'Nonaktifkan rekening lebih dulu' },
          ]}
        />
      </TablePanel>

      <div className="split-grid mt-4.5">
        <TablePanel
          title="Dimensi laporan"
          description="Dimensi analitik untuk membelah laporan."
          badge={`${dimensions.length} dimensi`}
          className="!mt-0"
          action={<Button variant="secondary" icon="plus" onClick={() => { setDimensionEditor({ dimension: null }); setFormError(null) }}>Dimensi baru</Button>}
        >
          <DataTable
            columns={dimensionColumns}
            rows={dimensions}
            keyOf={(dimension) => dimension.id}
            loading={loading}
            empty="Belum ada dimensi laporan."
            rowActions={[
              { label: 'Ubah', icon: 'edit', onSelect: (dimension) => { setDimensionEditor({ dimension }); setFormError(null) } },
              { label: (dimension) => dimension.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: dimensionStatus.open },
              { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: dimensionRemoval.open, disabled: (dimension) => dimension.is_active && 'Nonaktifkan dimensi lebih dulu' },
            ]}
          />
        </TablePanel>

        <TablePanel
          title="Mapping sumber"
          description="Aturan akun untuk dokumen terintegrasi."
          badge={`${mappings.length} mapping`}
          className="!mt-0"
        >
          <DataTable columns={mappingColumns} rows={mappings} keyOf={(mapping) => mapping.id} loading={loading} empty="Belum ada mapping sumber." />
        </TablePanel>
      </div>

      {/* ---- Bank account modal ---- */}
      <FormModal
        open={bankEditor !== null}
        formKey={editingBank?.id ?? 'new-bank'}
        size="sm"
        eyebrow="REKENING BANK"
        title={editingBank ? `Ubah rekening ${editingBank.name}` : 'Rekening bank baru'}
        description={editingBank ? 'Akun COA rekening tidak dapat diubah karena sudah menjadi acuan mutasi dan rekonsiliasi.' : 'Rekening ini menjadi bank register untuk impor mutasi dan rekonsiliasi.'}
        submitLabel={editingBank ? 'Simpan perubahan' : 'Tambah rekening'}
        busy={saving}
        error={formError}
        onClose={() => setBankEditor(null)}
        onSubmit={(values) => save(
          () => {
            const input = {
              name: String(values.get('name')),
              bank_name: String(values.get('bank_name') || '') || null,
              account_number: String(values.get('account_number') || '') || null,
            }
            return editingBank ? updateBankAccount(editingBank.id, input) : createBankAccount({ ...input, account_id: String(values.get('account_id')) })
          },
          editingBank ? 'Rekening bank berhasil diperbarui.' : 'Rekening bank berhasil dibuat.',
          () => setBankEditor(null),
        )}
      >
        <label>Nama rekening<input name="name" placeholder="BCA Operasional" defaultValue={editingBank?.name} required /></label>
        <div className="form-row">
          <label>Nama bank<input name="bank_name" placeholder="Bank Central Asia" defaultValue={editingBank?.bank_name ?? ''} /></label>
          <label>Nomor rekening<input name="account_number" inputMode="numeric" defaultValue={editingBank?.account_number ?? ''} /></label>
        </div>
        {!editingBank && (
          <label>Akun COA
            <select name="account_id" required>
              <option value="">Pilih akun</option>
              {cashAccounts.map((account) => <option value={account.id} key={account.id}>{account.code} · {account.name}</option>)}
            </select>
          </label>
        )}
      </FormModal>

      {/* ---- Dimension modal ---- */}
      <FormModal
        open={dimensionEditor !== null}
        formKey={editingDimension?.id ?? 'new-dimension'}
        size="sm"
        eyebrow="DIMENSI"
        title={editingDimension ? `Ubah dimensi ${editingDimension.code}` : 'Dimensi laporan baru'}
        description="Dimensi dipakai untuk menandai baris jurnal agar laporan dapat dibelah per proyek, departemen, atau cabang."
        submitLabel={editingDimension ? 'Simpan perubahan' : 'Tambah dimensi'}
        busy={saving}
        error={formError}
        onClose={() => setDimensionEditor(null)}
        onSubmit={(values) => save(
          () => {
            const input = { code: String(values.get('code')), name: String(values.get('name')) }
            return editingDimension ? updateDimension(editingDimension.id, input) : createDimension(input)
          },
          editingDimension ? 'Dimensi berhasil diperbarui.' : 'Dimensi laporan berhasil dibuat.',
          () => setDimensionEditor(null),
        )}
      >
        <div className="form-row">
          <label>Kode<input name="code" placeholder="PROJECT" defaultValue={editingDimension?.code} required /></label>
          <label>Nama<input name="name" placeholder="Project" defaultValue={editingDimension?.name} required /></label>
        </div>
      </FormModal>

      {/* ---- Confirm dialogs ---- */}
      <ConfirmDialog
        open={bankStatus.target !== null}
        title={bankStatus.target?.is_active ? 'Nonaktifkan rekening?' : 'Aktifkan rekening?'}
        confirmLabel={bankStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={bankStatus.busy}
        error={bankStatus.error}
        onClose={bankStatus.close}
        onConfirm={() => bankStatus.run((bank) => setBankAccountActive(bank.id, !bank.is_active).then(refresh))}
        description={bankStatus.target?.is_active
          ? <>Rekening <strong>{bankStatus.target.name}</strong> tidak akan tersedia untuk impor mutasi dan rekonsiliasi baru. Mutasi lama tetap tersimpan.</>
          : <>Rekening <strong>{bankStatus.target?.name}</strong> kembali dapat dipakai untuk impor mutasi dan rekonsiliasi.</>}
      />
      <ConfirmDialog
        open={bankRemoval.target !== null}
        tone="danger"
        title="Hapus rekening permanen?"
        confirmLabel="Hapus permanen"
        confirmationWord={bankRemoval.target?.name}
        confirmationHint={<>Ketik nama rekening <strong>{bankRemoval.target?.name}</strong> untuk konfirmasi</>}
        busy={bankRemoval.busy}
        error={bankRemoval.error}
        onClose={bankRemoval.close}
        onConfirm={() => bankRemoval.run((bank) => deleteBankAccount(bank.id).then(refresh))}
        description={<>Rekening <strong>{bankRemoval.target?.name}</strong> akan dihapus permanen. Penghapusan ditolak jika rekening masih memiliki mutasi bank atau rekonsiliasi.</>}
      />

      <ConfirmDialog
        open={dimensionStatus.target !== null}
        title={dimensionStatus.target?.is_active ? 'Nonaktifkan dimensi?' : 'Aktifkan dimensi?'}
        confirmLabel={dimensionStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={dimensionStatus.busy}
        error={dimensionStatus.error}
        onClose={dimensionStatus.close}
        onConfirm={() => dimensionStatus.run((dimension) => setDimensionActive(dimension.id, !dimension.is_active).then(refresh))}
        description={dimensionStatus.target?.is_active
          ? <>Dimensi <strong>{dimensionStatus.target.code}</strong> tidak akan tersedia untuk penandaan jurnal baru. Penandaan lama tetap terbaca di laporan.</>
          : <>Dimensi <strong>{dimensionStatus.target?.code}</strong> kembali dapat dipakai menandai jurnal baru.</>}
      />
      <ConfirmDialog
        open={dimensionRemoval.target !== null}
        tone="danger"
        title="Hapus dimensi permanen?"
        confirmLabel="Hapus permanen"
        confirmationWord={dimensionRemoval.target?.code}
        busy={dimensionRemoval.busy}
        error={dimensionRemoval.error}
        onClose={dimensionRemoval.close}
        onConfirm={() => dimensionRemoval.run((dimension) => deleteDimension(dimension.id).then(refresh))}
        description={<>Dimensi <strong>{dimensionRemoval.target?.code} · {dimensionRemoval.target?.name}</strong> akan dihapus permanen. Penghapusan ditolak jika dimensi masih punya nilai dimensi atau menandai baris jurnal.</>}
      />
    </section>
  )
}
