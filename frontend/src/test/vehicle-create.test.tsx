import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { InventoryPage } from '../pages/InventoryPage'
import type { Store, Vehicle } from '../types/api'

const stores: Store[] = [
  { id: 2, name: 'Loja gerente A', role: 'manager' },
  { id: 4, name: 'Loja vendedor', role: 'seller' },
  { id: 7, name: 'Loja gerente B', role: 'manager' },
]
const session = { user: { id: 1, username: 'gerente' }, csrfToken: 'fresh-csrf' }
const vehicle: Vehicle = {
  id: 1, store: 7, brand: 'Toyota', model: 'Corolla', trim: '', year: 2022, mileage: 0,
  transmission: '', fuel: '', price: '119900.50', status: 'available', stock_type: 'owned',
  source: 'manual', external_id: null, created_at: '', updated_at: '',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const inventory = (results: Vehicle[] = []) => ({ count: results.length, next: null, previous: null, results })

function setup(options: {
  stores?: Store[]
  post?: () => Response | Promise<Response>
  storeRequest?: () => Response | Promise<Response>
  getVehicles?: () => Response | Promise<Response>
  sessionRequest?: () => Response
} = {}, fullApp = false) {
  let saved = false
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/stores/') return options.storeRequest?.() ?? json(options.stores ?? stores)
    if (url === '/api/auth/session/') return options.sessionRequest?.() ?? json(session)
    if (url === '/api/vehicles/' && init?.method === 'POST') {
      if (options.post) return options.post()
      saved = true
      return json(vehicle, 201)
    }
    if (url.startsWith('/api/vehicles/?')) return options.getVehicles?.() ?? json(inventory(saved ? [vehicle] : []))
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetcher)
  render(<StrictMode>{fullApp ? <MemoryRouter initialEntries={['/estoque']}><App /></MemoryRouter> : <InventoryPage />}</StrictMode>)
  return { fetcher, ui: userEvent.setup() }
}

async function openForm() {
  await userEvent.click(await screen.findByRole('button', { name: 'Novo veículo' }))
  expect(screen.getByRole('heading', { name: 'Novo veículo' })).toHaveFocus()
}

async function fillRequired() {
  const ui = userEvent.setup()
  await ui.selectOptions(screen.getByLabelText('Loja'), '7')
  await ui.type(screen.getByLabelText('Marca', { exact: true }), ' Toyota ')
  await ui.type(screen.getByLabelText('Modelo'), 'Corolla')
  await ui.type(screen.getByLabelText('Ano'), '2022')
  await ui.type(screen.getByLabelText('Quilometragem (km)'), '0')
  await ui.type(screen.getByLabelText('Preço (R$)'), '119900,50')
}

const posts = (fetcher: ReturnType<typeof setup>['fetcher']) => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')

