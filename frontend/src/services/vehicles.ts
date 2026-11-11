import { apiGet, apiRequest } from './api'
import type { PaginatedResponse, Vehicle, VehicleCreateInput, VehicleUpdateInput } from '../types/api'

export function createVehicle(data: VehicleCreateInput): Promise<Vehicle> {
  return apiRequest<Vehicle>('vehicles/', { method: 'POST', body: data })
}

export function updateVehicle(id: number, data: VehicleUpdateInput): Promise<Vehicle> {
  return apiRequest<Vehicle>(`vehicles/${id}/`, { method: 'PATCH', body: data })
}

export function listVehicles(filters: {
  store?: number; status?: Vehicle['status']; brand?: string; page?: number
} = {}, signal?: AbortSignal) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return apiGet<PaginatedResponse<Vehicle>>(`vehicles/?${params}`, signal)
}
