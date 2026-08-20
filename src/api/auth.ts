import { api } from './client'
import type { ApiEnvelope } from '../types/accounting'

export interface IdentityProfile {
  user_id: string
  full_name: string
  email: string
  organization_id: string
  organization_name: string
  role_code: string
}

export interface AuthSession {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  profile: IdentityProfile
}

export async function login(input: { email: string; password: string; totp_code?: string; recovery_code?: string }) {
  const { data } = await api.post<ApiEnvelope<AuthSession>>('/auth/login', input)
  return data.data
}

export async function acceptInvitation(input: { token: string; full_name: string; password: string }) {
	const { data } = await api.post<ApiEnvelope<AuthSession>>('/auth/invitations/accept', input)
	return data.data
}

export async function register(input: { organization_name: string; full_name: string; email: string; password: string }) {
  const { data } = await api.post<ApiEnvelope<AuthSession>>('/auth/register', input)
  return data.data
}

export function saveSession(session: AuthSession) {
  localStorage.setItem('token', session.access_token)
  localStorage.setItem('accounting_profile', JSON.stringify(session.profile))
}

export function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('accounting_profile')
}

export function getStoredProfile(): IdentityProfile | null {
  try {
    const raw = localStorage.getItem('accounting_profile')
    return raw ? JSON.parse(raw) as IdentityProfile : null
  } catch {
    clearSession()
    return null
  }
}
