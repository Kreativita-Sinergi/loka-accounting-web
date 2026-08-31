import { lazy, Suspense, useEffect, useState } from 'react'
import { getStoredProfile } from './api/auth'
import { AuthPage } from './pages/AuthPage'
import { LandingPage } from './pages/LandingPage'

const AccountingApp = lazy(() => import('./App'))

export default function PublicApp() {
  const [authenticated, setAuthenticated] = useState(() => getStoredProfile() !== null)
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextPath: string) {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function completeAuthentication() {
    setAuthenticated(true)
    window.history.replaceState({}, '', '/app')
  }

  if (authenticated) {
    return <Suspense fallback={<AppLoading />}><AccountingApp /></Suspense>
  }

  const invited = new URLSearchParams(window.location.search).has('invite')
  if (invited || path === '/login' || path === '/register') {
    return <AuthPage initialMode={path === '/register' ? 'register' : 'login'} onAuthenticated={completeAuthentication} onBack={() => navigate('/')} />
  }

  return <LandingPage onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
}

function AppLoading() {
  return <main className="app-loading" role="status"><img src="/loka-icon.svg" alt="" /><span>Menyiapkan workspace…</span></main>
}
