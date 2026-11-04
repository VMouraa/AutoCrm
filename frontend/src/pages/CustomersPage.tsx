import { UsersRound } from 'lucide-react'
import { PageHeading } from '../components/PageHeading'
import { ConnectionNotice } from '../components/ConnectionNotice'
import { EmptyState } from '../components/EmptyState'

export function CustomersPage() {
  return (
    <>
      <PageHeading eyebrow="RELACIONAMENTOS" title="Clientes" description="Contatos e interesses reunidos para dar continuidade a cada relacionamento." />
      <ConnectionNotice />
      <section className="panel overflow-hidden" aria-label="Consulta de clientes">
        <div className="section-heading"><h2>Seus clientes</h2><span>Consulta ainda indisponível</span></div>
        <EmptyState icon={UsersRound} title="Cada relacionamento começa aqui" description="Após a integração, seus clientes aparecerão neste espaço com contato, origem e veículo de interesse. Nenhum cadastro foi consultado nesta etapa." />
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4 text-xs leading-5 text-slate-500">Atualmente, os clientes pertencem ao usuário responsável. O backend ainda não vincula clientes a lojas.</div>
      </section>
    </>
  )
}
