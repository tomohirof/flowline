import { useState, type FormEvent } from 'react'

interface Props {
  onSubmit: (email: string, password: string, name: string) => Promise<void>
  error: string | null
}

export function RegisterForm({ onSubmit, error }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(email, password, name)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="register-form">
      <div>
        <label htmlFor="name">名前</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          data-testid="name-input"
        />
      </div>
      <div>
        <label htmlFor="email">メールアドレス</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          data-testid="email-input"
        />
      </div>
      <div>
        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          data-testid="password-input"
        />
      </div>
      {error && (
        <p role="alert" data-testid="error-message">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} data-testid="submit-button">
        {submitting ? '登録中...' : 'アカウント作成'}
      </button>
    </form>
  )
}
