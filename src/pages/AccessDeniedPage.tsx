import type { MenuTile } from '../lib/menu'
import type { OrganizationRole } from '../types/operations'
import { EmptyState, PageHeader } from '../components/ui'

/**
 * Ditampilkan ketika sebuah halaman dibuka oleh peran yang tidak berwenang —
 * biasanya lewat tautan langsung, karena menu untuk peran itu sudah disaring.
 */
export function AccessDeniedPage({ tile, role }: { tile: MenuTile; role: OrganizationRole | null }) {
  return (
    <section>
      <PageHeader
        eyebrow="AKSES DITOLAK"
        title={tile.label}
        description="Peran Anda tidak memiliki wewenang untuk membuka halaman ini."
      />
      <EmptyState icon="compliance">
        Halaman ini membutuhkan wewenang <strong className="mono">{tile.view}</strong>.
        {role
          ? <> Peran Anda saat ini adalah <strong>{role.label}</strong>. Minta super admin organisasi untuk mengubah peran Anda lewat Pengaturan → Pengguna.</>
          : <> Minta super admin organisasi untuk memberi wewenang lewat Pengaturan → Pengguna.</>}
      </EmptyState>
    </section>
  )
}
