import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RegisterForm } from '../components/RegisterForm'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../lib/api'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const handleRegister = async (email: string, password: string, name: string) => {
    setError(null)
    try {
      await register(email, password, name)
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
    <div data-testid="register-page">
      <h1>新規登録</h1>
      <RegisterForm onSubmit={handleRegister} error={error} />
      <p>
        既にアカウントをお持ちの方は <Link to="/login">ログイン</Link>
      </p>
    </div>
  )
}
