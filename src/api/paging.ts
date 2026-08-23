import { api } from './client'
import type { ApiEnvelope } from '../types/accounting'

/** Bentuk respons daftar server-side dari backend (`repository.Paged`). */
export type Paged<T> = { rows: T[]; page: number; size: number; total: number; sort: string; order: string }

export type PageRequest = {
  page: number
  size: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  /** Filter kolom; nilai 'ALL' diabaikan oleh backend. */
  filters?: Record<string, string>
}

export function pageParams(request: PageRequest) {
  return {
    page: request.page,
    size: request.size,
    sort: request.sort || undefined,
    order: request.order || undefined,
    search: request.search?.trim() || undefined,
    ...Object.fromEntries(Object.entries(request.filters ?? {}).filter(([, value]) => value && value !== 'ALL')),
  }
}

export async function getPaged<T>(path: string, request: PageRequest) {
  const { data } = await api.get<ApiEnvelope<Paged<T>>>(path, { params: pageParams(request) })
  return data.data
}
