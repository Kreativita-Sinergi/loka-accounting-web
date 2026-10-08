import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PublicApp from './PublicApp'
import './styles.css'
import AdminApp from './admin/AdminApp'

const isAdmin = import.meta.env.VITE_APP_MODE === 'admin' || /^\/admin(?:\/|$)/.test(window.location.pathname)
if (isAdmin) {
  document.title = 'Loka Admin — Accounting'
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') || document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex, nofollow'
  document.head.appendChild(robots)
}
createRoot(document.getElementById('root')!).render(<StrictMode>{isAdmin ? <AdminApp /> : <PublicApp />}</StrictMode>)
