import { useCallback, useEffect, useState } from 'react'
import {
  clearAuth,
  createUser,
  deleteUser,
  getHealth,
  listUsers,
  saveAuth,
  storedAuth,
  updateUser,
} from './api'
import type { Health, User, UserDraft } from './types'
import { UserForm } from './components/UserForm'
import { UserTable } from './components/UserTable'

type EditorState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; user: User }

export default function App() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [editor, setEditor] = useState<EditorState>({ kind: 'closed' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [auth, setAuth] = useState<string | null>(() => storedAuth())
  const [authOpen, setAuthOpen] = useState(!storedAuth())
  const [authUser, setAuthUser] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [rows, h] = await Promise.all([listUsers(), getHealth()])
      setUsers(rows)
      setHealth(h)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = async (draft: UserDraft) => {
    setBusy(true)
    setActionError(null)
    try {
      if (editor.kind === 'create') {
        await createUser(draft, auth ?? undefined)
      } else if (editor.kind === 'edit') {
        await updateUser(editor.user.id, draft, auth ?? undefined)
      }
      setEditor({ kind: 'closed' })
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    setDeletingId(id)
    setActionError(null)
    try {
      await deleteUser(id, auth ?? undefined)
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const submitAuth = (e: React.FormEvent) => {
    e.preventDefault()
    if (!authUser.trim() || !authPass) return
    saveAuth(authUser.trim(), authPass)
    setAuth(storedAuth())
    setAuthOpen(false)
  }

  const dbUp = health?.info?.database?.status === 'up'

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-faint">
            envoy-stack · product
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">
            Users
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => setEditor({ kind: 'create' })}
            className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-copper-hi"
          >
            Add user
          </button>
          <p className="flex items-center gap-1.5 text-xs text-dim">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                health ? (dbUp ? 'bg-moss' : 'bg-clay') : 'bg-faint'
              }`}
            />
            {health ? `database ${dbUp ? 'up' : 'down'}` : 'database unknown'}
          </p>
        </div>
      </header>

      {authOpen && (
        <form
          onSubmit={submitAuth}
          className="mt-8 rounded-lg border border-line bg-panel p-4"
        >
          <p className="text-sm font-semibold text-fg">Write access credentials</p>
          <p className="mt-1 text-xs text-dim">
            Create, edit, and delete routes are guarded by Envoy's basic auth.
            These credentials are stored in your browser for this demo.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={authUser}
              onChange={(e) => setAuthUser(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="rounded-md border border-line bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-copper focus:outline-none"
            />
            <input
              type="password"
              value={authPass}
              onChange={(e) => setAuthPass(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="rounded-md border border-line bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-copper focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md border border-line px-4 py-2 text-sm text-fg transition-colors hover:border-copper"
            >
              Sign in
            </button>
          </div>
        </form>
      )}

      {auth && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-faint">Authenticated for write operations</p>
          <button
            onClick={() => {
              clearAuth()
              setAuth(null)
            }}
            className="text-xs text-dim underline-offset-2 hover:text-fg hover:underline"
          >
            Sign out
          </button>
        </div>
      )}

      <main className="mt-6 space-y-4">
        {editor.kind !== 'closed' && (
          <UserForm
            initial={editor.kind === 'edit' ? editor.user : undefined}
            onSubmit={save}
            onCancel={() => setEditor({ kind: 'closed' })}
            busy={busy}
          />
        )}

        {actionError && (
          <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
            {actionError}
          </p>
        )}

        {loadError && (
          <div className="rounded-lg border border-clay/40 bg-panel p-8 text-center">
            <p className="text-sm text-clay">{loadError}</p>
            <button
              onClick={() => void refresh()}
              className="mt-4 rounded-md border border-line px-4 py-2 text-sm text-fg transition-colors hover:border-copper"
            >
              Retry
            </button>
          </div>
        )}

        {!loadError && loading && (
          <p className="py-10 text-center text-sm text-dim">Loading…</p>
        )}

        {!loadError && !loading && users.length === 0 && (
          <div className="rounded-lg border border-line bg-panel p-8 text-center">
            <p className="text-sm text-dim">No users yet.</p>
          </div>
        )}

        {!loadError && !loading && users.length > 0 && (
          <UserTable
            users={users}
            onEdit={(user) => {
              setActionError(null)
              setEditor({ kind: 'edit', user })
            }}
            onDelete={remove}
            deletingId={deletingId}
          />
        )}
      </main>

      <footer className="mt-10 border-t border-line/60 pt-4 text-xs text-faint">
        <p>
          Data path: browser → Envoy (L7) → backend → Envoy (L4) → Postgres.
        </p>
      </footer>
    </div>
  )
}
