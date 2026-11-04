import { apiGet } from './api'
import type { Customer, PaginatedResponse } from '../types/api'

export function listCustomers(filters: { search?: string; page?: number } = {}, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.page) params.set('page', String(filters.page))
  return apiGet<PaginatedResponse<Customer>>(`customers/?${params}`, signal)
}
