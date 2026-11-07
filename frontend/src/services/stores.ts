import { apiGet } from './api'
import type { Store } from '../types/api'

/** Todas as lojas acessíveis ao usuário, sem paginação. */
export function listStores(signal?: AbortSignal): Promise<Store[]> {
  return apiGet<Store[]>('stores/', signal)
}
