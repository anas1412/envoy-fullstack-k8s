import type { EnvoyStats, Health } from './types'

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // keep default
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export function getEnvoyStats(): Promise<EnvoyStats> {
  return request('/api/envoy/stats')
}

export function getHealth(): Promise<Health> {
  return request('/api/health')
}
