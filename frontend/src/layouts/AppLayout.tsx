import { useEffect, useRef, useState } from 'react'
import { CarFront, ChevronRight, Menu, ShieldCheck, X } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Navigation } from '../components/Navigation'
import { useAuth } from '../auth/context'

const pageNames: Record<string, string> = { '/': 'Dashboard', '/estoque': 'Estoque', '/clientes': 'Clientes' }

export function AppLayout() {
  const { state, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()
  const pageName = pageNames[pathname] || 'Página não encontrada'

  async function handleLogout() {
    setSigningOut(true)
    setLogoutError('')
    try { await signOut() }
    catch (error) { setLogoutError(error instanceof Error ? error.message : 'Não foi possível sair. Tente novamente.') }
    finally { setSigningOut(false) }
  }

  useEffect(() => { document.title = `${pageName} | AutoCRM` }, [pageName])
  useEffect(() => {
    if (menuOpen) dialog.current?.showModal()
    else dialog.current?.close()
  }, [menuOpen])

  const sidebar = <>
    <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-white" aria-label="AutoCRM — início">
      <span className="rounded-xl bg-brand p-2.5"><CarFront size={25} aria-hidden="true" /></span>
      <span className="text-2xl font-bold tracking-tight">Auto<span className="font-light text-blue-200">CRM</span></span>
    </Link>
    <p className="mb-5 mt-12 pl-3 text-[10px] font-semibold tracking-[0.2em] text-slate-400">ESPAÇO DE TRABALHO</p>
    <Navigation onNavigate={() => setMenuOpen(false)} />
    <div className="mt-auto pt-10">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <ShieldCheck size={20} className="mb-3 text-blue-300" aria-hidden="true" />
        <p className="text-sm font-medium text-white">Uma base para crescer</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">Clientes e estoque em um só espaço de gestão.</p>
      </div>
      <p className="mt-6 text-xs text-slate-400">AutoCRM <span className="float-right">Etapa 3.2</span></p>
    </div>
  </>

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-navy p-6 lg:flex">{sidebar}</aside>
      <dialog ref={dialog} onCancel={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)}
        aria-label="Menu de navegação" className="mobile-menu">
        <button onClick={() => setMenuOpen(false)} className="mb-6 self-end rounded-lg p-2 text-white hover:bg-white/10" aria-label="Fechar menu"><X size={22} /></button>
        {sidebar}
      </dialog>
      <div className="lg:pl-64">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 sm:px-9">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen}
              aria-label="Abrir menu" className="rounded-lg p-2 text-navy hover:bg-slate-100 lg:hidden"><Menu size={22} /></button>
            <div className="flex items-center gap-3 text-sm"><span className="hidden text-slate-400 sm:inline">Área de gestão</span><ChevronRight size={14} className="hidden text-slate-300 sm:block" aria-hidden="true" /><span className="font-medium text-navy">{pageName}</span></div>
          </div>
          <div className="flex min-w-0 items-center gap-3"><span className="hidden max-w-40 truncate text-sm text-slate-600 sm:block">{state.status === 'authenticated' ? state.user.username : ''}</span><button className="secondary-button" onClick={handleLogout} disabled={signingOut}>{signingOut ? 'Saindo…' : 'Sair'}</button></div>
        </header>
        {logoutError && <p role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-9">{logoutError}</p>}
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-[1440px] p-5 outline-none sm:p-9 lg:p-10"><Outlet /></main>
        <footer className="mx-5 flex flex-wrap justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-500 sm:mx-9 lg:mx-10"><span>AutoCRM · Gestão automotiva</span><span>Seu próximo passo começa com organização.</span></footer>
      </div>
    </div>
  )
}
