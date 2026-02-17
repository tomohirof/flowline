import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { useAuth } from './hooks/useAuth'
import './App.css'

function Header() {
  const { user, loading, logout } = useAuth()

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
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Dashboard() {
  return (
    <div data-testid="dashboard">
      <h1>ダッシュボード</h1>
      <p>ようこそ！（実装予定）</p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Header />
      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
