import { useCallback, useEffect, useRef, useState } from 'react'
import { getEnvoyStats, getHealth } from './api'
import type { EnvoyStats, Health } from './types'
import { StatCard } from './components/StatCard'
import { ClusterTable } from './components/ClusterTable'
import { ListenerTable } from './components/ListenerTable'

const POLL_MS = 5000

function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`
  return `${n} B`
}

export default function App() {
  const [stats, setStats] = useState<EnvoyStats | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tick, setTick] = useState(0)
  const mounted = useRef(true)

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const [s, h] = await Promise.all([getEnvoyStats(), getHealth()])
      if (!mounted.current) return
      setStats(s)
      setHealth(h)
      setError(null)
    } catch (e) {
      if (!mounted.current) return
      setError(e instanceof Error ? e.message : 'Failed to fetch stats')
    } finally {
      if (mounted.current && manual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void refresh()
    const id = setInterval(() => {
      void refresh()
      setTick((t) => t + 1)
    }, POLL_MS)
    return () => {
      mounted.current = false
      clearInterval(id)
    }
  }, [refresh])

  const postgres = stats?.clusters.postgres
  const httpListener = stats?.listeners['http']
  const dbUp = health?.database === 'up'

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-faint">
            envoy-stack · monitor
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">
            Envoy traffic
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="flex items-center gap-1.5 text-xs text-dim">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                error ? 'bg-clay' : dbUp ? 'bg-moss' : 'bg-copper'
              }`}
            />
            {error ? 'envoy unreachable' : dbUp ? 'database up' : 'database down'}
          </p>
          <button
            onClick={() => void refresh(true)}
            disabled={refreshing}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-dim transition-colors hover:border-copper hover:text-fg disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-6 rounded-lg border border-clay/40 bg-panel p-6 text-center">
          <p className="text-sm text-clay">{error}</p>
          <button
            onClick={() => void refresh(true)}
            className="mt-4 rounded-md border border-line px-4 py-2 text-sm text-fg transition-colors hover:border-copper"
          >
            Retry
          </button>
        </div>
      )}

      {!error && !stats && (
        <p className="py-12 text-center text-sm text-dim">Loading stats…</p>
      )}

      {!error && stats && (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="L7 requests"
              value={String(httpListener?.requests ?? 0)}
              hint={stats.uptime}
            />
            <StatCard
              label="Active HTTP conns"
              value={String(httpListener?.active_connections ?? 0)}
              hint="listener: http"
            />
            <StatCard
              label="Postgres conns"
              value={String(postgres?.active_connections ?? 0)}
              tone={postgres && postgres.active_connections > 0 ? 'good' : 'default'}
              hint="cluster: postgres"
            />
            <StatCard
              label="Postgres bytes"
              value={fmtBytes((postgres?.bytes_in ?? 0) + (postgres?.bytes_out ?? 0))}
              hint={`in ${fmtBytes(postgres?.bytes_in ?? 0)} · out ${fmtBytes(postgres?.bytes_out ?? 0)}`}
            />
          </section>

          <div className="mt-4 space-y-4">
            <ClusterTable clusters={stats.clusters} />
            <ListenerTable listeners={stats.listeners} />
          </div>
        </>
      )}

      <footer className="mt-10 border-t border-line/60 pt-4 text-xs text-faint">
        <p>
          Auto-refreshes every 5 s · last fetch {stats ? new Date(stats.generated_at).toLocaleTimeString() : '—'}{' '}
          · poll #{tick}
        </p>
      </footer>
    </div>
  )
}
