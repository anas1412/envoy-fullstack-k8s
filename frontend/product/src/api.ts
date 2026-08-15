import type { Health, User, UserDraft } from './types'

const AUTH_KEY = 'envoy-stack.basic-auth'

export function storedAuth(): string | null {
  return localStorage.getItem(AUTH_KEY)
}

export function saveAuth(username: string, password: string): void {
  localStorage.setItem(AUTH_KEY, `${username}:${password}`)
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY)
}

function headers(auth?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) h['Authorization'] = `Basic ${btoa(auth)}`
  return h
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new Error('Cannot reach the backend')
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // non-JSON error body; keep the default message
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export function listUsers(): Promise<User[]> {
  return request('/api/users')
}

export function createUser(draft: UserDraft, auth?: string): Promise<User> {
  return request('/api/users', {
    method: 'POST',
    headers: headers(auth),
    body: JSON.stringify(draft),
  })
}

export function updateUser(id: number, draft: UserDraft, auth?: string): Promise<User> {
  return request(`/api/users/${id}`, {
    method: 'PUT',
    headers: headers(auth),
    body: JSON.stringify(draft),
  })
}

export function deleteUser(id: number, auth?: string): Promise<{ ok: boolean }> {
  return request(`/api/users/${id}`, {
    method: 'DELETE',
    headers: headers(auth),
  })
}

export function getHealth(): Promise<Health> {
  return request('/api/health')
}
