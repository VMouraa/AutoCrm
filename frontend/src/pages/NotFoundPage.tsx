import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="panel px-6 py-20 text-center"><p className="eyebrow">404</p><h1 className="mt-4 text-3xl font-semibold text-navy">Página não encontrada</h1><p className="my-5 text-sm text-slate-500">Este endereço não faz parte do AutoCRM.</p><Link to="/" className="font-semibold text-brand underline underline-offset-4">Voltar ao Dashboard</Link></div>
}
