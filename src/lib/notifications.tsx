import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listApprovals, listDocuments, listInventoryBalances, listInvitations, listItems } from '../api/operations'
import type { Approval, BusinessDocument, InventoryBalance, Invitation, Item, Onboarding } from '../types/operations'
import { tileOf, type PageKey } from './menu'
import { useLedgerRefresh } from './refresh'
import { useAccess } from './rbac'

/**
 * Pusat notifikasi. Backend belum punya tabel notifikasi tersendiri, jadi
 * daftar ini dirakit dari data yang memang sudah ada: antrean persetujuan,
 * dokumen yang jatuh tempo atau mangkrak sebagai draf, stok yang menyentuh
 * batas minimum, undangan tim, dan langkah persiapan yang belum tuntas.
 * Statusnya "sudah dibaca" bersifat per peramban karena tidak ada tempat
 * menyimpannya di server.
 */

export type NotificationTone = 'critical' | 'warning' | 'info'
export type NotificationCategory = 'approval' | 'document' | 'inventory' | 'team' | 'setup'

export type NotificationItem = {
  /** Stabil antar pemuatan agar tanda "sudah dibaca" tidak hilang. */
  id: string
  tone: NotificationTone
  category: NotificationCategory
  title: string
  body: string
  /** Tanggal acuan kejadian; kosong bila memang tidak ada. */
  at?: string
  /** Halaman yang dibuka saat notifikasi diklik. */
  target?: PageKey
  /**
   * Kondisi yang berlaku sampai diberesi — bukan kejadian pada satu tanggal —
   * sehingga tidak ikut disaring jendela waktu.
   */
  persistent?: boolean
}

export const categoryLabel: Record<NotificationCategory, string> = {
  approval: 'Persetujuan',
  document: 'Dokumen',
  inventory: 'Persediaan',
  team: 'Tim',
  setup: 'Persiapan',
}

const DAY = 86_400_000
const toneRank: Record<NotificationTone, number> = { critical: 0, warning: 1, info: 2 }

/**
 * Jendela waktu notifikasi. Kejadian yang lebih tua dari ini tidak lagi
 * ditampilkan supaya daftar tetap ringkas dan tidak menumpuk selamanya —
 * riwayat lengkapnya tetap ada di dokumen dan laporan masing-masing. Yang
 * bertanda `persistent` dikecualikan karena masih menuntut tindakan.
 */
export const RETENTION_DAYS = 30

/** Tanggal mendatang selalu lolos; yang lampau hanya sampai batas jendela. */
function withinWindow(item: NotificationItem): boolean {
  if (item.persistent) return true
  const days = daysFromToday(item.at ?? null)
  return Number.isNaN(days) || days >= -RETENTION_DAYS
}

/** Selisih hari terhadap hari ini; negatif berarti sudah lewat. NaN bila tanggal tidak sah. */
function daysFromToday(value: string | null): number {
  if (!value) return Number.NaN
  const time = Date.parse(value)
  if (Number.isNaN(time)) return Number.NaN
  const start = new Date(); start.setHours(0, 0, 0, 0)
  return Math.round((time - start.getTime()) / DAY)
}

/** "hari ini", "kemarin", "3 hari lalu" — cukup untuk daftar yang dibaca sekilas. */
export function relativeTime(value?: string): string {
  const days = daysFromToday(value ?? null)
  if (Number.isNaN(days)) return ''
  if (days === 0) return 'hari ini'
  if (days === 1) return 'besok'
  if (days === -1) return 'kemarin'
  if (days > 1) return days < 30 ? `${days} hari lagi` : `${Math.round(days / 30)} bulan lagi`
  const past = Math.abs(days)
  if (past < 30) return `${past} hari lalu`
  if (past < 365) return `${Math.round(past / 30)} bulan lalu`
  return `${Math.round(past / 365)} tahun lalu`
}

const documentPage: Record<string, PageKey> = {
  SALES_QUOTE: 'sales.quote', SALES_ORDER: 'sales.order', DELIVERY: 'sales.delivery',
  SALES_INVOICE: 'sales.invoice', SALES_RETURN: 'sales.return',
  PURCHASE_REQUISITION: 'purchase.requisition', PURCHASE_ORDER: 'purchase.order',
  GOODS_RECEIPT: 'purchase.receipt', PURCHASE_INVOICE: 'purchase.invoice', PURCHASE_RETURN: 'purchase.return',
}

function documentName(type: string): string {
  const page = documentPage[type]
  return page ? tileOf(page).label : type
}

const closedStatus = new Set(['COMPLETED', 'CANCELLED', 'CLOSED', 'PAID'])

const READ_KEY = 'loka.notifications.read'
/** Tanda baca dibatasi agar penyimpanan tidak tumbuh tanpa henti. */
const READ_LIMIT = 500

