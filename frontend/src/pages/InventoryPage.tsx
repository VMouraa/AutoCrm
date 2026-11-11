import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CarFront } from 'lucide-react'
import { PageHeading } from '../components/PageHeading'
import { EmptyState } from '../components/EmptyState'
import { VehicleForm } from '../components/VehicleForm'
import { ApiError } from '../services/api'
import { listVehicles } from '../services/vehicles'
import { listStores } from '../services/stores'
import type { PaginatedResponse, Store, Vehicle } from '../types/api'

const statusLabels: Record<Vehicle['status'], string> = { available: 'Disponível', reserved: 'Reservado', sold: 'Vendido' }
const statusStyles: Record<Vehicle['status'], string> = { available: 'bg-blue-50 text-brand', reserved: 'bg-amber-50 text-amber-900', sold: 'bg-slate-100 text-slate-700' }
const stockLabels: Record<Vehicle['stock_type'], string> = { owned: 'Próprio', consignment: 'Consignado', wholesale: 'Repasse' }
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR')

interface InventoryQuery {
  page: number
  brand?: string
  store?: number
  status?: Vehicle['status']
}

export function InventoryPage() {
  const [stores, setStores] = useState<Store[] | null>(null)
  const [storesError, setStoresError] = useState('')
  const [storesAttempt, setStoresAttempt] = useState(0)
  const [editor, setEditor] = useState<{ kind: 'create' } | { kind: 'edit'; vehicle: Vehicle } | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const editorTrigger = useRef<HTMLButtonElement | null>(null)
  const inventorySection = useRef<HTMLElement>(null)
  const filters = useRef<HTMLFormElement>(null)
  const [query, setQuery] = useState<InventoryQuery>({ page: 1 })
  const [result, setResult] = useState<{
    query: InventoryQuery; data?: PaginatedResponse<Vehicle>; error?: string
  } | null>(null)
  const current = result?.query === query ? result : null
  const loading = current === null
  const data = current?.data

  useEffect(() => {
    const controller = new AbortController()
    listStores(controller.signal).then(data => {
      if (!controller.signal.aborted) setStores(data)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setStoresError(error instanceof Error ? error.message : 'Não foi possível carregar as lojas.')
    })
    return () => controller.abort()
  }, [storesAttempt])

  useEffect(() => {
    if (!editor && editorTrigger.current) {
      const target = editorTrigger.current.isConnected ? editorTrigger.current : inventorySection.current
      target?.focus()
      editorTrigger.current = null
    }
  }, [editor])

  function created(vehicle: Vehicle) {
    setEditor(null)
    setConfirmation(`${vehicle.brand} ${vehicle.model} cadastrado com sucesso. Os filtros foram limpos para atualizar o estoque.`)
    filters.current?.reset()
    setQuery({ page: 1 })
  }

  function updated(vehicle: Vehicle) {
    setEditor(null)
    setConfirmation(`${vehicle.brand} ${vehicle.model} atualizado com sucesso. Status: ${statusLabels[vehicle.status]}. Os filtros foram mantidos.`)
    setQuery(current => ({ ...current }))
  }

  useEffect(() => {
    const controller = new AbortController()
    listVehicles(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ query, data })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      // A filtered update can remove the last vehicle on the current page.
      if (error instanceof ApiError && error.status === 404 && query.page > 1) {
        setQuery(current => current === query ? { ...query, page: query.page - 1 } : current)
      } else {
        setResult({ query, error: error instanceof Error ? error.message : 'Não foi possível carregar o estoque.' })
      }
    })
    return () => controller.abort()
  }, [query])

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setQuery({
      page: 1,
      brand: String(form.get('brand') || '').trim() || undefined,
      store: form.get('store') ? Number(form.get('store')) : undefined,
      status: (form.get('status') || undefined) as Vehicle['status'] | undefined,
    })
  }

  return (
    <>
      <PageHeading eyebrow="GESTÃO DE VEÍCULOS" title="Estoque" description="Um espaço para acompanhar os veículos das suas lojas e suas informações de disponibilidade." />
      {confirmation && <p role="status" className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">{confirmation}</p>}
      {storesError && <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4">
        <p role="alert" className="text-sm text-red-700">Não foi possível verificar as lojas para cadastro e edição. {storesError}</p>
        <button className="secondary-button mt-3" onClick={() => { setStoresError(''); setStoresAttempt(attempt => attempt + 1) }}>Tentar carregar lojas novamente</button>
      </div>}
      {stores === null && !storesError && <p className="mb-4 text-sm text-slate-500">Verificando permissão de cadastro…</p>}
      {stores && !stores.some(store => store.role === 'manager') && <p className="mb-4 text-sm text-slate-500">O cadastro de veículos está disponível somente para gerentes de uma loja.</p>}
      {editor && stores && <VehicleForm key={editor.kind === 'edit' ? editor.vehicle.id : 'create'} stores={stores}
        vehicle={editor.kind === 'edit' ? editor.vehicle : undefined} onCancel={() => setEditor(null)} onSaved={editor.kind === 'edit' ? updated : created} />}
      <section ref={inventorySection} tabIndex={-1} className="panel overflow-hidden" aria-label="Consulta de estoque">
        <div className="section-heading"><h2>Veículos</h2><span>{data ? `${number.format(data.count)} veículo(s) encontrado(s)` : 'Estoque das suas lojas'}</span>
          {stores?.some(store => store.role === 'manager') && <button className="primary-button" type="button" disabled={editor !== null} aria-expanded={editor?.kind === 'create'} onClick={event => { editorTrigger.current = event.currentTarget; setConfirmation(''); setEditor({ kind: 'create' }) }}>Novo veículo</button>}
        </div>
        <form ref={filters} onSubmit={filter} className="grid items-end gap-4 border-b border-slate-100 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div><label className="field-label" htmlFor="brand">Marca exata</label><input className="text-input" id="brand" name="brand" placeholder="Todas as marcas" /></div>
          <div><label className="field-label" htmlFor="store">ID da loja</label><input className="text-input" id="store" name="store" type="number" min="1" step="1" max="9007199254740991" placeholder="Todas as suas lojas" /></div>
          <div><label className="field-label" htmlFor="status">Disponibilidade</label><select className="text-input" id="status" name="status"><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <button className="primary-button" type="submit">Filtrar estoque</button>
        </form>
        <div aria-busy={loading} aria-live="polite">
          {loading && <p role="status" className="p-10 text-center text-sm text-slate-500">Carregando veículos…</p>}
          {current?.error && <div className="p-8 text-center"><p role="alert" className="text-sm text-red-700">{current.error}</p><button className="secondary-button mt-4" onClick={() => setQuery({ ...query })}>Tentar novamente</button></div>}
          {data && data.results.length === 0 && <EmptyState icon={CarFront} title="Nenhum veículo encontrado" description="Não há veículos acessíveis com estes filtros. Revise os filtros ou peça ao gerente para verificar sua associação à loja e o cadastro do estoque." badge="Consulta concluída" />}
          {data && data.results.length > 0 && <ul className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Veículos encontrados">
            {data.results.map(vehicle => <li key={vehicle.id} className="min-w-0 rounded-xl border border-slate-200 p-5">
              <div className="mb-4 flex items-center justify-between gap-2"><CarFront className="shrink-0 text-brand" size={24} aria-hidden="true" /><span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[vehicle.status]}`}>{statusLabels[vehicle.status]}</span></div>
              <h3 className="break-words text-lg font-semibold text-navy">{vehicle.brand} {vehicle.model}</h3>
              {vehicle.trim && <p className="mt-1 break-words text-sm text-slate-500">{vehicle.trim}</p>}
              <p className="my-4 text-xl font-semibold text-brand">{money.format(Number(vehicle.price))}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ['Ano', vehicle.year], ['Quilometragem', `${number.format(vehicle.mileage)} km`],
                  ['Câmbio', vehicle.transmission || 'Não informado'], ['Combustível', vehicle.fuel || 'Não informado'],
                  ['Tipo de estoque', stockLabels[vehicle.stock_type]], ['Loja', `#${vehicle.store}`],
                ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-navy">{value}</dd></div>)}
              </dl>
              {stores?.some(store => store.id === vehicle.store && store.role === 'manager') && <button
                className="secondary-button mt-5" type="button" disabled={editor !== null}
                aria-label={`Editar ${vehicle.brand} ${vehicle.model} #${vehicle.id}`}
                onClick={event => { editorTrigger.current = event.currentTarget; setConfirmation(''); setEditor({ kind: 'edit', vehicle }) }}>Editar</button>}
            </li>)}
          </ul>}
        </div>
        {data && <nav aria-label="Paginação do estoque" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm">
          <span>Página {query.page} · {data.results.length} de {number.format(data.count)} veículo(s)</span>
          <div className="flex gap-2"><button className="secondary-button" disabled={!data.previous} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Anterior</button><button className="secondary-button" disabled={!data.next} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Próxima</button></div>
        </nav>}
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4 text-xs leading-5 text-slate-500">A consulta respeita suas associações às lojas. Somente gerentes podem cadastrar e editar veículos nas lojas que gerenciam.</div>
      </section>
    </>
  )
}
