import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { InventoryPage } from '../pages/InventoryPage'
import type { Store, Vehicle, VehicleUpdateInput } from '../types/api'

const stores: Store[] = [
  { id: 2, name: 'Loja gerente', role: 'manager' },
  { id: 4, name: 'Loja vendedor', role: 'seller' },
  { id: 7, name: 'Outra gerenciada', role: 'manager' },
]
const session = { user: { id: 1, username: 'gerente' }, csrfToken: 'edit-csrf' }
const vehicle: Vehicle = {
  id: 10, store: 2, brand: 'Toyota', model: 'Corolla', trim: 'XEi', year: 2022,
  mileage: 45000, transmission: 'Automático', fuel: 'Flex', price: '119900.50',
  status: 'available', stock_type: 'owned', source: 'manual', external_id: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
const sellerVehicle: Vehicle = { ...vehicle, id: 20, store: 4, brand: 'Ford', model: 'Ka' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function setup(options: {
  stores?: Store[]; records?: Vehicle[]; pageSize?: number
  patch?: (data: VehicleUpdateInput) => Response | Promise<Response>
  failRefresh?: () => boolean
  sessionRequest?: () => Response
} = {}, fullApp = false) {
  let records = options.records ?? [vehicle, sellerVehicle]
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/stores/') return json(options.stores ?? stores)
    if (url === '/api/auth/session/') return options.sessionRequest?.() ?? json(session)
    if (url === '/api/vehicles/10/' && init?.method === 'PATCH') {
      const data = JSON.parse(String(init.body)) as VehicleUpdateInput
      if (options.patch) return options.patch(data)
      const updated = { ...records.find(item => item.id === 10)!, ...data }
      records = records.map(item => item.id === 10 ? updated : item)
      return json(updated)
    }
    if (url.startsWith('/api/vehicles/?')) {
      if (options.failRefresh?.()) return Promise.reject(new TypeError('offline'))
      const params = new URL(url, 'http://localhost').searchParams
      const filtered = records.filter(item =>
        (!params.get('brand') || item.brand === params.get('brand')) &&
        (!params.get('store') || String(item.store) === params.get('store')) &&
        (!params.get('status') || item.status === params.get('status')))
      const page = Number(params.get('page') || 1)
      const size = options.pageSize ?? 20
      if (page > 1 && (page - 1) * size >= filtered.length) return json({ detail: 'Página inválida.' }, 404)
      return json({ count: filtered.length, previous: page > 1 ? '/api/vehicles/?page=1' : null,
        next: page * size < filtered.length ? `/api/vehicles/?page=${page + 1}` : null,
        results: filtered.slice((page - 1) * size, page * size) })
    }
    throw new Error(`Unexpected request: ${url} ${init?.method}`)
  })
  vi.stubGlobal('fetch', fetcher)
  render(<StrictMode>{fullApp ? <MemoryRouter initialEntries={['/estoque']}><App /></MemoryRouter> : <InventoryPage />}</StrictMode>)
  return { fetcher, ui: userEvent.setup() }
}

async function openEdit() {
  await userEvent.click(await screen.findByRole('button', { name: 'Editar Toyota Corolla #10' }))
  expect(screen.getByRole('heading', { name: 'Editar veículo' })).toHaveFocus()
}

const patches = (fetcher: ReturnType<typeof setup>['fetcher']) => fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')

