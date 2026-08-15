import { useEffect, useState } from 'react'
import type { User, UserDraft } from '../types'

const ROLES = ['admin', 'editor', 'viewer'] as const

interface Props {
  initial?: Pick<User, 'id'> & UserDraft
  onSubmit: (draft: UserDraft) => void
  onCancel: () => void
  busy: boolean
}

export function UserForm({ initial, onSubmit, onCancel, busy }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>(ROLES[0])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initial) {
      setName(initial.name)
      setEmail(initial.email)
      setRole(initial.role)
    }
  }, [initial])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required')
      return
    }
    setError(null)
    onSubmit({ name: name.trim(), email: email.trim(), role })
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-line bg-panel-2 p-4"
    >
      <p className="text-sm font-semibold text-fg">
        {initial ? `Edit user #${initial.id ?? ''}` : 'Add a user'}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_10rem]">
        <label className="block">
          <span className="text-xs text-dim">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            autoFocus
            className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-copper focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-dim">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@example.com"
            className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-copper focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-dim">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-fg focus:border-copper focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-xs text-clay">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-copper-hi disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-line px-4 py-2 text-sm text-dim transition-colors hover:text-fg disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
