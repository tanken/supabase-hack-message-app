# Message in a Bottle

A warm, typography-first encouragement board. A visitor can receive a random
message left by a stranger (with a beautiful reveal animation), browse a
gallery of public messages, write one of their own, share any message by
URL, and pass one forward after reading it.

## Stack

- Plain HTML / CSS / JS (no build step, no bundler) — open `index.html`
  directly or serve the folder statically
- [Supabase](https://supabase.com) (Postgres + REST via `supabase-js`) for
  storage, loaded from the `@supabase/supabase-js` CDN
- [GSAP](https://gsap.com) for the reveal animation, [Phosphor
  Icons](https://phosphoricons.com) for iconography — both loaded from CDN
- Playfair Display (message/display serif) + Outfit (UI sans), via Google
  Fonts

## Features

1. **Receive** — "Reveal a message" fetches one random public message.
2. **Reveal animation** — the message card scales in and the text resolves
   from a soft blur, built with GSAP; skipped in favor of the final state
   when `prefers-reduced-motion` is set.
3. **Gallery** — browse the most recent public messages as typography cards
   with a staggered scroll-in reveal (`IntersectionObserver`).
4. **Write** — leave an encouraging message for a stranger from the Write tab.
5. **Share** — every message has a URL (`?m=<id>`); opening that link loads
   that specific message directly, no matter where it was shared.
6. **Pass it forward** — after reading a message, "Pass it forward" opens the
   write form so you can leave one of your own.

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

No install, no build step. Pick whichever you have on hand:

```bash
npx serve .
```

```bash
python3 -m http.server 8080
```

Then open the printed URL (`http://localhost:3000` for `serve`, or
`http://localhost:8080` for Python). The app talks straight to the Supabase
project above, so there's nothing else to configure.

To preview a specific message the way a shared link would open it, append
`?m=<message-id>`, e.g. `http://localhost:8080/?m=<uuid>`.

## Deployment

Deployed to Vercel as a static site (no build command, no framework) from
the `main` branch of this repo.