function loadRead(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function storeRead(ids: string[]) {
  try { localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(0, READ_LIMIT))) } catch { /* penyimpanan penuh atau diblokir */ }
}

/** Sumber yang tidak boleh dibaca peran ini dilewati, kegagalannya tidak menggagalkan yang lain. */
function source<T>(allowed: boolean, load: () => Promise<T>, empty: T): Promise<T> {
  return allowed ? load().then((value) => value ?? empty).catch(() => empty) : Promise.resolve(empty)
}

function fromApprovals(approvals: Approval[]): NotificationItem[] {
  return approvals
    .filter((approval) => approval.status === 'PENDING')
    .slice(0, 25)
    .map((approval) => ({
      id: `approval:${approval.id}`,
      tone: 'warning' as const,
      category: 'approval' as const,
      title: 'Menunggu persetujuan Anda',
      body: `${documentName(approval.entity_type)} diajukan dan belum diputuskan.`,
      at: approval.requested_at,
      target: 'settings.role' as PageKey,
    }))
}

function fromDocuments(documents: BusinessDocument[], hasApprovals: boolean): NotificationItem[] {
  const items: NotificationItem[] = []
  for (const document of documents) {
    if (closedStatus.has(document.status)) continue
    const target = documentPage[document.document_type]
    const name = documentName(document.document_type)

    // Antrean approval sudah dilaporkan sumbernya sendiri; hindari ganda.
    if (document.status === 'PENDING_APPROVAL' && !hasApprovals) {
      items.push({
        id: `doc-approval:${document.id}`, tone: 'warning', category: 'approval',
        title: `${name} ${document.number} menunggu persetujuan`,
        body: 'Dokumen tertahan di antrean approval.', at: document.document_date, target,
      })
      continue
    }

    const due = daysFromToday(document.due_date)
    if (!Number.isNaN(due) && due < 0) {
      items.push({
        id: `doc-overdue:${document.id}`, tone: 'critical', category: 'document',
        title: `${name} ${document.number} lewat jatuh tempo`,
        body: `Jatuh tempo ${Math.abs(due)} hari lalu dan belum ditutup.`, at: document.due_date ?? undefined, target,
        // Tunggakan tidak hilang karena umurnya; justru yang paling tua yang paling perlu dilihat.
        persistent: true,
      })
      continue
    }
    if (!Number.isNaN(due) && due <= 7) {
      items.push({
        id: `doc-due:${document.id}`, tone: 'warning', category: 'document',
        title: `${name} ${document.number} segera jatuh tempo`,
        body: due === 0 ? 'Jatuh tempo hari ini.' : `Jatuh tempo ${due} hari lagi.`, at: document.due_date ?? undefined, target,
      })
      continue
    }

    const age = daysFromToday(document.document_date)
    if (document.status === 'DRAFT' && !Number.isNaN(age) && age <= -7) {
      items.push({
        id: `doc-draft:${document.id}`, tone: 'info', category: 'document',
        title: `${name} ${document.number} masih draf`,
        body: `Dibuat ${Math.abs(age)} hari lalu dan belum diajukan.`, at: document.document_date, target,
      })
    }
  }
  return items.slice(0, 40)
}

function fromInventory(items: Item[], balances: InventoryBalance[]): NotificationItem[] {
  const tracked = new Map(items.filter((item) => item.item_type === 'INVENTORY' && item.is_active).map((item) => [item.id, item]))
  const onHand = new Map<string, number>()
  const result: NotificationItem[] = []

  for (const balance of balances) {
    const quantity = Number(balance.quantity)
    if (Number.isNaN(quantity)) continue
    onHand.set(balance.item_id, (onHand.get(balance.item_id) ?? 0) + quantity)
    // Stok minus berarti ada pencatatan keluar tanpa penerimaan — selalu dilaporkan per gudang.
    if (quantity < 0) {
      result.push({
        id: `inv-negative:${balance.item_id}:${balance.warehouse_id}`, tone: 'critical', category: 'inventory',
        title: `Stok minus: ${balance.item_name}`,
        body: `${balance.quantity} di gudang ${balance.warehouse_name}. Periksa penerimaan atau penyesuaian yang terlewat.`,
        target: 'inventory.stockbywarehouse', persistent: true,
      })
    }
  }

  for (const [itemId, item] of tracked) {
    const minimum = Number(item.minimum_stock)
    if (!Number.isFinite(minimum) || minimum <= 0) continue
    const quantity = onHand.get(itemId) ?? 0
    if (quantity >= minimum) continue
    result.push({
      id: `inv-minimum:${itemId}`, tone: 'warning', category: 'inventory',
      title: `Stok di bawah minimum: ${item.name}`,
      body: `Sisa ${quantity} dari batas minimum ${minimum} (${item.sku}).`,
      target: 'inventory.minimumstock', persistent: true,
    })
  }
  return result.slice(0, 40)
}

