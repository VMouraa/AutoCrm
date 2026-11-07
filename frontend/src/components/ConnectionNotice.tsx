import { CircleHelp } from 'lucide-react'

export function ConnectionNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-brand">
      <CircleHelp size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div><p className="font-semibold">Área em preparação</p>
        <p className="mt-1 leading-6 text-slate-600">Os dados desta página ainda não são consultados. A consulta real de veículos já está disponível na página de Estoque.</p>
      </div>
    </div>
  )
}
