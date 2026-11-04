import { Unplug } from 'lucide-react'

export function ConnectionNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-brand">
      <Unplug size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div><p className="font-semibold">API ainda não conectada</p>
        <p className="mt-1 leading-6 text-slate-600">Esta é a estrutura inicial do AutoCRM. Nenhum dado operacional está sendo consultado nesta etapa.</p>
      </div>
    </div>
  )
}
