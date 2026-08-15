import { closeDb, deleteUser, getUser, insertUser, listUsers, updateUser, dbPing } from './db'
import type { UserDraft } from './db'
import { fetchEnvoyStats } from './envoy'

const PORT = Number(process.env.PORT ?? 3000)
const ROLES = new Set(['admin', 'editor', 'viewer'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extra,
    },
  })
}

function error(status: number, message: string): Response {
  return json({ error: message }, status)
}

function validateDraft(raw: unknown): { ok: true; draft: UserDraft } | { ok: false; response: Response } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, response: error(400, 'Request body must be a JSON object') }
  }
  const body = raw as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return { ok: false, response: error(400, 'name is required') }
  if (name.length > 200) return { ok: false, response: error(400, 'name must be 200 characters or fewer') }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return { ok: false, response: error(400, 'email is required') }
  if (email.length > 320 || !EMAIL_RE.test(email)) {
    return { ok: false, response: error(400, 'email must be a valid address') }
  }

  const role = typeof body.role === 'string' ? body.role : 'viewer'
  if (!ROLES.has(role)) {
    return { ok: false, response: error(400, `role must be one of: ${[...ROLES].join(', ')}`) }
  }

  return { ok: true, draft: { name, email, role } }
}

function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  )
}

async function handleHealth(): Promise<Response> {
  const up = await dbPing()
  if (up) return json({ status: 'ok', database: 'up' })
  return json({ status: 'degraded', database: 'down' }, 503)
}

async function handleEnvoyStats(): Promise<Response> {
  try {
    return json(await fetchEnvoyStats())
  } catch (e) {
    return error(503, e instanceof Error ? e.message : 'Envoy admin unavailable')
  }
}

async function handleUsers(req: Request, url: URL): Promise<Response> {
  const method = req.method
  const match = /^\/api\/users(?:\/(\d+))?$/.exec(url.pathname)

  if (!match) {
    // /api/* unknown → 404
    return error(404, `No route for ${method} ${url.pathname}`)
  }

  const idRaw = match[1]
  const id = idRaw === undefined ? null : parseId(idRaw)

  if (method === 'GET' && id === null) {
    try {
      return json(await listUsers())
    } catch (e) {
      return error(503, e instanceof Error ? e.message : 'Database unavailable')
    }
  }

  if (method === 'GET' && id !== null) {
    const user = await getUser(id)
    if (!user) return error(404, `User ${id} not found`)
    return json(user)
  }

  if (method === 'POST' && id === null) {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return error(400, 'Request body must be valid JSON')
    }
    const v = validateDraft(raw)
    if (!v.ok) return v.response
    try {
      return json(await insertUser(v.draft), 201)
    } catch (e) {
      if (isUniqueViolation(e)) return error(409, 'A user with this email already exists')
      return error(503, e instanceof Error ? e.message : 'Database unavailable')
    }
  }

  if (method === 'PUT' && id !== null) {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return error(400, 'Request body must be valid JSON')
    }
    const v = validateDraft(raw)
    if (!v.ok) return v.response
    try {
      const user = await updateUser(id, v.draft)
      if (!user) return error(404, `User ${id} not found`)
      return json(user)
    } catch (e) {
      if (isUniqueViolation(e)) return error(409, 'A user with this email already exists')
      return error(503, e instanceof Error ? e.message : 'Database unavailable')
    }
  }

  if (method === 'DELETE' && id !== null) {
    try {
      const deleted = await deleteUser(id)
      if (!deleted) return error(404, `User ${id} not found`)
      return json({ ok: true })
    } catch (e) {
      return error(503, e instanceof Error ? e.message : 'Database unavailable')
    }
  }

  return error(405, `Method ${method} not allowed`)
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/api/health') return handleHealth()
    if (url.pathname === '/api/envoy/stats') return handleEnvoyStats()
    if (url.pathname.startsWith('/api/')) return handleUsers(req, url)

    return error(404, `No route for ${req.method} ${url.pathname}`)
  },
})

console.log(`backend listening on :${server.port}`)

process.on('SIGTERM', () => {
  void closeDb().finally(() => process.exit(0))
})
process.on('SIGINT', () => {
  void closeDb().finally(() => process.exit(0))
})
