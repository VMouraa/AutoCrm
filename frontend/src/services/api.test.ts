import { describe, expect, it, vi } from 'vitest'
import { apiGet, apiRequest, ApiError, ConnectionError, SESSION_EXPIRED_EVENT, SessionExpiredError } from './api'
import { login, logout } from './auth'

const user = { id: 1, username: 'operador' }
const session = { user, csrfToken: 'fresh-token' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('cliente HTTP e autenticação', () => {
  it('envia cookies na mesma origem e respeita cancelamento', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ count: 0, results: [] }))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    await apiGet('vehicles/', signal)
    expect(fetcher).toHaveBeenCalledWith('/api/vehicles/', expect.objectContaining({ credentials: 'same-origin', mode: 'same-origin', signal }))
  })

  it('obtém CSRF antes do login e renova o token antes do logout', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ user: null, csrfToken: 'before-login' }))
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({ ...session, csrfToken: 'after-login' }))
      .mockResolvedValueOnce(json({ user: null, csrfToken: 'logged-out' }))
    vi.stubGlobal('fetch', fetcher)
    await login('operador', 'password')
    await logout()
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/auth/session/', '/api/auth/login/', '/api/auth/session/', '/api/auth/logout/'])
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: { 'X-CSRFToken': 'before-login', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'operador', password: 'password' }) })
    expect(fetcher.mock.calls[3][1]).toMatchObject({ headers: { 'X-CSRFToken': 'after-login' } })
  })

  it('não trata senha inválida como sessão expirada', async () => {
    const expire = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(session)).mockResolvedValueOnce(json({ detail: 'Inválido' }, 401)))
    await expect(login('operador', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Usuário ou senha inválidos.' })
    expect(expire).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
  })

  it.each([401, 403])('verifica sessão ao receber HTTP %i e notifica expiração', async status => {
    const expire = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({}, status)).mockResolvedValueOnce(json({ user: null, csrfToken: 'token' })))
    await expect(apiGet('vehicles/')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(expire).toHaveBeenCalledOnce()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
  })

  it('mantém a sessão quando 403 é falta de permissão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ detail: 'Sem permissão' }, 403)).mockResolvedValueOnce(json(session)))
    await expect(apiGet('vehicles/')).rejects.toMatchObject({ status: 403, details: { detail: 'Sem permissão' } })
  })

  it('transforma falhas de rede em mensagem útil', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(apiGet('vehicles/')).rejects.toBeInstanceOf(ConnectionError)
  })

  it('preserva cancelamento de requisições', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
    await expect(apiGet('vehicles/', controller.signal)).rejects.toBe(error)
  })

  it('trata proxy indisponível com resposta HTML sem falha de parsing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<h1>Bad Gateway</h1>', { status: 502 })))
    await expect(apiGet('vehicles/')).rejects.toMatchObject({ status: 502, details: null })
  })

  it('reporta resposta JSON inválida e aceita resposta vazia 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('<html>')).mockResolvedValueOnce(json(session)).mockResolvedValueOnce(new Response(null, { status: 204 })))
    await expect(apiGet('vehicles/')).rejects.toThrow('resposta inválida')
    await expect(apiRequest('vehicles/1/', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('mantém erros de validação disponíveis para o chamador', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ store: ['ID inválido'] }, 400)))
    await expect(apiGet('vehicles/?store=invalid')).rejects.toBeInstanceOf(ApiError)
  })
})
