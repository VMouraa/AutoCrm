import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CarFront } from 'lucide-react'
import { useAuth } from '../auth/context'

export function LoginPage({ expired }: { expired: boolean }) {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { document.title = 'Entrar | AutoCRM' }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await signIn(username.trim(), password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setPassword('')
      setPending(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-navy p-5 sm:p-9">
    <section className="panel w-full max-w-md p-6 sm:p-9" aria-labelledby="login-title">
      <div className="mb-8 flex items-center gap-3 text-2xl font-bold text-navy"><CarFront className="text-brand" size={32} aria-hidden="true" />AutoCRM</div>
      <p className="eyebrow">SEU ESPAÇO DE GESTÃO</p>
      <h1 id="login-title" className="mt-3 text-2xl font-semibold text-navy">Entre na sua conta</h1>
      <p className="mb-6 mt-3 text-sm leading-6 text-slate-500">Use seu usuário do AutoCRM para consultar os veículos das suas lojas.</p>
      {expired && <p role="alert" className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Sua sessão expirou. Entre novamente para continuar.</p>}
      <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
        <div><label htmlFor="username" className="field-label">Usuário</label><input id="username" name="username" className="text-input" autoComplete="username" required autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} disabled={pending} /></div>
        <div><label htmlFor="password" className="field-label">Senha</label><input id="password" name="password" className="text-input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={pending} /></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={pending || !username.trim()} className="primary-button w-full">{pending ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </section>
  </main>
}
