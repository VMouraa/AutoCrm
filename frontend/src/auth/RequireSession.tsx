import { Outlet } from 'react-router-dom'
import { useAuth } from './context'
import { LoginPage } from '../pages/LoginPage'

export function RequireSession() {
  const { state, retry } = useAuth()
  if (state.status === 'authenticated') return <Outlet />
  if (state.status === 'anonymous') return <LoginPage expired={state.expired} />
  return <main className="flex min-h-screen items-center justify-center bg-canvas p-5">
    <div className="panel max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold text-navy">AutoCRM</h1>
      {state.status === 'loading' ? <p role="status" className="mt-4">Verificando sua sessão…</p> : <>
        <p role="alert" className="mt-4 text-sm text-red-700">{state.message}</p>
        <button className="primary-button mt-5" onClick={retry}>Tentar novamente</button>
      </>}
    </div>
  </main>
}
