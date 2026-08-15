import postgres from 'postgres'

const sql = postgres({
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE ?? 'app',
  username: process.env.PG_USER ?? 'postgres',
  password: process.env.PG_PASSWORD ?? 'postgres',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 5,
  onnotice: () => {},
})

export interface UserRow {
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

export async function listUsers(): Promise<UserRow[]> {
  return sql<UserRow[]>`
    SELECT id, name, email, role, created_at
    FROM users
    ORDER BY id ASC
  `
}

export async function getUser(id: number): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    SELECT id, name, email, role, created_at
    FROM users
    WHERE id = ${id}
  `
  return rows[0] ?? null
}

export async function insertUser(draft: UserDraft): Promise<UserRow> {
  const rows = await sql<UserRow[]>`
    INSERT INTO users (name, email, role)
    VALUES (${draft.name}, ${draft.email}, ${draft.role})
    RETURNING id, name, email, role, created_at
  `
  return rows[0]
}

export async function updateUser(id: number, draft: UserDraft): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    UPDATE users
    SET name = ${draft.name}, email = ${draft.email}, role = ${draft.role}
    WHERE id = ${id}
    RETURNING id, name, email, role, created_at
  `
  return rows[0] ?? null
}

export async function deleteUser(id: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM users WHERE id = ${id}
  `
  return result.count > 0
}

export async function dbPing(): Promise<boolean> {
  try {
    await sql`SELECT 1`
    return true
  } catch {
    return false
  }
}

export async function closeDb(): Promise<void> {
  await sql.end()
}
