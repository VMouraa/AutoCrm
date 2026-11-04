import { ArrowRight, CarFront, CircleHelp, Database, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeading } from '../components/PageHeading'
import { ConnectionNotice } from '../components/ConnectionNotice'

export function DashboardPage() {
  return (
    <>
      <PageHeading eyebrow="VISÃO GERAL" title="Tudo começa com uma boa visão." description="Seu espaço para acompanhar a operação, organizar o estoque e construir relacionamentos com seus clientes." />
      <ConnectionNotice />
      <section aria-label="Indicadores operacionais" className="mb-7 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Veículos no estoque', icon: CarFront },
          { label: 'Clientes cadastrados', icon: UsersRound },
          { label: 'Veículos disponíveis', icon: Database },
        ].map(({ label, icon: Icon }) => (
          <article key={label} className="panel p-5">
            <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium text-slate-600">{label}</h2><Icon size={19} className="text-brand" aria-hidden="true" /></div>
            <p className="my-4 text-3xl font-semibold text-slate-300" aria-label="Indicador indisponível">—</p>
            <p className="text-xs text-slate-500">Disponível após integração com a API</p>
          </article>
        ))}
      </section>
      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-5"><h2 className="font-semibold text-navy">Sua operação, organizada</h2><p className="mt-1 text-sm text-slate-500">Acesse os espaços de trabalho do AutoCRM.</p></div>
        <div className="grid gap-6 p-6 md:grid-cols-2">
          {[
            { to: '/estoque', title: 'Gestão de estoque', text: 'Um lugar para consultar veículos, disponibilidade e informações do seu estoque.', icon: CarFront, action: 'Explorar estoque' },
            { to: '/clientes', title: 'Relacionamento com clientes', text: 'Um lugar para consultar contatos, origem e interesse em veículos.', icon: UsersRound, action: 'Explorar clientes' },
          ].map(({ to, title, text, icon: Icon, action }) => (
            <Link key={to} to={to} className="group rounded-xl border border-slate-200 p-6 transition hover:border-brand/40 hover:bg-blue-50/40">
              <Icon size={27} className="mb-5 text-brand" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="font-semibold text-navy">{title}</h3><p className="mb-6 mt-2 max-w-sm text-sm leading-6 text-slate-500">{text}</p>
              <span className="flex items-center gap-2 text-sm font-semibold text-brand">{action}<ArrowRight size={16} className="transition group-hover:translate-x-1" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </section>
      <div className="mt-6 flex items-start gap-3 px-1 text-sm leading-6 text-slate-500"><CircleHelp size={18} className="mt-1 shrink-0" aria-hidden="true" /><p>Os indicadores serão calculados a partir dos dados autorizados da sua conta. Traços indicam informações ainda indisponíveis.</p></div>
    </>
  )
}
