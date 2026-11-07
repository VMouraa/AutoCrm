import { describe, expect, it, vi } from 'vitest'
import { ConnectionError, SESSION_EXPIRED_EVENT, SessionExpiredError } from './api'
import { listStores } from './stores'
import type { Store } from '../types/api'

describe('consulta das lojas acessíveis', () => {
  it('retorna lojas e papéis usando GET com cookies na mesma origem', async () => {
    const stores: Store[] = [
      { id: 3, name: 'Loja A', role: 'manager' },
      { id: 7, name: 'Loja B', role: 'seller' },
    ]
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(stores)))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal

    await expect(listStores(signal)).resolves.toEqual(stores)

    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/stores/', expect.objectContaining({
      method: 'GET', credentials: 'same-origin', mode: 'same-origin', signal,
      headers: { Accept: 'application/json' },
    }))
  })

  it('retorna lista vazia quando o usuário não possui vínculos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]')))

    await expect(listStores()).resolves.toEqual([])
  })

  it('preserva o tratamento de sessão expirada do cliente HTTP', async () => {
    const expire = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: null, csrfToken: 'token' }))))

    try {
      await expect(listStores()).rejects.toBeInstanceOf(SessionExpiredError)
      expect(expire).toHaveBeenCalledOnce()
    } finally {
      window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
    }
  })

  it('preserva falhas de conexão e cancelamento', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetcher)
    await expect(listStores()).rejects.toBeInstanceOf(ConnectionError)

    const controller = new AbortController()
    controller.abort()
    const error = new DOMException('Aborted', 'AbortError')
    fetcher.mockRejectedValueOnce(error)
    await expect(listStores(controller.signal)).rejects.toBe(error)
  })
})
