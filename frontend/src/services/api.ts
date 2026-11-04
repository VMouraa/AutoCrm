const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(public status: number, public details: unknown) {
    super(status === 401 || status === 403
      ? 'Acesso não autorizado. Verifique sua sessão e suas permissões.'
      : `Não foi possível consultar a API (HTTP ${status}).`)
    this.name = 'ApiError'
  }
}

// Somente leitura nesta etapa. Escritas futuras exigem token CSRF do Django.
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    const details: unknown = await response.json().catch(() => null)
    throw new ApiError(response.status, details)
  }
  return response.json() as Promise<T>
}
