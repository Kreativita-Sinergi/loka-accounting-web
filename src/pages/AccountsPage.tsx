import type { Account } from '../types/accounting'
import { Badge, EmptyState, PageHeader } from '../components/ui'

export function AccountsPage({ accounts }: { accounts: Account[] }) {
  return (
    <section>
      <PageHeader eyebrow="CHART OF ACCOUNTS" title="Daftar akun" description="Struktur akun organisasi untuk pencatatan dan laporan keuangan." action={<Badge>{accounts.length} akun</Badge>} />
      <div className="table-wrap panel">
        {accounts.length === 0 ? <EmptyState>Belum ada akun dalam chart of accounts.</EmptyState> :
        <table>
          <thead><tr><th>Kode</th><th>Nama akun</th><th>Tipe</th><th>Saldo normal</th><th>Status</th></tr></thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="mono">{account.code}</td>
                <td><strong>{account.name}</strong>{account.system_key && <small className="block">{account.system_key}</small>}</td>
                <td><span className="type-tag">{account.type.replaceAll('_', ' ')}</span></td>
                <td>{account.normal_balance}</td>
                <td><span className={account.is_active ? 'status active' : 'status'}>{account.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </section>
  )
}
