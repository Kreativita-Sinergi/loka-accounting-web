import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listRoles } from '../api/operations'
import { PUBLIC_PERMISSION } from './menu'
import type { OrganizationRole } from '../types/operations'
import type { IdentityProfile } from '../api/auth'

/**
 * RBAC sisi web (§3.5). Katalog peran diambil dari backend supaya wewenang di
 * menu, tombol, dan middleware berasal dari satu sumber. Pembatasan di sini
 * murni tampilan — backend tetap menolak permintaan yang tidak berwenang, dan
 * pembuat organisasi pertama otomatis berperan super admin (OWNER).
 */
const SUPER_ADMIN = 'OWNER'

type Access = {
  profile: IdentityProfile | null
  roles: OrganizationRole[]
  role: OrganizationRole | null
  isSuperAdmin: boolean
  /** Katalog belum tiba; menu ditampilkan penuh agar tidak berkedip. */
  loading: boolean
  can: (permission: string) => boolean
}

const AccessContext = createContext<Access | null>(null)

/** Aturan pencocokan yang sama dengan `roleAllows` di backend. */
export function permissionMatches(permissions: string[], permission: string) {
  return permissions.some((allowed) =>
    allowed === 'accounting.*' || allowed === permission || (allowed.endsWith('.') && permission.startsWith(allowed)))
}

export function AccessProvider({ profile, children }: { profile: IdentityProfile | null; children: ReactNode }) {
  const [roles, setRoles] = useState<OrganizationRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) { setRoles([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    listRoles()
      .then((value) => { if (!cancelled) setRoles(value ?? []) })
      .catch(() => { if (!cancelled) setRoles([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [profile])

  const value = useMemo<Access>(() => {
    const code = profile?.role_code?.toUpperCase() ?? ''
    const role = roles.find((candidate) => candidate.code === code) ?? null
    const isSuperAdmin = code === SUPER_ADMIN || role?.is_super_admin === true
    return {
      profile,
      roles,
      role,
      isSuperAdmin,
      loading,
      can: (permission: string) => {
        if (!profile) return false
        if (permission === PUBLIC_PERMISSION) return true
        if (isSuperAdmin) return true
        // Selama katalog belum tiba, jangan sembunyikan apa pun.
        if (!role) return loading || roles.length === 0
        return permissionMatches(role.permissions, permission)
      },
    }
  }, [profile, roles, loading])

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess(): Access {
  return useContext(AccessContext) ?? {
    profile: null, roles: [], role: null, isSuperAdmin: false, loading: true, can: () => true,
  }
}

export function useCan(permission: string) {
  return useAccess().can(permission)
}

/**
 * Wewenang tulis pada halaman yang sedang dibuka. Shell menyediakannya per
 * tab, sehingga komponen daftar bersama dapat menyembunyikan tombol tambah
 * dan aksi baris yang mengubah data tanpa setiap halaman ikut diubah.
 */
const WriteAccessContext = createContext(true)

export function WriteAccessProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <WriteAccessContext.Provider value={value}>{children}</WriteAccessContext.Provider>
}

export function useCanWrite() {
  return useContext(WriteAccessContext)
}
