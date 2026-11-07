import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, title, description, badge = 'Aguardando integração' }: {
  icon: LucideIcon; title: string; description: string; badge?: string
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-brand"><Icon size={30} strokeWidth={1.5} aria-hidden="true" /></div>
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      <span className="mt-5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{badge}</span>
    </div>
  )
}