describe('edição de veículos no estoque', () => {
  it('preenche todos os campos, mantém a loja somente leitura e cancela sem escrita', async () => {
    const { fetcher, ui } = setup()
    await openEdit()
    for (const [label, value] of [['Marca', 'Toyota'], ['Modelo', 'Corolla'], ['Versão', 'XEi'],
      ['Câmbio', 'Automático'], ['Combustível', 'Flex'], ['Preço (R$)', '119900,50'],
      ['Status', 'available'], ['Tipo de estoque', 'owned']] as const) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveValue(value)
    }
    expect(screen.getByLabelText('Ano')).toHaveValue(2022)
    expect(screen.getByLabelText('Quilometragem (km)')).toHaveValue(45000)
    expect(screen.getByLabelText('Loja')).toHaveValue('Loja gerente')
    expect(screen.getByLabelText('Loja')).toHaveAttribute('readonly')
    expect(screen.queryByRole('option', { name: 'Outra gerenciada' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo veículo' })).toBeDisabled()
    await ui.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form', { name: 'Edição de veículo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Toyota Corolla #10' })).toHaveFocus()
    expect(patches(fetcher)).toHaveLength(0)
  })

  it('salva todos os campos editáveis por PATCH com cookies e CSRF, sem enviar loja ou campos imutáveis', async () => {
    const { fetcher, ui } = setup()
    await openEdit()
    for (const [label, value] of [['Marca', 'Honda'], ['Modelo', 'Civic'], ['Versão', 'Touring'], ['Ano', '2023'],
      ['Quilometragem (km)', '100'], ['Câmbio', 'CVT'], ['Combustível', 'Gasolina'], ['Preço (R$)', '120000,75']] as const) {
      const input = screen.getByLabelText(label, { exact: true })
      await ui.clear(input)
      await ui.type(input, value)
    }
    await ui.selectOptions(screen.getByLabelText('Status', { exact: true }), 'reserved')
    await ui.selectOptions(screen.getByLabelText('Tipo de estoque'), 'consignment')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('heading', { name: 'Honda Civic' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('atualizado com sucesso. Status: Reservado')
    expect(screen.queryByRole('form', { name: 'Edição de veículo' })).not.toBeInTheDocument()
    expect(patches(fetcher)).toEqual([['/api/vehicles/10/', expect.objectContaining({
      method: 'PATCH', credentials: 'same-origin', mode: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': 'edit-csrf' },
      body: JSON.stringify({ brand: 'Honda', model: 'Civic', trim: 'Touring', year: 2023, mileage: 100,
        transmission: 'CVT', fuel: 'Gasolina', price: '120000.75', status: 'reserved', stock_type: 'consignment' }),
    })]])
    expect(screen.getByRole('region', { name: 'Consulta de estoque' })).toHaveFocus()
  })

  it.each(['reserved', 'sold', 'available'] as const)('altera somente status para %s e mostra o resultado no card', async status => {
    const { fetcher, ui } = setup({ records: [{ ...vehicle, status: status === 'available' ? 'sold' : 'available' }] })
    await openEdit()
    await ui.selectOptions(screen.getByLabelText('Status', { exact: true }), status)
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await screen.findByText(/atualizado com sucesso/)
    const card = (await screen.findByRole('heading', { name: 'Toyota Corolla' })).closest('li')!
    expect(within(card).getByText({ reserved: 'Reservado', sold: 'Vendido', available: 'Disponível' }[status])).toBeVisible()
    expect(JSON.parse(String(patches(fetcher)[0][1]?.body))).toEqual({ status })
  })

  it('não envia PATCH sem alterações e valida os campos antes de salvar', async () => {
    const { fetcher, ui } = setup()
    await openEdit()
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nenhuma alteração para salvar')
    await ui.clear(screen.getByLabelText('Marca', { exact: true }))
    await ui.clear(screen.getByLabelText('Preço (R$)'))
    await ui.type(screen.getByLabelText('Preço (R$)'), '0')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha este campo')
    expect(screen.getByRole('alert')).toHaveTextContent('preço positivo')
    expect(patches(fetcher)).toHaveLength(0)
  })

  it('apresenta validação da API sem perder valores e permite corrigir e salvar', async () => {
    let first = true
    const { fetcher, ui } = setup({ patch: data => {
      if (first) { first = false; return json({ price: ['Preço inválido.'], non_field_errors: ['Revise os dados.'] }, 400) }
      return json({ ...vehicle, ...data })
    } })
    await openEdit()
    await ui.clear(screen.getByLabelText('Preço (R$)'))
    await ui.type(screen.getByLabelText('Preço (R$)'), '100,25')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revise os dados.')
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(screen.getByLabelText('Preço (R$)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Preço (R$)')).toHaveValue('100,25')
    await ui.clear(screen.getByLabelText('Preço (R$)'))
    await ui.type(screen.getByLabelText('Preço (R$)'), '200,75')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText(/atualizado com sucesso/)).toBeVisible()
    expect(patches(fetcher)).toHaveLength(2)
  })

  it.each(['network', 'server', 'forbidden', 'not_found'])('preserva edição e não repete PATCH após erro %s', async kind => {
    const { fetcher, ui } = setup({ patch: () => {
      if (kind === 'network') return Promise.reject(new TypeError('offline'))
      if (kind === 'server') return new Response('<h1>Unavailable</h1>', { status: 503 })
      return json({ detail: 'Somente gerentes podem alterar este veículo.' }, kind === 'forbidden' ? 403 : 404)
    } }, true)
    await openEdit()
    await ui.selectOptions(screen.getByLabelText('Status', { exact: true }), 'sold')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(kind === 'forbidden' ? 'Somente gerentes' : kind === 'not_found' ? 'não está mais disponível' : 'a atualização pode ter sido gravada')
    expect(screen.getByLabelText('Status', { exact: true })).toHaveValue('sold')
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled()
    expect(screen.queryByText(/atualizado com sucesso/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Usuário')).not.toBeInTheDocument()
    expect(patches(fetcher)).toHaveLength(1)
  })

  it('oculta edição na loja seller mesmo quando o usuário é manager em outra loja', async () => {
    setup()
    expect(await screen.findByRole('button', { name: 'Editar Toyota Corolla #10' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Editar Ford Ka #20' })).not.toBeInTheDocument()
  })

  it.each([{ accessible: stores.map(store => ({ ...store, role: 'seller' as const })) }, { accessible: [] }])('não oferece edição sem papel manager: $accessible', async ({ accessible }) => {
    const { fetcher } = setup({ stores: accessible })
    await screen.findByText('O cadastro de veículos está disponível somente para gerentes de uma loja.')
    expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument()
    expect(patches(fetcher)).toHaveLength(0)
  })

  it('bloqueia envios duplicados, alterações de contexto e cancelamento durante o salvamento', async () => {
    let finish!: (response: Response) => void
    const { fetcher } = setup({ patch: () => new Promise(resolve => { finish = resolve }) })
    await openEdit()
    await userEvent.selectOptions(screen.getByLabelText('Status', { exact: true }), 'sold')
    const form = screen.getByRole('form', { name: 'Edição de veículo' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(patches(fetcher)).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Novo veículo' })).toBeDisabled()
    expect(screen.getByLabelText('Modelo')).toBeDisabled()
    finish(json({ ...vehicle, status: 'sold' }))
    expect(await screen.findByText(/atualizado com sucesso/)).toBeVisible()
  })

  it('preserva filtros e página 2 ao salvar e recarrega os dados do servidor', async () => {
    const { fetcher, ui } = setup({ records: [{ ...vehicle, id: 11, model: 'Hilux' }, vehicle], pageSize: 1 })
    await ui.type(screen.getByLabelText('Marca exata'), 'Toyota')
    await ui.type(screen.getByLabelText('ID da loja'), '2')
    await ui.selectOptions(screen.getByLabelText('Disponibilidade'), 'available')
    await ui.click(screen.getByRole('button', { name: 'Filtrar estoque' }))
    await ui.click(await screen.findByRole('button', { name: 'Próxima' }))
    await openEdit()
    await ui.clear(screen.getByLabelText('Versão'))
    await ui.type(screen.getByLabelText('Versão'), 'GLi')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('GLi')).toBeVisible()
    expect(screen.getByText(/Página 2/)).toBeVisible()
    expect(screen.getByLabelText('Marca exata')).toHaveValue('Toyota')
    expect(screen.getByLabelText('ID da loja')).toHaveValue(2)
    expect(screen.getByLabelText('Disponibilidade')).toHaveValue('available')
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/api/vehicles/?page=2&brand=Toyota&store=2&status=available')
  })

  it('remove veículo que deixou de atender o filtro de status sem limpar o filtro', async () => {
    const { ui } = setup({ records: [vehicle] })
    await ui.selectOptions(screen.getByLabelText('Disponibilidade'), 'available')
    await ui.click(screen.getByRole('button', { name: 'Filtrar estoque' }))
    await openEdit()
    await ui.selectOptions(screen.getByLabelText('Status', { exact: true }), 'sold')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('heading', { name: 'Nenhum veículo encontrado' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Status: Vendido')
    expect(screen.getByLabelText('Disponibilidade')).toHaveValue('available')
  })

  it('recua à página anterior se editar o último item invalidar a página atual', async () => {
    const { ui } = setup({ records: [{ ...vehicle, id: 11, model: 'Hilux' }, vehicle], pageSize: 1 })
    await ui.selectOptions(screen.getByLabelText('Disponibilidade'), 'available')
    await ui.click(screen.getByRole('button', { name: 'Filtrar estoque' }))
    await ui.click(await screen.findByRole('button', { name: 'Próxima' }))
    await openEdit()
    await ui.selectOptions(screen.getByLabelText('Status', { exact: true }), 'sold')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('heading', { name: 'Toyota Hilux' })).toBeVisible()
    expect(screen.getByText(/Página 1/)).toBeVisible()
    expect(screen.getByLabelText('Disponibilidade')).toHaveValue('available')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mantém confirmação se o GET falhar após salvar e repete somente a consulta', async () => {
    let offline = false
    const { fetcher, ui } = setup({ patch: data => { offline = true; return json({ ...vehicle, ...data }) }, failRefresh: () => offline })
    await openEdit()
    await ui.selectOptions(screen.getByLabelText('Status', { exact: true }), 'sold')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    expect(screen.getByRole('status')).toHaveTextContent('atualizado com sucesso')
    offline = false
    await ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByRole('heading', { name: 'Toyota Corolla' })
    expect(patches(fetcher)).toHaveLength(1)
  })

  it('solicita login se a sessão expirar durante o PATCH', async () => {
    let expired = false
    const { ui } = setup({ patch: () => { expired = true; return json({}, 403) },
      sessionRequest: () => json(expired ? { ...session, user: null } : session) }, true)
    await openEdit()
    await ui.selectOptions(screen.getByLabelText('Status', { exact: true }), 'sold')
    await ui.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou')
    expect(screen.queryByRole('form', { name: 'Edição de veículo' })).not.toBeInTheDocument()
  })
})
