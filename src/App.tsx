import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { FlowEditorPage } from './features/editor/pages/FlowEditorPage'
import { Dashboard } from './features/dashboard/Dashboard'
import { SharedFlowPage } from './features/shared/SharedFlowPage'
import { LandingPage } from './features/landing/LandingPage'
import { useAuth, AuthProvider } from './hooks/useAuth'
import './App.css'

function Header() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()

  // Hide header on landing page, flow editor pages, and shared view (full-screen)
  if (location.pathname === '/' || location.pathname.match(/^\/flows\/[^/]+$/) || location.pathname.match(/^\/shared\/[^/]+$/)) {
    return null
  }

  if (loading)
    return (
      <header>
        <p>読み込み中...</p>
      </header>
    )

  return (
    <header data-testid="app-header">
      <nav>
        <Link to="/">Flowline</Link>
        {user ? (
          <div>
            <span data-testid="user-name">{user.name}</span>
            <button onClick={logout} data-testid="logout-button">
              ログアウト
            </button>
          </div>
        ) : (
          <div>
            <Link to="/login">ログイン</Link>
            <Link to="/register">新規登録</Link>
          </div>
        )}
      </nav>
    </header>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p>読み込み中...</p>
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function PublicHome() {
  const { user, loading } = useAuth()
  if (loading) return <p>読み込み中...</p>
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
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
            <Route path="/shared/:token" element={<SharedFlowPage />} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
