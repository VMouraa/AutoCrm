export interface SessionUser {
  id: number
  username: string
}

export interface Session {
  user: SessionUser | null
  csrfToken: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type StoreRole = 'manager' | 'seller'

export interface Store {
  id: number
  name: string
  /** Papel do usuário autenticado nesta loja. */
  role: StoreRole
}

export interface Customer {
  id: number
  name: string
  phone: string
  email: string
  source: 'instagram' | 'whatsapp' | 'shopcar' | 'mobiauto' | 'other'
  vehicle_interest: string
  owner: number
  created_at: string
}

export interface Vehicle {
  id: number
  store: number
  brand: string
  model: string
  trim: string
  year: number
  mileage: number
  transmission: string
  fuel: string
  /** Decimal do DRF: manter como string para preservar precisão. */
  price: string
  status: 'available' | 'reserved' | 'sold'
  stock_type: 'owned' | 'consignment' | 'wholesale'
  source: string
  external_id: string | null
  created_at: string
  updated_at: string
}

/** Campos aceitos no cadastro manual; os opcionais seguem o serializer Django. */
export type VehicleCreateInput = Pick<Vehicle, 'store' | 'brand' | 'model' | 'year' | 'mileage' | 'price'>
  & Partial<Pick<Vehicle, 'trim' | 'transmission' | 'fuel' | 'status' | 'stock_type'>>
