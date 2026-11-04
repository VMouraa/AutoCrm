export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
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
