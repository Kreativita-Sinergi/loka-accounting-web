import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listRoles, myAccessRules } from '../api/operations'
import { PUBLIC_PERMISSION } from './menu'
import type { AccessRule, OrganizationRole } from '../types/operations'
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
  rules: AccessRule[]
  role: OrganizationRole | null
  isSuperAdmin: boolean
  /** Katalog belum tiba; menu ditampilkan penuh agar tidak berkedip. */
  loading: boolean
  can: (permission: string) => boolean
  canCrud: (permission: string, action: 'create' | 'read' | 'update' | 'delete') => boolean
}

const AccessContext = createContext<Access | null>(null)

/** Aturan pencocokan yang sama dengan `roleAllows` di backend. */
export function permissionMatches(permissions: string[], permission: string) {
  return permissions.some((allowed) =>
    allowed === 'accounting.*' || allowed === permission || (allowed.endsWith('.') && permission.startsWith(allowed)))
}

export function AccessProvider({ profile, children }: { profile: IdentityProfile | null; children: ReactNode }) {
  const [roles, setRoles] = useState<OrganizationRole[]>([])
  const [rules, setRules] = useState<AccessRule[]>([])
  const [roleCode, setRoleCode] = useState(profile?.role_code ?? '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) { setRoles([]); setRules([]); setRoleCode(''); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    Promise.all([listRoles(), myAccessRules()])
      .then(([catalogue, access]) => { if (!cancelled) { setRoles(catalogue ?? []); setRules(access?.rules ?? []); setRoleCode(access?.role_code ?? profile.role_code) } })
      .catch(() => { if (!cancelled) { setRoles([]); setRules([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [profile])

  useEffect(() => {
    const refresh = () => { void myAccessRules().then((value) => { setRules(value?.rules ?? []); setRoleCode(value?.role_code ?? '') }) }
    window.addEventListener('loka:access-changed', refresh)
    return () => window.removeEventListener('loka:access-changed', refresh)
  }, [])

  const value = useMemo<Access>(() => {
    const code = roleCode.toUpperCase()
    const role = roles.find((candidate) => candidate.code === code) ?? null
    const isSuperAdmin = code === SUPER_ADMIN || role?.is_super_admin === true
    return {
      profile,
      roles,
      rules,
      role,
      isSuperAdmin,
      loading,
      canCrud: (permission, action) => {
        if (!profile) return false
        if (permission === PUBLIC_PERMISSION) return true
        if (permission === 'owner') return isSuperAdmin
        const resource = permission.split('.')[1]
        const effective = rules.find((item) => item.subject_type === 'USER' && item.subject_id === profile.user_id && item.resource === resource)
          ?? rules.find((item) => item.subject_type === 'ROLE' && item.subject_id === code && item.resource === resource)
        if (effective) return effective[`can_${action}`]
        return true
      },
      can: (permission: string) => {
        if (!profile) return false
        if (permission === PUBLIC_PERMISSION) return true
        if (permission === 'owner') return isSuperAdmin
        const resource = permission.split('.')[1]
        const effective = rules.find((item) => item.subject_type === 'USER' && item.subject_id === profile.user_id && item.resource === resource)
          ?? rules.find((item) => item.subject_type === 'ROLE' && item.subject_id === code && item.resource === resource)
        return effective?.can_read ?? true
      },
    }
  }, [profile, roleCode, roles, rules, loading])

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess(): Access {
  return useContext(AccessContext) ?? {
    profile: null, roles: [], rules: [], role: null, isSuperAdmin: false, loading: true, can: () => true, canCrud: () => true,
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
export type WriteAccess = { create: boolean; update: boolean; delete: boolean }
const WriteAccessContext = createContext<WriteAccess>({ create: true, update: true, delete: true })

export function WriteAccessProvider({ value, children }: { value: WriteAccess; children: ReactNode }) {
  return <WriteAccessContext.Provider value={value}>{children}</WriteAccessContext.Provider>
}

export function useWriteAccess() { return useContext(WriteAccessContext) }

export function useCanWrite(action: keyof WriteAccess = 'create') {
  return useWriteAccess()[action]
}
