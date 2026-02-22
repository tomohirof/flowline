import { useState, useEffect, useCallback, useContext, createContext, type ReactNode } from 'react'
import { apiFetch } from '../lib/api'

interface User {
  id: string
  email: string
  name: string
}

interface RegisterResult {
  needsVerification: true
  email: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, name: string) => Promise<RegisterResult>
  resendVerification: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User }>('/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(data.user)
    return data.user
  }

  const register = async (
    email: string,
    password: string,
    name: string,
  ): Promise<RegisterResult> => {
    await apiFetch<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
    return { needsVerification: true, email }
  }

  const resendVerification = async (email: string): Promise<void> => {
    await apiFetch('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext value={{ user, loading, login, register, resendVerification, logout }}>
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
