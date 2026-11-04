export function PageHeading({ eyebrow, title, description }: {
  eyebrow: string; title: string; description: string
}) {
  return (
    <div className="mb-8">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}
