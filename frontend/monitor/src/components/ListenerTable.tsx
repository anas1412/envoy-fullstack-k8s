import type { ListenerStats } from '../types'

interface Props {
  listeners: Record<string, ListenerStats>
}

function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`
  return `${n} B`
}

export function ListenerTable({ listeners }: Props) {
  const rows = Object.entries(listeners).sort(([a], [b]) => a.localeCompare(b))
  return (
    <section className="rounded-lg border border-line bg-panel">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-fg">
        Listeners
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-faint">
              <th className="px-4 py-2.5 font-medium">Listener</th>
              <th className="px-4 py-2.5 text-right font-medium">Active conns</th>
              <th className="px-4 py-2.5 text-right font-medium">Total conns</th>
              <th className="px-4 py-2.5 text-right font-medium">Requests</th>
              <th className="px-4 py-2.5 text-right font-medium">Bytes in</th>
              <th className="px-4 py-2.5 text-right font-medium">Bytes out</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, s]) => (
              <tr key={name} className="border-b border-line/60 last:border-b-0">
                <td className="px-4 py-2.5 font-mono text-fg">{name}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {s.active_connections > 0 ? (
                    <span className="text-copper">{s.active_connections}</span>
                  ) : (
                    <span className="text-dim">{s.active_connections}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-dim tabular-nums">
                  {s.total_connections}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-dim tabular-nums">
                  {s.requests ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-dim tabular-nums">
                  {fmtBytes(s.bytes_in)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-dim tabular-nums">
                  {fmtBytes(s.bytes_out)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
