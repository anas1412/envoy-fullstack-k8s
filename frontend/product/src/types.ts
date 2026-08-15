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

export interface Health {
  status: string
  database: string
}