describe('cadastro de veículos no estoque', () => {
  it('envia campos opcionais, enums e CSRF; limpa filtros, atualiza o estoque e confirma', async () => {
    const { fetcher, ui } = setup()
    await ui.type(screen.getByLabelText('Marca exata'), 'Ford')
    await ui.click(screen.getByRole('button', { name: 'Filtrar estoque' }))
    await openForm()
    expect(within(screen.getByLabelText('Loja')).queryByRole('option', { name: 'Loja vendedor' })).not.toBeInTheDocument()
    await fillRequired()
    await ui.type(screen.getByLabelText('Versão'), 'XEi')
    await ui.type(screen.getByLabelText('Câmbio'), 'Automático')
    await ui.type(screen.getByLabelText('Combustível'), 'Flex')
    await ui.selectOptions(screen.getByLabelText('Status', { exact: true }), 'reserved')
    await ui.selectOptions(screen.getByLabelText('Tipo de estoque'), 'consignment')
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('cadastrado com sucesso')
    expect(screen.queryByRole('form', { name: 'Cadastro de veículo' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Marca exata')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Novo veículo' })).toHaveFocus()
    expect(posts(fetcher)).toHaveLength(1)
    expect(posts(fetcher)[0]).toEqual(['/api/vehicles/', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', mode: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': 'fresh-csrf' },
      body: JSON.stringify({ store: 7, brand: 'Toyota', model: 'Corolla', trim: 'XEi', year: 2022, mileage: 0,
        transmission: 'Automático', fuel: 'Flex', price: '119900.50', status: 'reserved', stock_type: 'consignment' }),
    })])
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/api/vehicles/?page=1')
  })

  it('aceita opcionais vazios e usa os padrões do backend', async () => {
    const { fetcher, ui } = setup()
    await openForm()
    await fillRequired()
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    await screen.findByText(/cadastrado com sucesso/)
    expect(JSON.parse(String(posts(fetcher)[0][1]?.body))).toMatchObject({ trim: '', transmission: '', fuel: '', status: 'available', stock_type: 'owned' })
  })

  it.each([{ accessible: stores.filter(store => store.role === 'seller') }, { accessible: [] }])('oculta cadastro sem lojas gerenciadas: $accessible', async ({ accessible }) => {
    const { fetcher } = setup({ stores: accessible })
    await screen.findByText('O cadastro de veículos está disponível somente para gerentes de uma loja.')
    expect(screen.queryByRole('button', { name: 'Novo veículo' })).not.toBeInTheDocument()
    expect(posts(fetcher)).toHaveLength(0)
  })

  it('pré-seleciona a única loja gerenciada e cancela sem enviar', async () => {
    const { fetcher, ui } = setup({ stores: stores.slice(0, 2) })
    await openForm()
    expect(screen.getByLabelText('Loja')).toHaveValue('2')
    await ui.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form', { name: 'Cadastro de veículo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo veículo' })).toHaveFocus()
    expect(posts(fetcher)).toHaveLength(0)
  })

  it('valida campos obrigatórios e valores antes de enviar', async () => {
    const { fetcher, ui } = setup()
    await openForm()
    await ui.type(screen.getByLabelText('Marca', { exact: true }), '   ')
    await ui.type(screen.getByLabelText('Ano'), '1899')
    await ui.type(screen.getByLabelText('Quilometragem (km)'), '-1')
    await ui.type(screen.getByLabelText('Preço (R$)'), '0')
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveFocus()
    expect(alert).toHaveTextContent('Selecione uma loja em que você é gerente')
    expect(alert).toHaveTextContent('Preencha este campo')
    expect(alert).toHaveTextContent('Informe um ano entre 1900')
    expect(alert).toHaveTextContent('quilometragem inteira')
    expect(alert).toHaveTextContent('preço positivo')
    expect(posts(fetcher)).toHaveLength(0)
  })

  it.each(['1.234,56', '10,123', '10000000000', 'NaN'])('rejeita preço inválido %s sem arredondar', async price => {
    const { fetcher, ui } = setup()
    await openForm()
    await fillRequired()
    await ui.clear(screen.getByLabelText('Preço (R$)'))
    await ui.type(screen.getByLabelText('Preço (R$)'), price)
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um preço positivo')
    expect(posts(fetcher)).toHaveLength(0)
  })

  it('mostra erros de campo, de loja e gerais da API, preservando os dados para correção', async () => {
    const { ui } = setup({ post: () => json({ price: ['Preço inválido.'], store: 'Loja inválida.', non_field_errors: ['Revise o cadastro.'] }, 400) })
    await openForm()
    await fillRequired()
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Revise o cadastro.')
    expect(alert).toHaveTextContent('Preço inválido.')
    expect(alert).toHaveTextContent('Loja inválida.')
    expect(screen.getByLabelText('Preço (R$)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Modelo')).toHaveValue('Corolla')
    expect(screen.getByRole('button', { name: 'Cadastrar veículo' })).toBeEnabled()
  })

  it('respeita 403 após revogação da permissão e mantém a sessão válida', async () => {
    const { ui } = setup({ post: () => json({ detail: 'Somente gerentes desta loja podem cadastrar veículos.' }, 403) }, true)
    await openForm()
    await fillRequired()
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Somente gerentes desta loja')
    expect(screen.queryByLabelText('Usuário')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Modelo')).toHaveValue('Corolla')
    expect(screen.queryByText(/cadastrado com sucesso/)).not.toBeInTheDocument()
  })

  it('retorna ao login se a sessão expira durante o cadastro', async () => {
    let expired = false
    const { ui } = setup({ post: () => { expired = true; return json({}, 403) },
      sessionRequest: () => json(expired ? { ...session, user: null } : session) }, true)
    await openForm()
    await fillRequired()
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    expect(await screen.findByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou')
    expect(screen.queryByRole('form', { name: 'Cadastro de veículo' })).not.toBeInTheDocument()
  })

  it.each(['network', 'server'])('trata falha %s sem perder dados ou repetir o POST automaticamente', async kind => {
    const { fetcher, ui } = setup({ post: () => kind === 'network' ? Promise.reject(new TypeError('Failed to fetch')) : new Response('<h1>Unavailable</h1>', { status: 503 }) })
    await openForm()
    await fillRequired()
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique o estoque antes de tentar novamente')
    expect(screen.getByLabelText('Modelo')).toHaveValue('Corolla')
    expect(posts(fetcher)).toHaveLength(1)
  })

  it('bloqueia submissões duplicadas e desabilita campos e cancelamento durante o envio', async () => {
    let finish!: (response: Response) => void
    const { fetcher } = setup({ post: () => new Promise(resolve => { finish = resolve }) })
    await openForm()
    await fillRequired()
    const form = screen.getByRole('form', { name: 'Cadastro de veículo' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(posts(fetcher)).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Cadastrando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByLabelText('Modelo')).toBeDisabled()
    finish(json(vehicle, 201))
    expect(await screen.findByText(/cadastrado com sucesso/)).toBeVisible()
  })

  it('permite recuperar falha no GET de lojas sem bloquear a consulta do estoque', async () => {
    let offline = true
    const { ui } = setup({ storeRequest: () => offline ? Promise.reject(new TypeError('offline')) : json(stores) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível verificar as lojas')
    expect(await screen.findByRole('heading', { name: 'Nenhum veículo encontrado' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Novo veículo' })).not.toBeInTheDocument()
    offline = false
    await ui.click(screen.getByRole('button', { name: 'Tentar carregar lojas novamente' }))
    expect(await screen.findByRole('button', { name: 'Novo veículo' })).toBeVisible()
  })

  it('mantém confirmação e permite repetir somente o GET se a atualização do estoque falhar', async () => {
    let fail = false
    const { fetcher, ui } = setup({ post: () => { fail = true; return json(vehicle, 201) },
      getVehicles: () => fail ? Promise.reject(new TypeError('offline')) : json(inventory([vehicle])) })
    await openForm()
    await fillRequired()
    await ui.click(screen.getByRole('button', { name: 'Cadastrar veículo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    expect(screen.getByRole('status')).toHaveTextContent('cadastrado com sucesso')
    fail = false
    await ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeVisible()
    expect(posts(fetcher)).toHaveLength(1)
  })
})
