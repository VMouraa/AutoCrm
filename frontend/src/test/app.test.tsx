import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { Session, Vehicle } from '../types/api'

const user = { id: 7, username: 'operador' }
const authenticated: Session = { user, csrfToken: 'test-csrf' }
const anonymous: Session = { user: null, csrfToken: 'anonymous-csrf' }
// Fixtures are only used in automated tests; application data always comes from Django.
const vehicle: Vehicle = {
  id: 32, store: 2, brand: 'Toyota', model: 'Corolla', trim: 'XEi', year: 2022,
  mileage: 45000, transmission: 'Automático', fuel: 'Flex', price: '119900.00',
  status: 'available', stock_type: 'owned', source: 'manual', external_id: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const inventory = (results: Vehicle[] = [vehicle], extra = {}) => ({ count: results.length, next: null, previous: null, results, ...extra })

function mockApi(handler: (url: string, options?: RequestInit) => Response | Promise<Response>) {
  const fetcher = vi.fn((url: string, options?: RequestInit) => handler(url, options))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

function mount() {
  return render(<StrictMode><MemoryRouter initialEntries={['/estoque']}><App /></MemoryRouter></StrictMode>)
}

describe('sessão e proteção das rotas', () => {
  it('protege estoque, autentica e sai usando CSRF sem persistir credenciais', async () => {
    let session = anonymous
    const fetcher = mockApi((url, options) => {
      if (url.endsWith('session/')) return json(session)
      if (url.endsWith('login/')) { session = authenticated; return json(session) }
      if (url.endsWith('logout/')) { session = anonymous; return json(session) }
      if (url.startsWith('/api/vehicles/')) return json(inventory())
      throw new Error(`Unexpected request: ${url} ${options?.method}`)
    })
    const ui = userEvent.setup()
    mount()
    expect(await screen.findByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
    expect(fetcher.mock.calls.some(([url]) => url.startsWith('/api/vehicles/'))).toBe(false)
    await ui.type(screen.getByLabelText('Usuário'), 'operador')
    await ui.type(screen.getByLabelText('Senha'), 'password')
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeVisible()
    const loginCall = fetcher.mock.calls.find(([url]) => url.endsWith('login/'))!
    expect(loginCall[1]).toMatchObject({ method: 'POST', headers: { 'X-CSRFToken': 'anonymous-csrf' } })
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    await ui.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Toyota Corolla' })).not.toBeInTheDocument()
    const logoutCall = fetcher.mock.calls.find(([url]) => url.endsWith('logout/'))!
    expect(logoutCall[1]).toMatchObject({ method: 'POST', headers: { 'X-CSRFToken': 'test-csrf' } })
  })

  it('informa credenciais inválidas e limpa a senha', async () => {
    mockApi(url => url.endsWith('login/') ? json({ detail: 'Inválido' }, 401) : json(anonymous))
    const ui = userEvent.setup()
    mount()
    await ui.type(await screen.findByLabelText('Usuário'), 'operador')
    await ui.type(screen.getByLabelText('Senha'), 'wrong-password')
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha inválidos')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
  })

  it('permite tentar novamente quando a consulta inicial de sessão falha', async () => {
    let offline = true
    mockApi(() => {
      if (offline) return Promise.reject(new TypeError('Network error'))
      return json(anonymous)
    })
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    offline = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByLabelText('Usuário')).toBeVisible()
  })

  it('remove os dados protegidos e pede novo login quando a sessão expira', async () => {
    let expired = false
    mockApi(url => {
      if (url.endsWith('session/')) return json(expired ? anonymous : authenticated)
      return expired ? json({}, 403) : json(inventory())
    })
    mount()
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeVisible()
    expired = true
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar estoque' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sua sessão expirou')
    expect(screen.queryByRole('heading', { name: 'Toyota Corolla' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Usuário')).toBeVisible()
  })

  it('mantém o usuário na tela e informa falha de logout', async () => {
    mockApi(url => url.endsWith('logout/') ? json({}, 503) : json(url.endsWith('session/') ? authenticated : inventory()))
    mount()
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled()
  })
})

describe('estoque real paginado', () => {
  it('mostra carregamento, campos do serializer e paginação DRF sem seguir URLs de outro host', async () => {
    let resolveInventory!: (response: Response) => void
    mockApi(url => {
      if (url.endsWith('session/')) return json(authenticated)
      if (url.includes('page=2')) return json(inventory([{ ...vehicle, id: 33, model: 'Hilux' }], { count: 21, previous: 'http://127.0.0.1:8000/api/vehicles/', next: null }))
      return new Promise(resolve => { resolveInventory = resolve })
    })
    mount()
    expect(await screen.findByRole('status')).toHaveTextContent(/Verificando sua sessão|Carregando veículos/)
    await waitFor(() => expect(resolveInventory).toBeTypeOf('function'))
    resolveInventory(json(inventory([vehicle], { count: 21, next: 'http://127.0.0.1:8000/api/vehicles/?page=2' })))
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeVisible()
    expect(screen.getByText(/119\.900,00/)).toBeVisible()
    expect(screen.getByText('45.000 km')).toBeVisible()
    expect(screen.getByText('#2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(await screen.findByRole('heading', { name: 'Toyota Hilux' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
    expect(screen.getByText(/Página 2/)).toBeVisible()
  })

  it('mostra vazio apenas após resposta bem-sucedida', async () => {
    mockApi(url => json(url.endsWith('session/') ? authenticated : inventory([])))
    mount()
    expect(await screen.findByRole('heading', { name: 'Nenhum veículo encontrado' })).toBeVisible()
    expect(screen.queryByText('Aguardando integração')).not.toBeInTheDocument()
  })

  it.each(['network', 'server', 'forbidden'])('mostra erro %s sem confundir com estoque vazio e permite repetir', async kind => {
    let fail = true
    mockApi(url => {
      if (url.endsWith('session/')) return json(authenticated)
      if (fail) {
        if (kind === 'network') return Promise.reject(new TypeError('Failed to fetch'))
        return json({}, kind === 'forbidden' ? 403 : 500)
      }
      return json(inventory())
    })
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent(kind === 'forbidden' ? 'Acesso negado' : 'Não foi possível conectar')
    expect(screen.queryByRole('heading', { name: 'Nenhum veículo encontrado' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Usuário')).not.toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeVisible()
  })

  it('envia filtros do backend e volta à primeira página', async () => {
    const fetcher = mockApi(url => json(url.endsWith('session/') ? authenticated : inventory([vehicle], { next: '/api/vehicles/?page=2' })))
    const ui = userEvent.setup()
    mount()
    await ui.click(await screen.findByRole('button', { name: 'Próxima' }))
    expect(await screen.findByText(/Página 2/)).toBeVisible()
    await ui.type(screen.getByLabelText('Marca exata'), 'Toyota')
    await ui.type(screen.getByLabelText('ID da loja'), '2')
    await ui.selectOptions(screen.getByLabelText('Disponibilidade'), 'available')
    await ui.click(screen.getByRole('button', { name: 'Filtrar estoque' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/vehicles/?page=1&brand=Toyota&store=2&status=available', expect.anything()))
    expect(await screen.findByText(/Página 1/)).toBeVisible()
  })
})
