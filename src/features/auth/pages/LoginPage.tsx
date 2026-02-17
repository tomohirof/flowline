import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (email: string, password: string) => {
    setError(null)
    try {
      await login(email, password)
      navigate('/')
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
      } else {
        setError('エラーが発生しました')
      }
    }
  }

  return (
    <div data-testid="login-page">
      <h1>ログイン</h1>
      <LoginForm onSubmit={handleLogin} error={error} />
      <p>
        アカウントをお持ちでない方は <Link to="/register">新規登録</Link>
      </p>
    </div>
  )
}
