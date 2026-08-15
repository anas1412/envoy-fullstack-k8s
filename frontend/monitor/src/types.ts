export interface ClusterStats {
  requests: number
  active_connections: number
  total_connections: number
  connect_failures: number
  bytes_in: number
  bytes_out: number
}

export interface ListenerStats {
  active_connections: number
  total_connections: number
  requests?: number
  bytes_in: number
  bytes_out: number
}

export interface EnvoyStats {
  generated_at: string
  uptime: string
  clusters: Record<string, ClusterStats>
  listeners: Record<string, ListenerStats>
}

export interface Health {
  status: string
  database: string
}
