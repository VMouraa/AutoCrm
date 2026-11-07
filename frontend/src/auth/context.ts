import { createContext, useContext } from 'react'
import type { SessionUser } from '../types/api'

export type AuthState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'anonymous'; expired: boolean }
  | { status: 'authenticated'; user: SessionUser }

interface AuthContextValue {
  state: AuthState
  retry: () => void
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth requer AuthProvider.')
  return context
}
