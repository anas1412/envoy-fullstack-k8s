-- Schema (idempotent: safe to re-run)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed (guarded: never duplicates on re-run)
INSERT INTO users (name, email, role) VALUES
    ('Ada Lovelace',   'ada@example.com',       'admin'),
    ('Grace Hopper',   'grace@example.com',     'editor'),
    ('Alan Turing',    'alan@example.com',      'viewer'),
    ('Katherine Johnson', 'katherine@example.com', 'editor'),
    ('Margaret Hamilton', 'margaret@example.com', 'admin')
ON CONFLICT (email) DO NOTHING;
