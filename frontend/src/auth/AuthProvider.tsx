import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './context'
import type { AuthState } from './context'
import { getSession, login, logout } from '../services/auth'
import { SESSION_EXPIRED_EVENT } from '../services/api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getSession(controller.signal).then(session => {
      if (!controller.signal.aborted) setState(session.user
        ? { status: 'authenticated', user: session.user }
        : { status: 'anonymous', expired: false })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Não foi possível consultar sua sessão.' })
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    const expire = () => setState({ status: 'anonymous', expired: true })
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
  }, [])

  async function signIn(username: string, password: string) {
    const session = await login(username, password)
    if (!session.user) throw new Error('O serviço não confirmou a autenticação.')
    setState({ status: 'authenticated', user: session.user })
  }

  async function signOut() {
    await logout()
    setState({ status: 'anonymous', expired: false })
  }

  function retry() {
    setState({ status: 'loading' })
    setAttempt(value => value + 1)
  }

  return <AuthContext.Provider value={{ state, retry, signIn, signOut }}>{children}</AuthContext.Provider>
}
