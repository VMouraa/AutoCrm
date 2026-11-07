import type { Session } from '../types/api'

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
// Session cookies and CSRF tokens must stay on the frontend's origin.
if (!/^\/(?!\/)[\w/-]*$/.test(baseUrl)) {
  throw new Error('VITE_API_BASE_URL deve ser um caminho na mesma origem, como /api.')
}

export const SESSION_EXPIRED_EVENT = 'autocrm:session-expired'

export class ApiError extends Error {
  constructor(public status: number, public details: unknown) {
    super(status === 401 ? 'Usuário ou senha inválidos.'
      : status === 403 ? 'Acesso negado. Verifique suas permissões ou atualize a página para renovar a proteção CSRF.'
      : status >= 500 ? 'Não foi possível conectar ao serviço. Verifique se o Django está em execução e tente novamente.'
      : `Não foi possível concluir a solicitação (HTTP ${status}).`)
    this.name = 'ApiError'
  }
}

export class ConnectionError extends Error {
  constructor() {
    super('Não foi possível conectar ao serviço. Verifique sua conexão e se o Django está em execução.')
    this.name = 'ConnectionError'
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Sua sessão expirou. Entre novamente para continuar.')
    this.name = 'SessionExpiredError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Invalid credentials must not be interpreted as session expiry. */
  checkSession?: boolean
}

export async function apiRequest<T>(path: string, {
  method = 'GET', body, signal, checkSession = true,
}: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') {
    // Login in another tab can rotate the secret; read a fresh token per write.
    const session = await apiRequest<Session>('auth/session/', { signal, checkSession: false })
    headers['X-CSRFToken'] = session.csrfToken
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
      method, credentials: 'same-origin', mode: 'same-origin', headers,
      body: body === undefined ? undefined : JSON.stringify(body), signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ConnectionError()
  }
  if (!response.ok) {
    const details: unknown = await response.json().catch(() => null)
    if (checkSession && (response.status === 401 || response.status === 403)) {
      // DRF returns 403 for both missing sessions and denied permissions.
      const session = await apiRequest<Session>('auth/session/', { signal, checkSession: false })
      if (!session.user) {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
        throw new SessionExpiredError()
      }
    }
    throw new ApiError(response.status, details)
  }
  if (response.status === 204) return undefined as T
  try {
    return await response.json() as T
  } catch {
    throw new Error('O serviço retornou uma resposta inválida. Verifique a configuração da API.')
  }
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(path, { signal })
}
