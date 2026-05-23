import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from './constants/brand'
import { LoadingSpinner } from './components/LoadingSpinner'
import { FlowEditorPage } from './features/editor/pages/FlowEditorPage'
import { Dashboard } from './features/dashboard/Dashboard'
import { SharedFlowPage } from './features/shared/SharedFlowPage'
import { LandingPage } from './features/landing/LandingPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { AdminPage } from './features/admin/AdminPage'
import { VerifyPage } from './features/auth/VerifyPage'
import { DemoEditorPage } from './features/editor/pages/DemoEditorPage'
import { JoinProjectPage } from './features/projects/JoinProjectPage'
import { useAuth, AuthProvider } from './hooks/useAuth'

const DevRenderPage = import.meta.env.DEV
  ? lazy(() => import('./dev/DevRenderPage').then((m) => ({ default: m.DevRenderPage })))
  : null

function Header() {
  const { t } = useTranslation()
  const { user, loading, logout } = useAuth()
  const location = useLocation()

  // Hide header on landing page, dashboard, flow editor pages, settings, verify, and shared view (full-screen)
  if (
    location.pathname === '/' ||
    location.pathname === '/flows' ||
    location.pathname === '/settings' ||
    location.pathname === '/admin' ||
    location.pathname === '/verify' ||
    location.pathname === '/try' ||
    location.pathname.match(/^\/flows\/[^/]+$/) ||
    location.pathname.match(/^\/shared\/[^/]+$/) ||
    location.pathname.match(/^\/join\/[^/]+$/) ||
    location.pathname.startsWith('/dev/')
  ) {
    return null
  }

  if (loading)
    return (
      <header>
        <LoadingSpinner fullScreen />
      </header>
    )

  return (
    <header data-testid="app-header">
      <nav>
        <Link to="/">{BRAND.name}</Link>
        {user ? (
          <div>
            <span data-testid="user-name">{user.name}</span>
            <button onClick={logout} data-testid="logout-button">
              {t('logout')}
            </button>
          </div>
        ) : (
          <div>
            <Link to="/login">{t('login')}</Link>
            <Link to="/register">{t('register')}</Link>
          </div>
        )}
      </nav>
    </header>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function PublicHome() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  if (user) return <Navigate to="/flows" replace />
  return <LandingPage />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Header />
        <main>
          <Routes>
            <Route path="/login" element={<Navigate to="/?auth=login" replace />} />
            <Route path="/register" element={<Navigate to="/?auth=register" replace />} />
            <Route path="/" element={<PublicHome />} />
            <Route
              path="/flows"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/flows/:id"
              element={
                <ProtectedRoute>
                  <FlowEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/shared/:token" element={<SharedFlowPage />} />
            <Route path="/join/:token" element={<JoinProjectPage />} />
            <Route path="/try" element={<DemoEditorPage />} />
            {DevRenderPage && (
              <Route
                path="/dev/render"
                element={
                  <Suspense fallback={null}>
                    <DevRenderPage />
                  </Suspense>
                }
              />
            )}
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
