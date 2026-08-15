import { useState } from 'react'
import type { User } from '../types'

interface Props {
  users: User[]
  onEdit: (user: User) => void
  onDelete: (id: number) => void
  deletingId: number | null
}

export function UserTable({ users, onEdit, onDelete, deletingId }: Props) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const handleDelete = (user: User) => {
    if (confirmingId === user.id) {
      setConfirmingId(null)
      onDelete(user.id)
    } else {
      setConfirmingId(user.id)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-panel text-xs uppercase tracking-wider text-faint">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.id}
              className="border-b border-line/60 bg-panel last:border-b-0"
            >
              <td className="px-4 py-3 text-fg">{u.name}</td>
              <td className="px-4 py-3 font-mono text-sm text-dim">{u.email}</td>
              <td className="px-4 py-3 text-dim">{u.role}</td>
              <td className="px-4 py-3 font-mono text-xs text-faint">
                {new Date(u.created_at).toISOString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-3">
                  <button
                    onClick={() => onEdit(u)}
                    className="text-sm text-copper transition-colors hover:text-copper-hi"
                  >
                    Edit
                  </button>
                  {confirmingId === u.id ? (
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
                      className="text-sm font-medium text-clay transition-colors hover:opacity-80 disabled:opacity-50"
                    >
                      {deletingId === u.id ? 'Deleting…' : 'Confirm'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(u)}
                      className="text-sm text-dim transition-colors hover:text-clay"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
