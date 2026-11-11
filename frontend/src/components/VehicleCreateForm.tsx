import { useEffect, useRef, useState } from 'react'
import type { FormEvent, InputHTMLAttributes } from 'react'
import { ApiError, ConnectionError } from '../services/api'
import { createVehicle } from '../services/vehicles'
import type { Store, Vehicle, VehicleCreateInput } from '../types/api'

type Field = keyof VehicleCreateInput
type FieldErrors = Partial<Record<Field, string>>
const labels: Record<Field, string> = {
  store: 'Loja', brand: 'Marca', model: 'Modelo', trim: 'Versão', year: 'Ano',
  mileage: 'Quilometragem (km)', transmission: 'Câmbio', fuel: 'Combustível',
  price: 'Preço (R$)', status: 'Status', stock_type: 'Tipo de estoque',
}

function errorText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(errorText).filter(Boolean).join(' ')
  return ''
}

export function VehicleCreateForm({ stores, onCancel, onCreated }: {
  stores: Store[]; onCancel: () => void; onCreated: (vehicle: Vehicle) => void
}) {
  const managerStores = stores.filter(store => store.role === 'manager')
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  // A ref also blocks repeated submissions before React renders the disabled button.
  const submitting = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  useEffect(() => {
    if (error || Object.keys(errors).length) summary.current?.focus()
  }, [error, errors])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = new FormData(event.currentTarget)
    const value = (field: Field) => String(form.get(field) ?? '').trim()
    const nextErrors: FieldErrors = {}
    const store = Number(value('store'))
    if (!managerStores.some(item => item.id === store)) nextErrors.store = 'Selecione uma loja em que você é gerente.'
    for (const [field, max] of [['brand', 80], ['model', 100], ['trim', 120], ['transmission', 30], ['fuel', 30]] as const) {
      if ((field === 'brand' || field === 'model') && !value(field)) nextErrors[field] = 'Preencha este campo.'
      else if (value(field).length > max) nextErrors[field] = `Use no máximo ${max} caracteres.`
    }
    const year = Number(value('year'))
    const maxYear = new Date().getFullYear() + 1
    if (!value('year') || !Number.isInteger(year) || year < 1900 || year > maxYear) nextErrors.year = `Informe um ano entre 1900 e ${maxYear}.`
    const mileage = Number(value('mileage'))
    if (!value('mileage') || !Number.isSafeInteger(mileage) || mileage < 0) nextErrors.mileage = 'Informe uma quilometragem inteira igual ou maior que zero, até 9007199254740991.'
    // Keep decimal money as text all the way to DRF; accept a Brazilian decimal comma.
    const price = value('price').replace(',', '.')
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(price) || !/[1-9]/.test(price)) nextErrors.price = 'Informe um preço positivo, com até 10 dígitos inteiros e 2 casas decimais, sem separador de milhar.'
    setErrors(nextErrors)
    setError('')
    if (Object.keys(nextErrors).length) return

    submitting.current = true
    setPending(true)
    try {
      const vehicle = await createVehicle({
        store, brand: value('brand'), model: value('model'), trim: value('trim'), year, mileage,
        transmission: value('transmission'), fuel: value('fuel'), price,
        status: value('status') as Vehicle['status'], stock_type: value('stock_type') as Vehicle['stock_type'],
      })
      onCreated(vehicle)
    } catch (cause: unknown) {
      const fieldErrors: FieldErrors = {}
      const messages: string[] = []
      if (cause instanceof ApiError && cause.details && typeof cause.details === 'object' && !Array.isArray(cause.details)) {
        for (const [field, detail] of Object.entries(cause.details)) {
          const message = errorText(detail)
          if (!message) continue
          if (Object.prototype.hasOwnProperty.call(labels, field)) fieldErrors[field as Field] = message
          else messages.push(message)
        }
      }
      setErrors(fieldErrors)
      const fallback = cause instanceof Error ? cause.message : 'Não foi possível cadastrar o veículo. Tente novamente.'
      setError(messages.join(' ') || (Object.keys(fieldErrors).length ? 'Revise os campos indicados e tente novamente.' : fallback))
      if (cause instanceof ConnectionError || (cause instanceof ApiError && cause.status >= 500)) {
        setError(`${fallback} Verifique o estoque antes de tentar novamente para evitar um cadastro duplicado.`)
      }
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  function fieldProps(field: Field) {
    return { id: `vehicle-${field}`, name: field, className: 'text-input',
      'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `vehicle-${field}-error` : undefined }
  }
  function fieldError(field: Field) {
    return errors[field] && <p id={`vehicle-${field}-error`} className="mt-2 text-sm text-red-700">{errors[field]}</p>
  }
  function input(field: Field, props: InputHTMLAttributes<HTMLInputElement> = {}) {
    return <div key={field}><label className="field-label" htmlFor={`vehicle-${field}`}>{labels[field]}</label><input {...fieldProps(field)} {...props} />{fieldError(field)}</div>
  }

  return <section className="panel mb-6 p-5 sm:p-6" aria-labelledby="vehicle-create-title">
    <h2 id="vehicle-create-title" ref={heading} tabIndex={-1} className="text-xl font-semibold text-navy">Novo veículo</h2>
    <p id="vehicle-create-help" className="mb-5 mt-2 text-sm text-slate-500">Marca, modelo, ano, quilometragem, preço e loja são obrigatórios. Versão, câmbio e combustível são opcionais.</p>
    <form onSubmit={submit} noValidate aria-label="Cadastro de veículo" aria-describedby="vehicle-create-help" aria-busy={pending}>
      {(error || Object.keys(errors).length > 0) && <div ref={summary} tabIndex={-1} role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <p>{error || 'Revise os campos indicados para continuar.'}</p>
        {Object.keys(errors).length > 0 && <ul className="mt-2 list-inside list-disc">{(Object.keys(errors) as Field[]).map(field => <li key={field}><a href={`#vehicle-${field}`} className="underline">{labels[field]}: {errors[field]}</a></li>)}</ul>}
      </div>}
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <legend className="sr-only">Dados do veículo</legend>
        <div><label className="field-label" htmlFor="vehicle-store">Loja</label><select {...fieldProps('store')} required defaultValue={managerStores.length === 1 ? managerStores[0].id : ''}>
          <option value="">Selecione a loja</option>{managerStores.map(store => <option value={store.id} key={store.id}>{store.name}</option>)}
        </select>{fieldError('store')}</div>
        {input('brand', { required: true, maxLength: 80 })}
        {input('model', { required: true, maxLength: 100 })}
        {input('trim', { maxLength: 120 })}
        {input('year', { type: 'number', required: true, min: 1900, max: new Date().getFullYear() + 1, step: 1 })}
        {input('mileage', { type: 'number', required: true, min: 0, max: Number.MAX_SAFE_INTEGER, step: 1 })}
        {input('transmission', { maxLength: 30 })}
        {input('fuel', { maxLength: 30 })}
        {input('price', { required: true, inputMode: 'decimal', placeholder: 'Ex.: 119900,00' })}
        <div><label className="field-label" htmlFor="vehicle-status">Status</label><select {...fieldProps('status')} defaultValue="available">
          <option value="available">Disponível</option><option value="reserved">Reservado</option><option value="sold">Vendido</option>
        </select>{fieldError('status')}</div>
        <div><label className="field-label" htmlFor="vehicle-stock_type">Tipo de estoque</label><select {...fieldProps('stock_type')} defaultValue="owned">
          <option value="owned">Próprio</option><option value="consignment">Consignado</option><option value="wholesale">Repasse</option>
        </select>{fieldError('stock_type')}</div>
        <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-3">
          <button className="primary-button" type="submit">{pending ? 'Cadastrando…' : 'Cadastrar veículo'}</button>
          <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  </section>
}
