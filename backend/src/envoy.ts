const ADMIN_BASE = process.env.ENVOY_ADMIN ?? 'http://localhost:9901'

export interface ClusterStatsPayload {
  requests: number
  active_connections: number
  total_connections: number
  connect_failures: number
  bytes_in: number
  bytes_out: number
}

export interface ListenerStatsPayload {
  active_connections: number
  total_connections: number
  requests?: number
  bytes_in: number
  bytes_out: number
}

export interface EnvoyStatsPayload {
  generated_at: string
  uptime: string
  clusters: Record<string, ClusterStatsPayload>
  listeners: Record<string, ListenerStatsPayload>
}

const CLUSTER_SUFFIXES = {
  upstream_rq_total: 'requests',
  upstream_cx_active: 'active_connections',
  upstream_cx_total: 'total_connections',
  upstream_cx_connect_fail: 'connect_failures',
  upstream_cx_rx_bytes_total: 'bytes_in',
  upstream_cx_tx_bytes_total: 'bytes_out',
} as const

const LISTENER_SUFFIXES = {
  downstream_cx_active: 'active_connections',
  downstream_cx_total: 'total_connections',
  downstream_cx_rx_bytes_total: 'bytes_in',
  downstream_cx_tx_bytes_total: 'bytes_out',
} as const

const HTTP_SUFFIXES = {
  downstream_cx_active: 'active_connections',
  downstream_cx_total: 'total_connections',
  requests_total: 'requests',
  downstream_cx_rx_bytes_total: 'bytes_in',
  downstream_cx_tx_bytes_total: 'bytes_out',
} as const

export async function fetchEnvoyStats(): Promise<EnvoyStatsPayload> {
  let res: Response
  try {
    res = await fetch(`${ADMIN_BASE}/stats`)
  } catch {
    throw new Error(`Envoy admin unreachable at ${ADMIN_BASE}`)
  }
  if (!res.ok) throw new Error(`Envoy admin returned HTTP ${res.status}`)
  return parseStats(await res.text())
}

function parseStats(text: string): EnvoyStatsPayload {
  const clusters: Record<string, ClusterStatsPayload> = {}
  const listeners: Record<string, ListenerStatsPayload> = {}
  let uptimeSeconds = 0

  for (const line of text.split('\n')) {
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const name = line.slice(0, idx).trim()
    const value = Number(line.slice(idx + 1).trim())
    if (!Number.isFinite(value)) continue

    if (name.startsWith('cluster.')) {
      const rest = name.slice('cluster.'.length)
      const dot = rest.indexOf('.')
      if (dot === -1) continue
      const cluster = rest.slice(0, dot)
      const suffix = rest.slice(dot + 1)
      const key = CLUSTER_SUFFIXES[suffix as keyof typeof CLUSTER_SUFFIXES]
      if (!key) continue
      clusters[cluster] ??= {
        requests: 0,
        active_connections: 0,
        total_connections: 0,
        connect_failures: 0,
        bytes_in: 0,
        bytes_out: 0,
      }
      clusters[cluster][key] = value
    } else if (name.startsWith('listener.')) {
      const rest = name.slice('listener.'.length)
      const dot = rest.indexOf('.')
      if (dot === -1) continue
      const listener = rest.slice(0, dot)
      const suffix = rest.slice(dot + 1)
      const key = LISTENER_SUFFIXES[suffix as keyof typeof LISTENER_SUFFIXES]
      if (!key) continue
      listeners[listener] ??= {
        active_connections: 0,
        total_connections: 0,
        requests: undefined,
        bytes_in: 0,
        bytes_out: 0,
      }
      listeners[listener][key] = value
    } else if (name.startsWith('http.http.')) {
      const suffix = name.slice('http.http.'.length)
      const key = HTTP_SUFFIXES[suffix as keyof typeof HTTP_SUFFIXES]
      if (!key) continue
      listeners['http'] ??= {
        active_connections: 0,
        total_connections: 0,
        requests: undefined,
        bytes_in: 0,
        bytes_out: 0,
      }
      listeners['http'][key] = value
    } else if (name === 'server.uptime') {
      uptimeSeconds = value
    }
  }

  return {
    generated_at: new Date().toISOString(),
    uptime: formatUptime(uptimeSeconds),
    clusters,
    listeners,
  }
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}
