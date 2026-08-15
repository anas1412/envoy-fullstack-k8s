interface Props {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'good' | 'warn'
}

export function StatCard({ label, value, hint, tone = 'default' }: Props) {
  const valueColor =
    tone === 'good' ? 'text-moss' : tone === 'warn' ? 'text-copper' : 'text-fg'
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className={`mt-1 font-mono text-2xl leading-none tabular-nums ${valueColor}`}>
        {value}
      </p>
      {hint && <p className="mt-1.5 font-mono text-[11px] text-faint">{hint}</p>}
    </div>
  )
}
