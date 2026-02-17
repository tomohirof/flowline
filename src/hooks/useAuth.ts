import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'

interface User {
  id: string
  email: string
  name: string
}

export function useAuth() {
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

  const register = async (email: string, password: string, name: string) => {
    const data = await apiFetch<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return { user, loading, login, register, logout }
}
