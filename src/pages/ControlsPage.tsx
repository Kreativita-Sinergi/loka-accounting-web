import { useEffect, useState } from 'react'
import {
  confirmMFA, createAPIKey, createInvitation, createWebhook, decideApproval, deleteApprovalPolicy,
  deleteSequence, deleteWebhook, getSecurity, listAPIKeys, listApprovalPolicies, listApprovals,
  listInvitations, listMembers, listRoles, listSequences, listWebhooks, revokeAPIKey, saveApprovalPolicy,
  saveSecurity, saveSequence, setMemberActive, setMemberRole, setWebhookActive, setupMFA, updateWebhook,
} from '../api/operations'
import type { IdentityProfile } from '../api/auth'
import { Badge, Button, DataEntryGuide, PageHeader } from '../components/ui'
import { AddButton, DataTable, StatusPill, TablePanel, type Column } from '../components/DataTable'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'
import type { APIKey, Approval, ApprovalPolicy, DocumentSequence, Invitation, OrganizationMember, OrganizationRole, SecuritySettings, Webhook } from '../types/operations'

const documentTypes = ['SALES_QUOTE', 'SALES_ORDER', 'DELIVERY', 'SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_INVOICE', 'PURCHASE_RETURN']

export function ControlsPage({ profile, onNotice }: { profile: IdentityProfile; onNotice: (value: string) => void }) {
  const [security, setSecurity] = useState<SecuritySettings | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [sequences, setSequences] = useState<DocumentSequence[]>([])
  const [keys, setKeys] = useState<APIKey[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([])
  const [roles, setRoles] = useState<OrganizationRole[]>([])
  const [roleEditor, setRoleEditor] = useState<OrganizationMember | null>(null)
  const [loading, setLoading] = useState(true)

  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  const [securityOpen, setSecurityOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [sequenceEditor, setSequenceEditor] = useState<{ sequence: DocumentSequence | null } | null>(null)
  const [policyEditor, setPolicyEditor] = useState<{ policy: ApprovalPolicy | null } | null>(null)
  const [webhookEditor, setWebhookEditor] = useState<{ webhook: Webhook | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const memberStatus = useConfirm<OrganizationMember>()
  const keyRevoke = useConfirm<APIKey>()
  const webhookStatus = useConfirm<Webhook>()
  const webhookRemoval = useConfirm<Webhook>()
  const sequenceRemoval = useConfirm<DocumentSequence>()
  const policyStatus = useConfirm<ApprovalPolicy>()
  const policyRemoval = useConfirm<ApprovalPolicy>()
  const decision = useConfirm<{ approval: Approval; verdict: 'APPROVED' | 'REJECTED' }>()

  async function refresh() {
    const [s, i, m, a, n, k, w, p, r] = await Promise.all([
      getSecurity(), listInvitations(), listMembers(), listApprovals(), listSequences(), listAPIKeys(), listWebhooks(), listApprovalPolicies(), listRoles(),
    ])
    setSecurity(s); setInvitations(i); setMembers(m); setApprovals(a); setSequences(n); setKeys(k); setWebhooks(w); setPolicies(p); setRoles(r)
    setLoading(false)
  }

  /** Label peran diambil dari katalog RBAC backend, bukan ditulis ulang di web. */
  function roleLabel(code: string) {
    return roles.find((role) => role.code === code)?.label ?? code
  }
  useEffect(() => { void refresh() }, [])

  /** save funnels every modal submit through one busy, error, and refresh path. */
  async function save(action: () => Promise<unknown>, success: string | ((result: unknown) => string), done: () => void) {
    setSaving(true)
    setFormError(null)
    try {
      const result = await action()
      await refresh()
      done()
      onNotice(typeof success === 'function' ? success(result) : success)
    } catch (error) {
      setFormError(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  async function prepareMFA() {
    setMfaLoading(true)
    try {
      const value = await setupMFA(profile.email)
      setMfaSecret(value.secret)
      setMfaCode('')
      onNotice('Authenticator siap dihubungkan. Salin kunci lalu masukkan kode 6 digit.')
    } finally { setMfaLoading(false) }
  }

  async function activateMFA() {
    if (!/^\d{6}$/.test(mfaCode)) return
    setMfaLoading(true)
    try {
      const value = await confirmMFA(mfaCode)
      setMfaSecret(''); setMfaCode('')
      onNotice(`MFA aktif. Simpan recovery code berikut: ${value.recovery_codes.join(', ')}`)
    } finally { setMfaLoading(false) }
  }

  const editingSequence = sequenceEditor?.sequence ?? null
  const editingPolicy = policyEditor?.policy ?? null
  const editingWebhook = webhookEditor?.webhook ?? null
  const pendingApprovals = approvals.filter((approval) => approval.status === 'PENDING').length

  const memberColumns: Array<Column<OrganizationMember>> = [
    { header: 'Anggota', sortValue: (member) => member.full_name, cell: (member) => <><strong>{member.full_name}</strong><small className="block">{member.email}</small></> },
    {
      header: 'Peran',
      sortValue: (member) => member.role_code,
      cell: (member) => <span className="flex items-center gap-2">
        <span className="type-tag">{roleLabel(member.role_code)}</span>
        {member.role_code === 'OWNER' && <Badge tone="info">Super admin</Badge>}
      </span>,
    },
    { header: 'Status', sortValue: (member) => member.is_active ? 1 : 0, cell: (member) => <StatusPill active={member.is_active} /> },
  ]

  const roleColumns: Array<Column<OrganizationRole>> = [
    {
      header: 'Peran',
      sortValue: (role) => role.label,
      cell: (role) => <span className="flex items-center gap-2">
        <strong>{role.label}</strong>
        {role.is_super_admin && <Badge tone="info">Super admin</Badge>}
        {role.code === profile.role_code && <Badge tone="success">Peran Anda</Badge>}
      </span>,
    },
    { header: 'Kode', className: 'mono', width: '140px', sortValue: (role) => role.code, cell: (role) => role.code },
    { header: 'Wewenang', cell: (role) => <>
      <p className="m-0">{role.description}</p>
      <small className="block mono">{role.permissions.map((permission) => permission.endsWith('.') ? `${permission}*` : permission).join(' · ')}</small>
    </> },
    { header: 'Anggota', align: 'right', width: '100px', sortValue: (role) => members.filter((member) => member.role_code === role.code).length, cell: (role) => members.filter((member) => member.role_code === role.code).length },
  ]

  const invitationColumns: Array<Column<Invitation>> = [
    { header: 'Email', cell: (invitation) => <strong>{invitation.email}</strong> },
    { header: 'Peran', cell: (invitation) => <span className="type-tag">{invitation.role_code}</span> },
    { header: 'Kedaluwarsa', cell: (invitation) => invitation.expires_at.slice(0, 10) },
    { header: 'Status', cell: (invitation) => <Badge tone={invitation.status === 'PENDING' ? 'warning' : 'success'}>{invitation.status}</Badge> },
  ]

  const approvalColumns: Array<Column<Approval>> = [
    { header: 'Entitas', cell: (approval) => <>{approval.entity_type}<small className="block mono">{approval.entity_id.slice(0, 8)}</small></> },
    { header: 'Nilai', align: 'right', className: 'mono', cell: (approval) => approval.amount_minor.toLocaleString('id-ID') },
    { header: 'Diajukan', cell: (approval) => approval.requested_at.slice(0, 10) },
    { header: 'Status', cell: (approval) => <Badge tone={approval.status === 'APPROVED' ? 'success' : approval.status === 'REJECTED' ? 'neutral' : 'warning'}>{approval.status}</Badge> },
  ]

  const sequenceColumns: Array<Column<DocumentSequence>> = [
    { header: 'Jenis dokumen', cell: (sequence) => <strong>{sequence.document_type}</strong> },
    { header: 'Prefix', className: 'mono', cell: (sequence) => sequence.prefix },
    { header: 'Reset', cell: (sequence) => <span className="type-tag">{sequence.reset_policy}</span> },
    { header: 'Nomor berikut', align: 'right', className: 'mono', cell: (sequence) => String(sequence.next_number).padStart(sequence.padding, '0') },
  ]

  const policyColumns: Array<Column<ApprovalPolicy>> = [
    { header: 'Jenis dokumen', cell: (policy) => <strong>{policy.document_type}</strong> },
    { header: 'Nilai minimum', align: 'right', className: 'mono', cell: (policy) => policy.minimum_amount_minor.toLocaleString('id-ID') },
    { header: 'Diskon min.', align: 'right', className: 'mono', cell: (policy) => `${policy.minimum_discount_basis_points} bp` },
    { header: 'Logika', cell: (policy) => <span className="type-tag">{policy.condition_mode}</span> },
    { header: 'Penyetuju', cell: (policy) => policy.approver_role },
    { header: 'Status', cell: (policy) => <StatusPill active={policy.is_active} /> },
  ]

  const keyColumns: Array<Column<APIKey>> = [
    { header: 'Nama', cell: (key) => <><strong>{key.name}</strong><small className="block mono">{key.key_prefix}…</small></> },
    { header: 'Permissions', cell: (key) => key.permissions.join(', ') },
    { header: 'Dibuat', cell: (key) => key.created_at.slice(0, 10) },
    { header: 'Status', cell: (key) => <StatusPill active={key.is_active} activeLabel="Aktif" inactiveLabel="Dicabut" /> },
  ]

  const webhookColumns: Array<Column<Webhook>> = [
    { header: 'Nama', cell: (webhook) => <><strong>{webhook.name}</strong><small className="block">{webhook.endpoint_url}</small></> },
    { header: 'Event', cell: (webhook) => webhook.subscribed_events.join(', ') },
    { header: 'Status', cell: (webhook) => <StatusPill active={webhook.is_active} /> },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="GOVERNANCE"
        title="Kontrol organisasi dan integrasi"
        description="Kelola keamanan, tim, approval, penomoran, serta integrasi mesin-ke-mesin dalam satu tempat."
        action={<div className="page-actions">
          <Button variant="secondary" icon="settings" onClick={() => { setSecurityOpen(true); setFormError(null) }}>Kebijakan keamanan</Button>
          <AddButton onClick={() => { setInviteOpen(true); setFormError(null) }}>Undang anggota</AddButton>
        </div>}
      />
      <DataEntryGuide
        steps={[
          'Klik “Undang anggota” untuk menambah rekan tim dan pilih peran sesuai akses yang dibutuhkan.',
          'Atur format nomor dokumen dan kebijakan approval sebelum transaksi rutin dimulai.',
          'Gunakan API key untuk integrasi server; salin rahasianya saat ditampilkan karena hanya muncul sekali.',
          'Gunakan menu aksi (titik tiga) pada setiap baris untuk Ubah, Nonaktifkan, Cabut, atau Hapus permanen.',
        ]}
        note="Perubahan keamanan dan integrasi berdampak ke seluruh organisasi; berikan akses minimum yang diperlukan."
      />

      <div className="split-grid">
        <div className="panel form-panel">
          <div className="security-heading">
            <div><h2>Kebijakan keamanan</h2><p>Perlindungan yang berlaku untuk seluruh anggota organisasi.</p></div>
            <Badge tone={security?.require_2fa ? 'success' : 'neutral'}>{security?.require_2fa ? '2FA wajib' : '2FA opsional'}</Badge>
          </div>
          <div className="stat-strip !mb-0">
            <div><span>Ambang approval</span><strong className="mono">{(security?.approval_threshold_minor ?? 0).toLocaleString('id-ID')}</strong></div>
            <div><span>Durasi sesi</span><strong>{security?.session_ttl_minutes ?? 0} menit</strong></div>
            <div><span>2FA</span><strong>{security?.require_2fa ? 'Wajib' : 'Opsional'}</strong></div>
          </div>
          <div className="security-actions"><Button variant="secondary" icon="edit" onClick={() => { setSecurityOpen(true); setFormError(null) }}>Ubah kebijakan</Button></div>
        </div>

        <div className="panel mfa-setup">
          <div className="security-heading">
            <div><span className="step-label">AKUN SAYA</span><h2>Authenticator pribadi</h2><p>Hubungkan Google Authenticator, Microsoft Authenticator, atau aplikasi TOTP lain.</p></div>
            <span className="security-lock">2FA</span>
          </div>
          {!mfaSecret ? (
            <div className="mfa-start">
              <div><strong>Belum dihubungkan dari perangkat ini</strong><p>Siapkan authenticator pribadi Anda sebelum mewajibkan 2FA untuk semua anggota.</p></div>
              <Button type="button" variant="secondary" disabled={mfaLoading} onClick={() => void prepareMFA()}>{mfaLoading ? 'Menyiapkan…' : 'Siapkan authenticator'}</Button>
            </div>
          ) : (
            <div className="mfa-flow">
              <div className="mfa-step"><span>1</span><div>
                <strong>Salin kunci ke authenticator</strong>
                <p className="secret-value">{mfaSecret}</p>
                <button type="button" className="copy-link" onClick={() => void navigator.clipboard.writeText(mfaSecret).then(() => onNotice('Kunci authenticator disalin.'))}>Salin kunci</button>
              </div></div>
              <div className="mfa-step"><span>2</span>
                <label>Masukkan kode 6 digit
                  <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" />
                  <small>Kode berubah setiap 30 detik.</small>
                </label>
              </div>
              <div className="mfa-confirm">
                <Button type="button" disabled={mfaLoading || !/^\d{6}$/.test(mfaCode)} onClick={() => void activateMFA()}>{mfaLoading ? 'Memverifikasi…' : 'Aktifkan 2FA'}</Button>
                <Button type="button" variant="ghost" disabled={mfaLoading} onClick={() => { setMfaSecret(''); setMfaCode('') }}>Batal</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TablePanel
        title="Anggota organisasi"
        description="Akses setiap orang ditentukan oleh perannya."
        badge={`${members.length} anggota`}
        badgeTone="info"
        action={<AddButton onClick={() => { setInviteOpen(true); setFormError(null) }}>Undang anggota</AddButton>}
      >
        <DataTable
          columns={memberColumns}
          rows={members}
          keyOf={(member) => member.user_id}
          loading={loading}
          empty="Belum ada anggota."
          rowActions={[
            {
              label: 'Ubah peran',
              icon: 'compliance',
              onSelect: (member) => { setRoleEditor(member); setFormError(null) },
              disabled: (member) => member.user_id === profile.user_id && 'Peran Anda sendiri tidak dapat diubah',
            },
            {
              label: (member) => member.is_active ? 'Nonaktifkan' : 'Aktifkan',
              icon: 'power',
              onSelect: memberStatus.open,
              disabled: (member) => member.user_id === profile.user_id && 'Anda tidak dapat menonaktifkan akun sendiri',
            },
          ]}
        />
      </TablePanel>

      <TablePanel
        title="Peran & hak akses"
        description="Katalog peran bawaan sistem. Pembuat organisasi otomatis menjadi super admin, dan hanya super admin yang dapat memindahkan anggota antarperan."
        badge={`${roles.length} peran`}
        badgeTone="info"
      >
        <DataTable columns={roleColumns} rows={roles} keyOf={(role) => role.code} loading={loading} empty="Katalog peran belum dapat dimuat." />
      </TablePanel>

      <div className="split-grid mt-4.5">
        <TablePanel title="Undangan" description="Undangan yang belum diterima." badge={`${invitations.length} undangan`} className="!mt-0">
          <DataTable columns={invitationColumns} rows={invitations} keyOf={(invitation) => invitation.id} loading={loading} empty="Belum ada undangan." />
        </TablePanel>

        <TablePanel title="Antrean persetujuan" description="Keputusan sensitif tercatat bersama aktornya." badge={`${pendingApprovals} pending`} badgeTone="warning" className="!mt-0">
          <DataTable
            columns={approvalColumns}
            rows={approvals}
            keyOf={(approval) => approval.id}
            loading={loading}
            empty="Belum ada permintaan approval."
            rowActions={[
              { label: 'Setujui', icon: 'check', onSelect: (approval) => decision.open({ approval, verdict: 'APPROVED' }), when: (approval) => approval.status === 'PENDING' },
              { label: 'Tolak', icon: 'close', danger: true, onSelect: (approval) => decision.open({ approval, verdict: 'REJECTED' }), when: (approval) => approval.status === 'PENDING' },
            ]}
          />
        </TablePanel>
      </div>

      <TablePanel
        title="Penomoran dokumen"
        description="Prefix, jumlah digit, dan kebijakan reset per jenis dokumen."
        badge={`${sequences.length} format`}
        action={<Button variant="secondary" icon="plus" onClick={() => { setSequenceEditor({ sequence: null }); setFormError(null) }}>Format baru</Button>}
      >
        <DataTable
          columns={sequenceColumns}
          rows={sequences}
          keyOf={(sequence) => sequence.id}
          loading={loading}
          empty="Belum ada format penomoran."
          rowActions={[
            { label: 'Ubah', icon: 'edit', onSelect: (sequence) => { setSequenceEditor({ sequence }); setFormError(null) } },
            { label: 'Hapus', icon: 'trash', danger: true, onSelect: sequenceRemoval.open, disabled: (sequence) => sequence.next_number > 1 && 'Penomoran sudah dipakai dokumen' },
          ]}
        />
      </TablePanel>

      <TablePanel
        title="Approval otomatis per dokumen"
        description="Dokumen yang melewati ambang ini masuk antrean persetujuan."
        badge={`${policies.length} kebijakan`}
        action={<Button variant="secondary" icon="plus" onClick={() => { setPolicyEditor({ policy: null }); setFormError(null) }}>Kebijakan baru</Button>}
      >
        <DataTable
          columns={policyColumns}
          rows={policies}
          keyOf={(policy) => policy.id}
          loading={loading}
          empty="Belum ada kebijakan approval."
          rowActions={[
            { label: 'Ubah', icon: 'edit', onSelect: (policy) => { setPolicyEditor({ policy }); setFormError(null) } },
            { label: (policy) => policy.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: policyStatus.open },
            { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: policyRemoval.open, disabled: (policy) => policy.is_active && 'Nonaktifkan kebijakan lebih dulu' },
          ]}
        />
      </TablePanel>

      <div className="split-grid mt-4.5">
        <TablePanel
          title="API key"
          description="Kredensial integrasi server, bukan login pengguna."
          badge={`${keys.filter((key) => key.is_active).length} aktif`}
          className="!mt-0"
          action={<Button variant="secondary" icon="plus" onClick={() => { setKeyOpen(true); setFormError(null) }}>API key</Button>}
        >
          <DataTable
            columns={keyColumns}
            rows={keys}
            keyOf={(key) => key.id}
            loading={loading}
            empty="Belum ada API key."
            rowActions={[{ label: 'Cabut key', icon: 'trash', danger: true, onSelect: keyRevoke.open, when: (key) => key.is_active }]}
          />
        </TablePanel>

        <TablePanel
          title="Webhook"
          description="Endpoint HTTPS yang menerima event organisasi."
          badge={`${webhooks.filter((webhook) => webhook.is_active).length} aktif`}
          className="!mt-0"
          action={<Button variant="secondary" icon="plus" onClick={() => { setWebhookEditor({ webhook: null }); setFormError(null) }}>Webhook</Button>}
        >
          <DataTable
            columns={webhookColumns}
            rows={webhooks}
            keyOf={(webhook) => webhook.id}
            loading={loading}
            empty="Belum ada webhook."
            rowActions={[
              { label: 'Ubah', icon: 'edit', onSelect: (webhook) => { setWebhookEditor({ webhook }); setFormError(null) } },
              { label: (webhook) => webhook.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: webhookStatus.open },
              { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: webhookRemoval.open, disabled: (webhook) => webhook.is_active && 'Nonaktifkan webhook lebih dulu' },
            ]}
          />
        </TablePanel>
      </div>

      {/* ---- Security policy modal ---- */}
      <FormModal
        open={securityOpen}
        formKey={String(security?.require_2fa)}
        size="sm"
        eyebrow="KEAMANAN"
        title="Kebijakan keamanan organisasi"
        description="Berlaku untuk seluruh anggota. Aktifkan 2FA wajib setelah semua anggota menghubungkan authenticator."
        submitLabel="Simpan kebijakan"
        busy={saving}
        error={formError}
        onClose={() => setSecurityOpen(false)}
        onSubmit={(values) => save(
          () => saveSecurity({
            require_2fa: values.get('require_2fa') === 'on',
            approval_threshold: String(values.get('approval_threshold')),
            session_ttl_minutes: Number(values.get('session_ttl_minutes')),
          }),
          'Kebijakan keamanan diperbarui.',
          () => setSecurityOpen(false),
        )}
      >
        <label className="setting-toggle">
          <input type="checkbox" name="require_2fa" defaultChecked={security?.require_2fa} />
          <span><strong>Wajibkan 2FA untuk anggota</strong><small>Anggota tanpa authenticator tidak akan bisa masuk setelah kebijakan ini aktif.</small></span>
        </label>
        <div className="form-row">
          <label>Ambang approval<input name="approval_threshold" inputMode="numeric" defaultValue={security?.approval_threshold_minor ?? 0} required /><small>Transaksi di atas nilai ini memerlukan persetujuan.</small></label>
          <label>Durasi sesi<input type="number" min="15" max="43200" name="session_ttl_minutes" defaultValue={security?.session_ttl_minutes ?? 480} required /><small>Dalam menit. Rekomendasi: 480 menit.</small></label>
        </div>
      </FormModal>

      {/* ---- Invitation modal ---- */}
      <FormModal
        open={inviteOpen}
        formKey="invite"
        size="sm"
        eyebrow="TIM"
        title="Undang anggota baru"
        description="Token undangan hanya ditampilkan satu kali setelah undangan dibuat."
        submitLabel="Kirim undangan"
        busy={saving}
        error={formError}
        onClose={() => setInviteOpen(false)}
        onSubmit={(values) => save(
          () => createInvitation({ email: String(values.get('email')), role_code: String(values.get('role_code')) }),
          (result) => `Undangan dibuat. Token sekali tampil: ${(result as { invitation_token: string }).invitation_token}`,
          () => setInviteOpen(false),
        )}
      >
        <label>Email<input type="email" name="email" required /></label>
        <label>Peran<select name="role_code" defaultValue="READ_ONLY">{roles.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}</select></label>
        <p className="modal-note">Wewenang tiap peran dapat dilihat pada panel “Peran & hak akses”.</p>
      </FormModal>

      {/* ---- Member role modal ---- */}
      <FormModal
        open={roleEditor !== null}
        formKey={roleEditor?.user_id ?? 'role'}
        size="sm"
        eyebrow="PERAN ANGGOTA"
        title={`Ubah peran ${roleEditor?.full_name ?? ''}`}
        description="Perubahan peran berlaku pada sesi berikutnya anggota tersebut, dan tercatat di jejak audit organisasi."
        submitLabel="Simpan peran"
        busy={saving}
        error={formError}
        onClose={() => setRoleEditor(null)}
        onSubmit={(values) => save(
          () => setMemberRole(roleEditor!.user_id, String(values.get('role_code'))),
          'Peran anggota diperbarui.',
          () => setRoleEditor(null),
        )}
      >
        <label>Peran
          <select name="role_code" defaultValue={roleEditor?.role_code}>
            {roles.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}
          </select>
        </label>
        <p className="modal-note">
          Super admin terakhir tidak dapat diturunkan perannya, dan Anda tidak dapat mengubah peran sendiri.
          {roleEditor && <> Peran saat ini: <strong>{roleLabel(roleEditor.role_code)}</strong>.</>}
        </p>
      </FormModal>

      {/* ---- Document sequence modal ---- */}
      <FormModal
        open={sequenceEditor !== null}
        formKey={editingSequence?.id ?? 'new-sequence'}
        size="sm"
        eyebrow="PENOMORAN"
        title={editingSequence ? `Ubah penomoran ${editingSequence.document_type}` : 'Format penomoran baru'}
        description="Satu jenis dokumen hanya punya satu format; menyimpan ulang akan menimpa format yang ada."
        submitLabel="Simpan format"
        busy={saving}
        error={formError}
        onClose={() => setSequenceEditor(null)}
        onSubmit={(values) => save(
          () => saveSequence({
            document_type: String(values.get('document_type')),
            prefix: String(values.get('prefix')),
            padding: Number(values.get('padding')),
            reset_policy: String(values.get('reset_policy')),
          }),
          'Format nomor dokumen diperbarui.',
          () => setSequenceEditor(null),
        )}
      >
        <div className="form-row">
          <label>Jenis dokumen
            <select name="document_type" defaultValue={editingSequence?.document_type} disabled={Boolean(editingSequence)}>
              {documentTypes.map((value) => <option key={value}>{value}</option>)}
            </select>
            {editingSequence && <input type="hidden" name="document_type" value={editingSequence.document_type} />}
          </label>
          <label>Prefix<input name="prefix" placeholder="INV" defaultValue={editingSequence?.prefix} required /></label>
        </div>
        <div className="form-row">
          <label>Digit nomor<input type="number" name="padding" min="1" max="12" defaultValue={editingSequence?.padding ?? 5} /></label>
          <label>Reset<select name="reset_policy" defaultValue={editingSequence?.reset_policy ?? 'YEARLY'}><option>YEARLY</option><option>MONTHLY</option><option>NEVER</option></select></label>
        </div>
      </FormModal>

      {/* ---- Approval policy modal ---- */}
      <FormModal
        open={policyEditor !== null}
        formKey={editingPolicy?.id ?? 'new-policy'}
        eyebrow="APPROVAL"
        title={editingPolicy ? `Ubah kebijakan ${editingPolicy.document_type}` : 'Kebijakan approval baru'}
        description="Satu jenis dokumen hanya punya satu kebijakan; menyimpan ulang akan menimpa kebijakan yang ada."
        submitLabel="Simpan kebijakan"
        busy={saving}
        error={formError}
        onClose={() => setPolicyEditor(null)}
        onSubmit={(values) => save(
          () => saveApprovalPolicy({
            document_type: String(values.get('document_type')),
            minimum_amount: String(values.get('minimum_amount')),
            minimum_discount_basis_points: Number(values.get('discount_bp')),
            condition_mode: String(values.get('condition_mode')),
            approver_role: String(values.get('approver_role')),
            is_active: true,
          }),
          'Kebijakan approval otomatis disimpan.',
          () => setPolicyEditor(null),
        )}
      >
        <div className="form-row">
          <label>Jenis dokumen
            <select name="document_type" defaultValue={editingPolicy?.document_type} disabled={Boolean(editingPolicy)}>
              {documentTypes.map((value) => <option key={value}>{value}</option>)}
            </select>
            {editingPolicy && <input type="hidden" name="document_type" value={editingPolicy.document_type} />}
          </label>
          <label>Logika<select name="condition_mode" defaultValue={editingPolicy?.condition_mode ?? 'OR'}><option>OR</option><option>AND</option></select></label>
        </div>
        <div className="form-row">
          <label>Nilai minimum<input name="minimum_amount" inputMode="numeric" defaultValue={editingPolicy?.minimum_amount_minor ?? 0} required /></label>
          <label>Diskon minimum (basis point)<input type="number" min="0" max="10000" name="discount_bp" defaultValue={editingPolicy?.minimum_discount_basis_points ?? 0} /></label>
          <label>Penyetuju<select name="approver_role" defaultValue={editingPolicy?.approver_role ?? 'OWNER'}><option>OWNER</option><option>FINANCE</option><option>ACCOUNTANT</option></select></label>
        </div>
        <p className="modal-note">Logika OR berarti dokumen masuk antrean bila salah satu ambang terlampaui; AND mensyaratkan keduanya.</p>
      </FormModal>

      {/* ---- API key modal ---- */}
      <FormModal
        open={keyOpen}
        formKey="api-key"
        size="sm"
        eyebrow="INTEGRASI"
        title="Buat API key"
        description="Key hanya untuk integrasi server dan nilai aslinya ditampilkan satu kali."
        submitLabel="Buat API key"
        busy={saving}
        error={formError}
        onClose={() => setKeyOpen(false)}
        onSubmit={(values) => save(
          () => createAPIKey({
            name: String(values.get('name')),
            permissions: String(values.get('permissions')).split(',').map((value) => value.trim()).filter(Boolean),
          }),
          (result) => `API key dibuat. Secret sekali tampil: ${(result as { secret: string }).secret}`,
          () => setKeyOpen(false),
        )}
      >
        <label>Nama<input name="name" placeholder="Integrasi ERP" required /></label>
        <label>Permissions<input name="permissions" defaultValue="documents:read,reports:read" required /><small>Pisahkan dengan koma.</small></label>
      </FormModal>

      {/* ---- Webhook modal ---- */}
      <FormModal
        open={webhookEditor !== null}
        formKey={editingWebhook?.id ?? 'new-webhook'}
        size="sm"
        eyebrow="INTEGRASI"
        title={editingWebhook ? `Ubah webhook ${editingWebhook.name}` : 'Buat webhook'}
        description={editingWebhook ? 'Signing secret tidak berubah saat webhook diperbarui.' : 'Signing secret hanya ditampilkan satu kali setelah webhook dibuat.'}
        submitLabel={editingWebhook ? 'Simpan perubahan' : 'Buat webhook'}
        busy={saving}
        error={formError}
        onClose={() => setWebhookEditor(null)}
        onSubmit={(values) => save(
          () => {
            const input = {
              name: String(values.get('name')),
              endpoint_url: String(values.get('endpoint_url')),
              subscribed_events: String(values.get('events')).split(',').map((value) => value.trim()).filter(Boolean),
            }
            return editingWebhook ? updateWebhook(editingWebhook.id, input) : createWebhook(input)
          },
          (result) => editingWebhook ? 'Webhook berhasil diperbarui.' : `Webhook dibuat. Signing secret sekali tampil: ${(result as { signing_secret: string }).signing_secret}`,
          () => setWebhookEditor(null),
        )}
      >
        <label>Nama<input name="name" defaultValue={editingWebhook?.name} required /></label>
        <label>HTTPS endpoint<input type="url" name="endpoint_url" placeholder="https://erp.example.com/hooks/loka" defaultValue={editingWebhook?.endpoint_url} required /></label>
        <label>Event<input name="events" defaultValue={editingWebhook?.subscribed_events.join(',') ?? 'document.created,journal.posted'} required /><small>Pisahkan dengan koma.</small></label>
      </FormModal>

      {/* ---- Confirm dialogs ---- */}
      <ConfirmDialog
        open={memberStatus.target !== null}
        title={memberStatus.target?.is_active ? 'Nonaktifkan anggota?' : 'Aktifkan anggota?'}
        confirmLabel={memberStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={memberStatus.busy}
        error={memberStatus.error}
        onClose={memberStatus.close}
        onConfirm={() => memberStatus.run((member) => setMemberActive(member.user_id, !member.is_active).then(refresh))}
        description={memberStatus.target?.is_active
          ? <><strong>{memberStatus.target.full_name}</strong> akan langsung kehilangan akses ke organisasi ini. Jejak audit atas tindakannya tetap tersimpan.</>
          : <><strong>{memberStatus.target?.full_name}</strong> akan kembali dapat masuk dengan peran {memberStatus.target?.role_code}.</>}
      />

      <ConfirmDialog
        open={decision.target !== null}
        tone={decision.target?.verdict === 'REJECTED' ? 'danger' : 'neutral'}
        title={decision.target?.verdict === 'APPROVED' ? 'Setujui permintaan?' : 'Tolak permintaan?'}
        confirmLabel={decision.target?.verdict === 'APPROVED' ? 'Setujui' : 'Tolak'}
        busy={decision.busy}
        error={decision.error}
        onClose={decision.close}
        onConfirm={() => decision.run((value) => decideApproval(value.approval.id, value.verdict).then(refresh))}
        description={<>Keputusan atas <strong>{decision.target?.approval.entity_type}</strong> senilai <strong>{decision.target?.approval.amount_minor.toLocaleString('id-ID')}</strong> akan dicatat bersama nama Anda dan tidak dapat diubah.</>}
      />

      <ConfirmDialog
        open={keyRevoke.target !== null}
        tone="danger"
        title="Cabut API key?"
        confirmLabel="Cabut key"
        busy={keyRevoke.busy}
        error={keyRevoke.error}
        onClose={keyRevoke.close}
        onConfirm={() => keyRevoke.run((key) => revokeAPIKey(key.id).then(refresh))}
        description={<>Key <strong>{keyRevoke.target?.name}</strong> akan langsung berhenti bekerja. Integrasi yang memakainya harus dibuatkan key baru.</>}
      />

      <ConfirmDialog
        open={sequenceRemoval.target !== null}
        tone="danger"
        title="Hapus format penomoran?"
        confirmLabel="Hapus format"
        busy={sequenceRemoval.busy}
        error={sequenceRemoval.error}
        onClose={sequenceRemoval.close}
        onConfirm={() => sequenceRemoval.run((sequence) => deleteSequence(sequence.id).then(refresh))}
        description={<>Format <strong>{sequenceRemoval.target?.document_type}</strong> akan dihapus. Penghapusan ditolak jika penomoran sudah pernah dipakai dokumen.</>}
      />

      <ConfirmDialog
        open={policyStatus.target !== null}
        title={policyStatus.target?.is_active ? 'Nonaktifkan kebijakan?' : 'Aktifkan kebijakan?'}
        confirmLabel={policyStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={policyStatus.busy}
        error={policyStatus.error}
        onClose={policyStatus.close}
        onConfirm={() => policyStatus.run((policy) => saveApprovalPolicy({
          document_type: policy.document_type,
          minimum_amount: String(policy.minimum_amount_minor),
          minimum_discount_basis_points: policy.minimum_discount_basis_points,
          condition_mode: policy.condition_mode,
          approver_role: policy.approver_role,
          is_active: !policy.is_active,
        }).then(refresh))}
        description={policyStatus.target?.is_active
          ? <>Dokumen <strong>{policyStatus.target.document_type}</strong> tidak akan lagi masuk antrean approval otomatis.</>
          : <>Dokumen <strong>{policyStatus.target?.document_type}</strong> akan kembali masuk antrean approval saat melewati ambang.</>}
      />

      <ConfirmDialog
        open={policyRemoval.target !== null}
        tone="danger"
        title="Hapus kebijakan approval?"
        confirmLabel="Hapus permanen"
        busy={policyRemoval.busy}
        error={policyRemoval.error}
        onClose={policyRemoval.close}
        onConfirm={() => policyRemoval.run((policy) => deleteApprovalPolicy(policy.id).then(refresh))}
        description={<>Kebijakan untuk <strong>{policyRemoval.target?.document_type}</strong> akan dihapus permanen. Permintaan approval yang sudah tercatat tetap tersimpan.</>}
      />

      <ConfirmDialog
        open={webhookStatus.target !== null}
        title={webhookStatus.target?.is_active ? 'Nonaktifkan webhook?' : 'Aktifkan webhook?'}
        confirmLabel={webhookStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={webhookStatus.busy}
        error={webhookStatus.error}
        onClose={webhookStatus.close}
        onConfirm={() => webhookStatus.run((webhook) => setWebhookActive(webhook.id, !webhook.is_active).then(refresh))}
        description={webhookStatus.target?.is_active
          ? <>Endpoint <strong>{webhookStatus.target.name}</strong> berhenti menerima event baru. Antrean pengiriman yang belum terkirim tidak dilanjutkan.</>
          : <>Endpoint <strong>{webhookStatus.target?.name}</strong> kembali menerima event yang dilanggan.</>}
      />

      <ConfirmDialog
        open={webhookRemoval.target !== null}
        tone="danger"
        title="Hapus webhook permanen?"
        confirmLabel="Hapus permanen"
        confirmationWord={webhookRemoval.target?.name}
        confirmationHint={<>Ketik nama webhook <strong>{webhookRemoval.target?.name}</strong> untuk konfirmasi</>}
        busy={webhookRemoval.busy}
        error={webhookRemoval.error}
        onClose={webhookRemoval.close}
        onConfirm={() => webhookRemoval.run((webhook) => deleteWebhook(webhook.id).then(refresh))}
        description={<>Endpoint <strong>{webhookRemoval.target?.name}</strong> beserta signing secret-nya akan dihapus permanen dan tidak dapat dipulihkan.</>}
      />
    </section>
  )
}
