import { CarFront } from 'lucide-react'
import { PageHeading } from '../components/PageHeading'
import { ConnectionNotice } from '../components/ConnectionNotice'
import { EmptyState } from '../components/EmptyState'

export function InventoryPage() {
  return (
    <>
      <PageHeading eyebrow="GESTÃO DE VEÍCULOS" title="Estoque" description="Um espaço para acompanhar os veículos das suas lojas e suas informações de disponibilidade." />
      <ConnectionNotice />
      <section className="panel overflow-hidden" aria-label="Consulta de estoque">
        <div className="section-heading"><h2>Veículos</h2><span>Consulta ainda indisponível</span></div>
        <EmptyState icon={CarFront} title="Seu estoque terá espaço aqui" description="Após a integração, esta página exibirá os veículos das lojas às quais você tem acesso. Ainda não é possível determinar se há veículos cadastrados." />
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4 text-xs leading-5 text-slate-500">A API existente oferece filtros por loja, marca e status. O cadastro e a alteração dependem da permissão de gerente.</div>
      </section>
    </>
  )
}
