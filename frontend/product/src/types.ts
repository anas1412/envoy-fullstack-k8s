export interface User {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

export interface UserDraft {
  name: string
  email: string
  role: string
}

export interface HealthDetail {
  status: string
  message?: string
}

export interface Health {
  status: string
  info: Record<string, HealthDetail>
  error: Record<string, HealthDetail>
  details: Record<string, HealthDetail>
}
