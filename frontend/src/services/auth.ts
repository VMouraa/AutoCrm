import { apiRequest } from './api'
import type { Session } from '../types/api'

export function getSession(signal?: AbortSignal) {
  return apiRequest<Session>('auth/session/', { signal, checkSession: false })
}

export function login(username: string, password: string) {
  return apiRequest<Session>('auth/login/', {
    method: 'POST', body: { username, password }, checkSession: false,
  })
}

export function logout() {
  return apiRequest<Session>('auth/logout/', { method: 'POST', checkSession: false })
}
