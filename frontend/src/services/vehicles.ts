import { apiGet } from './api'
import type { PaginatedResponse, Vehicle } from '../types/api'

export function listVehicles(filters: {
  store?: number; status?: Vehicle['status']; brand?: string; page?: number
} = {}, signal?: AbortSignal) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return apiGet<PaginatedResponse<Vehicle>>(`vehicles/?${params}`, signal)
}
