# Message in a Bottle

A tiny Supabase-backed prototype: load a random message left by a previous
visitor, like it, share it, or cast your own message into the pool for
someone else to find.

## Stack

- Plain HTML / CSS / JS (no build step) — open `index.html` directly or serve
  the folder statically
- [Supabase](https://supabase.com) (Postgres + Realtime-less REST via
  `supabase-js`) for storage, loaded from the `@supabase/supabase-js` CDN

## Supabase project

Project: **Supabase Hackathon** (`mttopqljhujyhfxxtpdo`, org `tanken`).

Schema (see `supabase/migration.sql` for the full statement run against the
project):

- `messages` — `id`, `content`, `likes_count`, `share_count`, `created_at`
- `message_likes` — join table of `(message_id, liker_token)` so a like can be
  toggled without requiring auth (the browser keeps a random `liker_token` in
  `localStorage`)
- `get_random_message(exclude_id)` — RPC returning one random row, optionally
  excluding the message currently on screen
- `increment_share_count(target_id)` — RPC for atomically bumping the share
  counter

RLS is enabled on both tables; anonymous `select`/`insert` (and `delete` on
`message_likes`, to support unliking) are allowed since there's no auth layer
in this prototype.

The anon/publishable key in `app.js` is safe to ship client-side — it only
grants what the RLS policies above allow.

## Running locally

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```