function fromInvitations(invitations: Invitation[]): NotificationItem[] {
  return invitations
    .filter((invitation) => invitation.status === 'PENDING')
    .slice(0, 20)
    .map((invitation) => {
      const days = daysFromToday(invitation.expires_at)
      const expired = !Number.isNaN(days) && days < 0
      return {
        id: `invite:${invitation.id}`,
        tone: (expired ? 'warning' : 'info') as NotificationTone,
        category: 'team' as const,
        title: expired ? `Undangan ${invitation.email} kedaluwarsa` : `Undangan ${invitation.email} belum diterima`,
        body: expired ? 'Kirim ulang undangan agar rekan ini bisa masuk.' : `Peran ${invitation.role_code}, berlaku sampai ${relativeTime(invitation.expires_at)}.`,
        at: invitation.expires_at,
        target: 'settings.user' as PageKey,
      }
    })
}

const SETUP_STEPS = 10

function fromOnboarding(onboarding: Onboarding | null): NotificationItem[] {
  if (!onboarding || onboarding.completed_at) return []
  const done = new Set([...onboarding.completed_steps, ...onboarding.skipped_steps]).size
  if (done >= SETUP_STEPS) return []
  return [{
    id: `setup:${onboarding.business_id}:${done}`,
    tone: 'info',
    category: 'setup',
    title: 'Persiapan data perusahaan belum selesai',
    body: `${done} dari ${SETUP_STEPS} langkah sudah dilalui. Lanjutkan agar laporan langsung akurat.`,
    at: onboarding.updated_at,
    target: 'settings.setup',
    persistent: true,
  }]
}

async function collect(can: (permission: string) => boolean, onboarding: Onboarding | null): Promise<NotificationItem[]> {
  const [approvals, documents, invitations, items, balances] = await Promise.all([
    source(can('accounting.approvals.decide'), listApprovals, [] as Approval[]),
    source(can('accounting.documents.view'), () => listDocuments(), [] as BusinessDocument[]),
    source(can('accounting.settings.manage'), listInvitations, [] as Invitation[]),
    source(can('accounting.inventory.view'), listItems, [] as Item[]),
    source(can('accounting.inventory.view'), listInventoryBalances, [] as InventoryBalance[]),
  ])

  return [
    ...fromApprovals(approvals),
    ...fromDocuments(documents, approvals.length > 0),
    ...fromInventory(items, balances),
    ...fromInvitations(invitations),
    ...fromOnboarding(onboarding),
  ].filter(withinWindow).sort((left, right) => toneRank[left.tone] - toneRank[right.tone] || (right.at ?? '').localeCompare(left.at ?? ''))
}

type NotificationState = {
  items: NotificationItem[]
  unread: number
  loading: boolean
  isRead: (id: string) => boolean
  markRead: (id: string) => void
  markAllRead: () => void
  refresh: () => void
}

const NotificationContext = createContext<NotificationState | null>(null)

export function NotificationProvider({ onboarding, children }: { onboarding: Onboarding | null; children: ReactNode }) {
  const { can, profile } = useAccess()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [read, setRead] = useState<string[]>(loadRead)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!profile) { setItems([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    collect(can, onboarding)
      .then((value) => {
        if (cancelled) return
        setItems(value)
        // Tanda baca milik notifikasi yang sudah lewat jendela waktu atau sudah
        // selesai ditindaklanjuti ikut dibuang agar penyimpanan tidak menumpuk.
        setRead((current) => {
          const live = new Set(value.map((item) => item.id))
          const next = current.filter((id) => live.has(id))
          if (next.length === current.length) return current
          storeRead(next)
          return next
        })
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [can, onboarding, profile, tick])

  const refresh = useCallback(() => setTick((value) => value + 1), [])
  // Setiap jurnal baru dapat menutup faktur atau menggerakkan stok, jadi
  // daftar ini ikut disegarkan bersama halaman buku besar.
  useLedgerRefresh(refresh)

  const value = useMemo<NotificationState>(() => {
    const readSet = new Set(read)
    return {
      items,
      loading,
      unread: items.filter((item) => !readSet.has(item.id)).length,
      isRead: (id: string) => readSet.has(id),
      markRead: (id: string) => setRead((current) => {
        if (current.includes(id)) return current
        const next = [id, ...current].slice(0, READ_LIMIT)
        storeRead(next)
        return next
      }),
      markAllRead: () => setRead(() => {
        const next = items.map((item) => item.id).slice(0, READ_LIMIT)
        storeRead(next)
        return next
      }),
      refresh,
    }
  }, [items, loading, read, refresh])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications(): NotificationState {
  return useContext(NotificationContext) ?? {
    items: [], unread: 0, loading: false, isRead: () => true, markRead: () => undefined, markAllRead: () => undefined, refresh: () => undefined,
  }
}
